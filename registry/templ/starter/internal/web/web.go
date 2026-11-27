// Package web wires the HTTP routes: request -> handler -> PocketBase
// (internal/content) -> view model (internal/view) -> templ screen. All
// public data goes through these handlers; the PocketBase REST API and the
// admin UI are reachable only from the allow-list (security.AdminAllowed).
package web

import (
	"io/fs"
	"log"
	"log/slog"
	"net/http"
	"path"
	"strings"
	"time"

	"github.com/a-h/templ"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/hook"
	"github.com/pocketbase/pocketbase/tools/router"

	"github.com/fastygo/starter/internal/auth"
	"github.com/fastygo/starter/internal/config"
	"github.com/fastygo/starter/internal/content"
	"github.com/fastygo/starter/internal/i18n"
	"github.com/fastygo/starter/internal/preset"
	"github.com/fastygo/starter/internal/security"
	"github.com/fastygo/starter/internal/view"
	"github.com/fastygo/starter/internal/web/screens"
	"github.com/fastygo/starter/internal/web/static"
)

// Server holds the dependencies of the handlers.
type Server struct {
	App        core.App
	Cfg        config.Config
	Dict       *i18n.Dict
	LoginLimit *security.Limiter
	Now        func() time.Time
}

// New returns a server with the default sign-in limit (5/min per client IP,
// kept in memory only).
func New(app core.App, cfg config.Config, dict *i18n.Dict) *Server {
	return &Server{
		App: app, Cfg: cfg, Dict: dict,
		LoginLimit: security.NewLimiter(5, time.Minute),
		Now:        time.Now,
	}
}

// Router is the PocketBase router type.
type Router = router.Router[*core.RequestEvent]

// Register binds the middleware and every route of the site.
func (s *Server) Register(r *Router) {
	r.Bind(&hook.Handler[*core.RequestEvent]{Id: "site_guard", Priority: -1025, Func: s.guard})
	r.Bind(&hook.Handler[*core.RequestEvent]{Id: "site_headers", Priority: -1005, Func: s.headers})

	r.GET("/static/{path...}", s.static)
	r.GET("/favicon.ico", func(e *core.RequestEvent) error {
		return e.Redirect(http.StatusMovedPermanently, static.Path("favicon.svg"))
	})
	r.GET("/media/{collection}/{id}/{file}", s.media)
	r.GET("/healthz", func(e *core.RequestEvent) error { return e.String(http.StatusOK, "ok") })
	r.GET("/robots.txt", s.robots)
	r.GET("/sitemap.xml", s.sitemap)

	r.GET("/{$}", s.home)
	for _, col := range preset.ContentCollections {
		r.GET("/"+col, s.list(col))
		r.GET("/"+col+"/{slug}", s.detail(col))
	}
	// Public pages are GET only: no visitor form posts anything.
	r.GET("/contact", s.contact)
	r.GET("/cart", s.cart)

	s.registerCabinet(r)

	r.GET("/{path...}", func(e *core.RequestEvent) error { return s.notFound(e) })
}

// guard answers 404 for PocketBase's own UI and API unless the request
// comes straight from the allow-list (an SSH tunnel to loopback).
func (s *Server) guard(e *core.RequestEvent) error {
	if security.IsAdminPath(e.Request.URL.Path) && !security.AdminAllowed(e.Request, s.Cfg.AdminAllow) {
		e.Response.Header().Set("Content-Type", "text/plain; charset=utf-8")
		e.Response.WriteHeader(http.StatusNotFound)
		_, _ = e.Response.Write([]byte("404 page not found\n"))
		return nil
	}
	return e.Next()
}

func (s *Server) headers(e *core.RequestEvent) error {
	security.BaseHeaders(e.Response.Header(), s.Cfg.Production)
	if !strings.HasPrefix(e.Request.URL.Path, "/api/") {
		e.Response = &corsFilter{ResponseWriter: e.Response}
	}
	return e.Next()
}

// corsFilter drops the CORS headers PocketBase adds to every response; the
// site pages are same-origin only.
type corsFilter struct{ http.ResponseWriter }

func (w *corsFilter) strip() {
	h := w.Header()
	for _, k := range []string{"Access-Control-Allow-Origin", "Access-Control-Allow-Credentials", "Access-Control-Allow-Headers", "Access-Control-Allow-Methods", "Access-Control-Expose-Headers", "Access-Control-Max-Age"} {
		h.Del(k)
	}
}
func (w *corsFilter) WriteHeader(code int)        { w.strip(); w.ResponseWriter.WriteHeader(code) }
func (w *corsFilter) Write(b []byte) (int, error) { w.strip(); return w.ResponseWriter.Write(b) }
func (w *corsFilter) Unwrap() http.ResponseWriter { return w.ResponseWriter }

// post wraps an unsafe handler with the same-origin check.
func (s *Server) post(h func(*core.RequestEvent) error) func(*core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		if !security.SameOrigin(e.Request) {
			return e.String(http.StatusForbidden, "cross-site request refused\n")
		}
		return h(e)
	}
}

// settings returns the stored settings with the env preset override.
func (s *Server) settings() content.Settings {
	st, _ := content.LoadSettings(s.App)
	if s.Cfg.Preset != "" {
		st.Preset = s.Cfg.Preset
	}
	return st
}

func (s *Server) t(key string) string { return s.Dict.T(key) }

