package web_test

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"net/url"
	"regexp"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"

	"github.com/fastygo/starter/internal/config"
	"github.com/fastygo/starter/internal/content"
	"github.com/fastygo/starter/internal/i18n"
	_ "github.com/fastygo/starter/internal/migrations"
	"github.com/fastygo/starter/internal/preset"
	"github.com/fastygo/starter/internal/seed"
	"github.com/fastygo/starter/internal/web"
	"github.com/fastygo/starter/ui/dict"
)

const pass = "test-password-123"

type site struct {
	t   *testing.T
	app core.App
	h   http.Handler
}

func newSite(t *testing.T, name string) *site {
	t.Helper()
	app := core.NewBaseApp(core.BaseAppConfig{DataDir: t.TempDir()})
	if err := app.Bootstrap(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = app.ResetBootstrapState() })
	if err := app.RunAllMigrations(); err != nil {
		t.Fatal(err)
	}
	seed.Covers = false
	if _, err := seed.Run(app, name, false); err != nil {
		t.Fatal(err)
	}
	users, _ := app.FindCollectionByNameOrId("users")
	u := core.NewRecord(users)
	u.SetEmail("editor@example.test")
	u.SetPassword(pass)
	u.Set("role", "admin")
	if err := app.Save(u); err != nil {
		t.Fatal(err)
	}
	words, err := i18n.Parse(dict.EN)
	if err != nil {
		t.Fatal(err)
	}
	cfg := config.Config{AdminAllow: []netip.Prefix{netip.MustParsePrefix("127.0.0.1/32")}}
	r, err := apis.NewRouter(app)
	if err != nil {
		t.Fatal(err)
	}
	web.New(app, cfg, words).Register(r)
	h, err := r.BuildMux()
	if err != nil {
		t.Fatal(err)
	}
	return &site{t: t, app: app, h: h}
}

func (s *site) do(method, target string, body *strings.Reader, hdr map[string]string, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	var req *http.Request
	if body == nil {
		req = httptest.NewRequest(method, target, nil)
	} else {
		req = httptest.NewRequest(method, target, body)
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	}
	req.RemoteAddr = "192.0.2.10:4000"
	for k, v := range hdr {
		req.Header.Set(k, v)
	}
	for _, c := range cookies {
		req.AddCookie(c)
	}
	rec := httptest.NewRecorder()
	s.h.ServeHTTP(rec, req)
	return rec
}

func (s *site) get(target string, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	return s.do("GET", target, nil, nil, cookies...)
}

func form(v url.Values) *strings.Reader { return strings.NewReader(v.Encode()) }

func cookie(rec *httptest.ResponseRecorder, name string) *http.Cookie {
	for _, c := range rec.Result().Cookies() {
		if c.Name == name {
			return c
		}
	}
	return nil
}

func TestPresetsSmoke(t *testing.T) {
	for _, name := range preset.All {
		t.Run(name, func(t *testing.T) {
			s := newSite(t, name)
			st, _ := content.LoadSettings(s.app)
			paths := []string{"/", "/robots.txt", "/sitemap.xml", "/healthz"}
			for _, sec := range preset.Sections(name) {
				paths = append(paths, sec.Path)
				cards, err := content.List(s.app, sec, st, 1)
				if err != nil || len(cards) == 0 {
					t.Fatalf("%s: no demo cards (%v)", sec.Collection, err)
				}
				paths = append(paths, cards[0].Href)
			}
			if preset.HasContactPage(name) {
				paths = append(paths, "/contact")
			}
			if preset.HasCart(name) {
				paths = append(paths, "/cart")
			}
			for _, p := range paths {
				rec := s.get(p)
				if rec.Code != http.StatusOK {
					t.Fatalf("GET %s = %d", p, rec.Code)
				}
				assertPrivate(t, p, rec)
				if strings.HasPrefix(rec.Header().Get("Content-Type"), "text/html") {
					assertCSP(t, p, rec)
				}
			}
			for _, p := range []string{"/nope", "/products/missing"} {
				rec := s.get(p)
				if rec.Code != http.StatusNotFound {
					t.Fatalf("GET %s = %d, want 404", p, rec.Code)
				}
				assertPrivate(t, p, rec)
			}
			// the cabinet sign-in page sets no cookie either (only signing in does)
			if rec := s.get("/cabinet/login"); rec.Code != http.StatusOK || len(rec.Result().Cookies()) != 0 {
				t.Fatalf("GET /cabinet/login = %d, cookies %v", rec.Code, rec.Result().Cookies())
			}
			// no public route accepts a post: visitors cannot send data
			for _, p := range []string{"/", "/contact", "/cart", "/cart/add", "/cart/update", "/checkout", "/products/ceramic-mug"} {
				if rec := s.do("POST", p, form(url.Values{"name": {"x"}, "slug": {"ceramic-mug"}}), nil); rec.Code < 400 {
					t.Fatalf("POST %s = %d, want an error", p, rec.Code)
				}
			}
			if _, err := s.app.FindCollectionByNameOrId("leads"); err == nil {
				t.Fatal("the leads collection must not exist")
			}
			// sections of other presets are 404
			for _, col := range preset.ContentCollections {
				if _, ok := preset.Find(name, col); !ok {
					if rec := s.get("/" + col); rec.Code != http.StatusNotFound {
						t.Fatalf("%s: /%s = %d, want 404", name, col, rec.Code)
					}
				}
			}
			if rec := s.get("/cabinet"); rec.Code != http.StatusSeeOther {
				t.Fatalf("cabinet without session = %d", rec.Code)
			}
		})
	}
}