// page builds the shell data of a public page.
func (s *Server) page(e *core.RequestEvent, st content.Settings, title, desc string) screens.Page {
	cur := e.Request.URL.Path
	var nav []view.NavLink
	for _, sec := range preset.Sections(st.Preset) {
		nav = append(nav, view.NavLink{Label: s.t(sec.Label), Href: sec.Path, Icon: sec.Icon, Current: cur == sec.Path || strings.HasPrefix(cur, sec.Path+"/")})
	}
	if preset.HasContactPage(st.Preset) {
		nav = append(nav, view.NavLink{Label: s.t("nav.contact"), Href: "/contact", Icon: "mail", Current: cur == "/contact"})
	}
	site := view.Site{
		Brand: st.Brand, Tagline: st.Tagline, About: st.About, Lang: st.Lang, Preset: st.Preset,
		BaseURL: s.baseURL(e), Nav: nav, Contact: st.Contact(), HasCart: preset.HasCart(st.Preset), Year: s.Now().Year(),
	}
	return screens.Page{
		Site: site, T: s.t, Nonce: security.NewNonce(), Title: title, Description: desc,
		Canonical: site.BaseURL + cur,
	}
}

func (s *Server) baseURL(e *core.RequestEvent) string {
	if s.Cfg.BaseURL != "" {
		return s.Cfg.BaseURL
	}
	scheme := "http"
	if e.Request.TLS != nil {
		scheme = "https"
	}
	return scheme + "://" + e.Request.Host
}

// render writes an HTML screen with the CSP of its nonce.
func (s *Server) render(e *core.RequestEvent, status int, p screens.Page, c templ.Component) error {
	h := e.Response.Header()
	h.Set("Content-Type", "text/html; charset=utf-8")
	h.Set("Content-Security-Policy", security.CSP(p.Nonce))
	if h.Get("Cache-Control") == "" {
		h.Set("Cache-Control", "private, no-cache")
	}
	e.Response.WriteHeader(status)
	return c.Render(e.Request.Context(), e.Response)
}

func (s *Server) notFound(e *core.RequestEvent) error {
	st := s.settings()
	p := s.page(e, st, s.t("error.not_found"), "")
	p.NoIndex, p.Canonical = true, ""
	return s.render(e, http.StatusNotFound, p, screens.NotFoundScreen(p))
}

func (s *Server) fail(e *core.RequestEvent, err error) error {
	// path and error only: never the client IP or headers (see PRIVACY.md)
	s.App.Logger().Error("request failed", slog.String("path", e.Request.URL.Path), slog.String("err", err.Error()))
	log.Printf("site: request failed: %s: %v", e.Request.URL.Path, err)
	return e.String(http.StatusInternalServerError, "Something went wrong. Please try again.\n")
}

func (s *Server) static(e *core.RequestEvent) error {
	name := path.Clean(e.Request.PathValue("path"))
	if name == "." || strings.HasPrefix(name, "..") || strings.HasSuffix(e.Request.URL.Path, "/") {
		return s.notFound(e)
	}
	fi, err := fs.Stat(static.FS(), name)
	if err != nil || fi.IsDir() || strings.HasSuffix(name, ".go") {
		return s.notFound(e)
	}
	if e.Request.URL.Query().Get("v") != "" || strings.HasPrefix(name, "fonts/") {
		e.Response.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	} else {
		e.Response.Header().Set("Cache-Control", "public, max-age=3600")
	}
	http.ServeFileFS(e.Response, e.Request, static.FS(), name)
	return nil
}

// media serves a cover of a published record (or any record to a
// signed-in cabinet user) from PocketBase storage.
func (s *Server) media(e *core.RequestEvent) error {
	col, id, file := e.Request.PathValue("collection"), e.Request.PathValue("id"), e.Request.PathValue("file")
	known := false
	for _, c := range preset.ContentCollections {
		known = known || c == col
	}
	if !known {
		return s.notFound(e)
	}
	rec, err := s.App.FindRecordById(col, id)
	if err != nil || rec.GetString("cover") != file || file == "" {
		return s.notFound(e)
	}
	if rec.GetString("status") != content.Published && auth.Current(s.App, e.Request) == nil {
		return s.notFound(e)
	}
	fsys, err := s.App.NewFilesystem()
	if err != nil {
		return s.fail(e, err)
	}
	defer fsys.Close()
	e.Response.Header().Set("Cache-Control", "public, max-age=86400")
	if err := fsys.Serve(e.Response, e.Request, rec.BaseFilesPath()+"/"+file, file); err != nil {
		return s.notFound(e)
	}
	return nil
}

func (s *Server) robots(e *core.RequestEvent) error {
	body := "User-agent: *\nDisallow: /cabinet\nDisallow: /cart\nSitemap: " + s.baseURL(e) + "/sitemap.xml\n"
	if !s.Cfg.Production {
		body = "User-agent: *\nDisallow: /\n"
	}
	return e.String(http.StatusOK, body)
}

func (s *Server) sitemap(e *core.RequestEvent) error {
	st := s.settings()
	base := s.baseURL(e)
	var b strings.Builder
	b.WriteString(`<?xml version="1.0" encoding="UTF-8"?>` + "\n" + `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` + "\n")
	add := func(loc string) { b.WriteString("<url><loc>" + templ.EscapeString(base+loc) + "</loc></url>\n") }
	add("/")
	for _, sec := range preset.Sections(st.Preset) {
		add(sec.Path)
		cards, err := content.List(s.App, sec, st, 5000)
		if err != nil {
			return s.fail(e, err)
		}
		for _, c := range cards {
			add(c.Href)
		}
	}
	if preset.HasContactPage(st.Preset) {
		add("/contact")
	}
	b.WriteString("</urlset>\n")
	e.Response.Header().Set("Content-Type", "application/xml; charset=utf-8")
	return e.Blob(http.StatusOK, "application/xml; charset=utf-8", []byte(b.String()))
}