var (
	nonceRe = regexp.MustCompile(`<script nonce="([^"]+)"`)
	tagRe   = regexp.MustCompile(`<([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>`)
	attrRe  = regexp.MustCompile(`\b(src|srcset|href|action|formaction|poster|data|content)="([^"]*)"`)
	blankRe = regexp.MustCompile(`target="_blank"`)
	relRe   = regexp.MustCompile(`rel="([^"]*)"`)
)

// assertPrivate is the privacy-by-design contract of every public page: no
// cookie, no form, nothing loaded from another host (only plain <a> links
// may point elsewhere), and every new-window link is noopener noreferrer.
func assertPrivate(t *testing.T, p string, rec *httptest.ResponseRecorder) {
	t.Helper()
	if v := rec.Header().Values("Set-Cookie"); len(v) != 0 {
		t.Fatalf("%s sets cookies: %v", p, v)
	}
	body := rec.Body.String()
	if strings.Contains(body, "<form") {
		t.Fatalf("%s has a form; public pages collect nothing", p)
	}
	for _, m := range tagRe.FindAllStringSubmatch(body, -1) {
		tag, attrs := strings.ToLower(m[1]), m[2]
		if blankRe.MatchString(attrs) {
			r := relRe.FindStringSubmatch(attrs)
			if r == nil || !strings.Contains(r[1], "noopener") || !strings.Contains(r[1], "noreferrer") {
				t.Fatalf("%s: target=_blank without rel=noopener noreferrer: %s", p, m[0])
			}
		}
		if tag == "a" {
			continue
		}
		for _, a := range attrRe.FindAllStringSubmatch(attrs, -1) {
			v := strings.TrimSpace(a[2])
			if a[1] == "content" && !strings.Contains(v, "://") {
				continue
			}
			if strings.HasPrefix(v, "//") || ((strings.HasPrefix(v, "http://") || strings.HasPrefix(v, "https://")) && !strings.HasPrefix(v, "http://example.com")) {
				t.Fatalf("%s: <%s> references another host: %s", p, tag, m[0])
			}
		}
	}
	if csp := rec.Header().Get("Content-Security-Policy"); csp != "" && !strings.Contains(csp, "default-src 'self'") {
		t.Fatalf("%s: CSP %q", p, csp)
	}
}

func assertCSP(t *testing.T, p string, rec *httptest.ResponseRecorder) {
	t.Helper()
	csp := rec.Header().Get("Content-Security-Policy")
	m := nonceRe.FindStringSubmatch(rec.Body.String())
	if m == nil || !strings.Contains(csp, "'nonce-"+m[1]+"'") || strings.Contains(csp, "unsafe-inline") {
		t.Fatalf("%s: CSP %q does not match the page nonce", p, csp)
	}
	if rec.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatalf("%s: CORS header on an HTML page", p)
	}
	if rec.Header().Get("X-Frame-Options") != "DENY" {
		t.Fatalf("%s: missing baseline headers", p)
	}
}

func TestAdminAndAPIHidden(t *testing.T) {
	s := newSite(t, preset.Blog)
	for _, p := range []string{"/_/", "/api/collections/users/records", "/api/collections/_superusers/auth-with-password", "/api/settings"} {
		rec := s.get(p)
		if rec.Code != http.StatusNotFound || strings.Contains(rec.Body.String(), "<html") {
			t.Fatalf("public %s = %d %q", p, rec.Code, rec.Body.String())
		}
	}
	if rec := s.get("/api/health"); rec.Code != http.StatusOK {
		t.Fatalf("/api/health = %d", rec.Code)
	}
	// through the tunnel (loopback, no proxy headers) PocketBase answers itself
	req := httptest.NewRequest("GET", "/api/collections/articles/records", nil)
	req.RemoteAddr = "127.0.0.1:5000"
	rec := httptest.NewRecorder()
	s.h.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("tunnel API with closed rules = %d, want 403 from PocketBase", rec.Code)
	}
	// loopback but forwarded by the edge proxy: hidden again
	req = httptest.NewRequest("GET", "/api/collections/articles/records", nil)
	req.RemoteAddr = "127.0.0.1:5000"
	req.Header.Set("X-Forwarded-For", "203.0.113.1")
	rec = httptest.NewRecorder()
	s.h.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("proxied API = %d, want 404", rec.Code)
	}
}

func TestShopCartIsBrowserOnly(t *testing.T) {
	s := newSite(t, preset.Shop)
	rec := s.get("/cart")
	body := rec.Body.String()
	assertPrivate(t, "/cart", rec)
	// the catalog carries database prices; out-of-stock products are absent
	for _, want := range []string{`<script id="cart-catalog" type="application/json">`, `"ceramic-mug":{"title":"Ceramic mug","href":"/products/ceramic-mug","price":1800`, `id="order-message"`, `id="copy-order"`, `data-msg-greeting="Hello, Northwind Goods! I would like to order:"`} {
		if !strings.Contains(body, want) {
			t.Fatalf("cart page misses %q", want)
		}
	}
	if strings.Contains(body, `"scented-candle"`) {
		t.Fatal("out-of-stock product in the cart catalog")
	}
	if n := strings.Count(body, `data-contact="true"`); n != 1 {
		t.Fatalf("cart page has %d contact buttons, want exactly 1", n)
	}
	if !strings.Contains(body, `href="mailto:hello@example.com"`) {
		t.Fatal("contact button must use the settings link")
	}
	// the product page: add-to-cart is a JS button, one contact button
	rec = s.get("/products/ceramic-mug")
	assertPrivate(t, "/products/ceramic-mug", rec)
	body = rec.Body.String()
	if !strings.Contains(body, `data-add-to-cart="ceramic-mug"`) || strings.Count(body, `data-contact="true"`) != 1 {
		t.Fatal("product page: add-to-cart button or the single contact button missing")
	}
}

func TestContactButtonSettings(t *testing.T) {
	s := newSite(t, preset.Shop)
	st, _ := content.LoadSettings(s.app)
	st.ContactURL, st.ContactLabel = "https://t.me/northwind", "Write in Telegram"
	st.ContactVariant, st.ContactSize, st.ContactNewWindow = "outline", "sm", true
	if err := content.SaveSettings(s.app, st); err != nil {
		t.Fatal(err)
	}
	link := regexp.MustCompile(`<a [^>]*data-contact="true"[^>]*>`)
	for _, p := range []string{"/cart", "/products/ceramic-mug", "/"} {
		body := s.get(p).Body.String()
		tags := link.FindAllString(body, -1)
		if len(tags) != 1 {
			t.Fatalf("%s: %d contact buttons, want 1", p, len(tags))
		}
		a := tags[0]
		for _, want := range []string{`href="https://t.me/northwind"`, `target="_blank"`, `rel="noopener noreferrer"`, "inset-ring-border", "h-8"} {
			if !strings.Contains(a, want) {
				t.Fatalf("%s: contact button %s misses %q", p, a, want)
			}
		}
		if !strings.Contains(body, "Write in Telegram") {
			t.Fatalf("%s: button text missing", p)
		}
	}
	st.ContactNewWindow, st.ContactVariant, st.ContactSize = false, "nonsense", "huge"
	if err := content.SaveSettings(s.app, st); err != nil {
		t.Fatal(err)
	}
	a := link.FindString(s.get("/cart").Body.String())
	if strings.Contains(a, "target=") || !strings.Contains(a, "bg-primary") || !strings.Contains(a, "h-12") {
		t.Fatalf("same-window button with fallback look expected, got %s", a)
	}
}

func signIn(t *testing.T, s *site) *http.Cookie {
	t.Helper()
	rec := s.do("POST", "/cabinet/login", form(url.Values{"email": {"editor@example.test"}, "password": {pass}}), nil)
	c := cookie(rec, "site_session")
	if rec.Code != http.StatusSeeOther || c == nil || !c.HttpOnly {
		t.Fatalf("login = %d", rec.Code)
	}
	return c
}

func TestCabinetFlows(t *testing.T) {
	s := newSite(t, preset.Corporate)
	if rec := s.do("POST", "/cabinet/login", form(url.Values{"email": {"editor@example.test"}, "password": {"wrong-password"}}), nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("bad login = %d", rec.Code)
	}
	sess := signIn(t, s)
	for _, p := range []string{"/cabinet", "/cabinet/cases", "/cabinet/services", "/cabinet/articles", "/cabinet/settings", "/cabinet/cases/new"} {
		if rec := s.get(p, sess); rec.Code != http.StatusOK {
			t.Fatalf("GET %s = %d", p, rec.Code)
		}
	}
	if rec := s.get("/cabinet/products", sess); rec.Code != http.StatusNotFound {
		t.Fatalf("corporate has no products section, got %d", rec.Code)
	}

	// create a published case with a PNG cover; it is stored as WebP
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	for k, v := range map[string]string{"title": "New case study", "excerpt": "Short", "body": "## Hello", "client": "ACME", "result": "+1", "status": "published"} {
		_ = mw.WriteField(k, v)
	}
	fw, _ := mw.CreateFormFile("cover", "cover.png")
	img := image.NewRGBA(image.Rect(0, 0, 40, 20))
	img.Set(1, 1, color.RGBA{255, 0, 0, 255})
	_ = png.Encode(fw, img)
	_ = mw.Close()
	req := httptest.NewRequest("POST", "/cabinet/cases/new", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.RemoteAddr = "192.0.2.10:4000"
	req.AddCookie(sess)
	rec := httptest.NewRecorder()
	s.h.ServeHTTP(rec, req)
	if rec.Code != http.StatusSeeOther {
		t.Fatalf("create case = %d %s", rec.Code, rec.Body.String())
	}
	r, err := s.app.FindFirstRecordByData("cases", "slug", "new-case-study")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasSuffix(r.GetString("cover"), ".webp") || r.GetString("status") != "published" {
		t.Fatalf("cover %q status %q", r.GetString("cover"), r.GetString("status"))
	}
	if rec := s.get("/cases/new-case-study"); rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "<h2") {
		t.Fatalf("public case = %d", rec.Code)
	}
	if rec := s.get(content.CoverURL(r)); rec.Code != http.StatusOK || rec.Header().Get("Content-Type") != "image/webp" {
		t.Fatalf("cover = %d %s", rec.Code, rec.Header().Get("Content-Type"))
	}

	// settings refuse unsafe contact links
	rec = s.do("POST", "/cabinet/settings", form(url.Values{"brand_name": {"X"}, "contact_url": {"javascript:alert(1)"}}), nil, sess)
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("unsafe contact = %d", rec.Code)
	}
	rec = s.do("POST", "/cabinet/settings", form(url.Values{"brand_name": {"Acme"}, "contact_url": {"https://t.me/acme"}, "contact_label": {"Telegram"}, "currency": {"EUR"}, "lang": {"en"}}), nil, sess)
	if rec.Code != http.StatusSeeOther {
		t.Fatalf("settings save = %d", rec.Code)
	}
	if st, _ := content.LoadSettings(s.app); st.ContactURL != "https://t.me/acme" || st.Preset != preset.Corporate {
		t.Fatalf("settings %+v", st)
	}

	if rec := s.get("/cabinet/leads", sess); rec.Code != http.StatusNotFound {
		t.Fatalf("/cabinet/leads = %d, want 404 (nothing is collected)", rec.Code)
	}
	// the contact button look is saved from the settings form
	rec = s.do("POST", "/cabinet/settings", form(url.Values{"brand_name": {"Acme"}, "contact_url": {"https://t.me/acme"}, "contact_label": {"Telegram"}, "contact_variant": {"secondary"}, "contact_size": {"default"}, "contact_new_window": {"1"}}), nil, sess)
	if st, _ := content.LoadSettings(s.app); rec.Code != http.StatusSeeOther || st.ContactVariant != "secondary" || st.ContactSize != "default" || !st.ContactNewWindow {
		t.Fatalf("button settings = %d %+v", rec.Code, st)
	}
	if page := s.get("/cabinet/settings", sess).Body.String(); !strings.Contains(page, `id="contact-preview"`) || !strings.Contains(page, `id="button-classes"`) {
		t.Fatal("settings page misses the button preview")
	}

	// sign-out invalidates the token
	if rec := s.do("POST", "/cabinet/logout", form(url.Values{}), nil, sess); rec.Code != http.StatusSeeOther {
		t.Fatalf("logout = %d", rec.Code)
	}
	if rec := s.get("/cabinet", sess); rec.Code != http.StatusSeeOther {
		t.Fatalf("old session still works: %d", rec.Code)
	}
}

func TestLoginRateLimit(t *testing.T) {
	s := newSite(t, preset.Blog)
	var last int
	for i := 0; i < 6; i++ {
		last = s.do("POST", "/cabinet/login", form(url.Values{"email": {"x@example.test"}, "password": {"nope-nope-nope"}}), nil).Code
	}
	if last != http.StatusTooManyRequests {
		t.Fatalf("6th attempt = %d, want 429", last)
	}
}
