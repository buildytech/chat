package web

import (
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/filesystem"
	"github.com/pocketbase/pocketbase/tools/types"

	"github.com/fastygo/starter/internal/auth"
	"github.com/fastygo/starter/internal/content"
	"github.com/fastygo/starter/internal/media"
	"github.com/fastygo/starter/internal/money"
	"github.com/fastygo/starter/internal/preset"
	"github.com/fastygo/starter/internal/security"
	"github.com/fastygo/starter/internal/shop"
	"github.com/fastygo/starter/internal/view"
	"github.com/fastygo/starter/internal/web/screens"
)

func (s *Server) registerCabinet(r *Router) {
	r.GET("/cabinet/login", s.loginPage)
	r.POST("/cabinet/login", s.post(s.loginPost))
	r.POST("/cabinet/logout", s.post(s.logout))
	r.GET("/cabinet", s.user(s.dashboard))
	r.GET("/cabinet/settings", s.user(s.settingsPage))
	r.POST("/cabinet/settings", s.post(s.user(s.settingsPost)))
	r.GET("/cabinet/{section}", s.user(s.sectionList))
	r.GET("/cabinet/{section}/new", s.user(s.editPage))
	r.POST("/cabinet/{section}/new", s.post(s.user(s.editPost)))
	r.GET("/cabinet/{section}/{id}", s.user(s.editPage))
	r.POST("/cabinet/{section}/{id}", s.post(s.user(s.editPost)))
	r.POST("/cabinet/{section}/{id}/delete", s.post(s.user(s.deletePost)))
}

type userKey struct{}

// user requires a signed-in cabinet user (admin or editor).
func (s *Server) user(h func(*core.RequestEvent) error) func(*core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		rec := auth.Current(s.App, e.Request)
		if rec == nil {
			if e.Request.Method != http.MethodGet {
				return e.String(http.StatusUnauthorized, "sign in first\n")
			}
			return e.Redirect(http.StatusSeeOther, "/cabinet/login?next="+safeNext(e.Request.URL.Path))
		}
		e.Set("cabinetUser", rec)
		e.Response.Header().Set("Cache-Control", "no-store")
		return h(e)
	}
}

func current(e *core.RequestEvent) *core.Record {
	rec, _ := e.Get("cabinetUser").(*core.Record)
	return rec
}

func safeNext(v string) string {
	if !strings.HasPrefix(v, "/cabinet") || strings.HasPrefix(v, "//") || strings.ContainsAny(v, "\\\r\n") {
		return "/cabinet"
	}
	return v
}

// cabinetPage builds the shell of a cabinet screen.
func (s *Server) cabinetPage(e *core.RequestEvent, st content.Settings, title string) screens.Page {
	p := s.page(e, st, title, "")
	p.NoIndex, p.Canonical = true, ""
	rec := current(e)
	if rec != nil {
		p.User = &view.User{Email: rec.Email(), Name: rec.GetString("name"), Role: rec.GetString("role"), Admin: auth.IsAdmin(rec)}
	}
	cur := e.Request.URL.Path
	nav := []view.NavLink{{Label: s.t("cabinet.dashboard"), Href: "/cabinet", Icon: "layout-dashboard", Current: cur == "/cabinet"}}
	for _, sec := range preset.Sections(st.Preset) {
		href := "/cabinet/" + sec.Collection
		nav = append(nav, view.NavLink{Label: s.t(sec.Label), Href: href, Icon: sec.Icon, Current: strings.HasPrefix(cur, href)})
	}
	if p.User != nil && p.User.Admin {
		nav = append(nav, view.NavLink{Label: s.t("settings.title"), Href: "/cabinet/settings", Icon: "settings", Current: cur == "/cabinet/settings"})
	}
	nav = append(nav, view.NavLink{Label: s.t("cabinet.open_site"), Href: "/", Icon: "globe"})
	p.CabinetNav = nav
	if e.Request.URL.Query().Get("saved") == "1" {
		p.Flash = s.t("cabinet.saved")
	}
	return p
}

// sign-in

func (s *Server) loginPage(e *core.RequestEvent) error {
	if auth.Current(s.App, e.Request) != nil {
		return e.Redirect(http.StatusSeeOther, "/cabinet")
	}
	st := s.settings()
	p := s.page(e, st, s.t("login.title"), "")
	p.NoIndex, p.Canonical = true, ""
	e.Response.Header().Set("Cache-Control", "no-store")
	return s.render(e, http.StatusOK, p, screens.LoginScreen(p, screens.Login{Next: safeNext(e.Request.URL.Query().Get("next"))}))
}

func (s *Server) loginPost(e *core.RequestEvent) error {
	st := s.settings()
	p := s.page(e, st, s.t("login.title"), "")
	p.NoIndex, p.Canonical = true, ""
	e.Response.Header().Set("Cache-Control", "no-store")
	l := screens.Login{Email: limit(e.Request.FormValue("email"), 200), Next: safeNext(e.Request.FormValue("next"))}
	if ok, wait := s.LoginLimit.Allow("login:" + security.ClientIP(e.Request, s.Cfg.Trusted)); !ok {
		security.RetryAfter(e.Response, wait)
		l.Error = s.t("error.rate_limited")
		return s.render(e, http.StatusTooManyRequests, p, screens.LoginScreen(p, l))
	}
	rec, err := auth.SignIn(s.App, l.Email, e.Request.FormValue("password"))
	if err != nil {
		l.Error = s.t("login.invalid")
		return s.render(e, http.StatusUnauthorized, p, screens.LoginScreen(p, l))
	}
	if err := auth.Issue(e.Response, rec, s.Cfg.Production); err != nil {
		return s.fail(e, err)
	}
	return e.Redirect(http.StatusSeeOther, l.Next)
}

func (s *Server) logout(e *core.RequestEvent) error {
	auth.SignOut(s.App, e.Response, auth.Current(s.App, e.Request), s.Cfg.Production)
	return e.Redirect(http.StatusSeeOther, "/")
}

// dashboard

func (s *Server) dashboard(e *core.RequestEvent) error {
	st := s.settings()
	var stats []view.Stat
	for _, sec := range preset.Sections(st.Preset) {
		n, err := s.App.CountRecords(sec.Collection)
		if err != nil {
			return s.fail(e, err)
		}
		stats = append(stats, view.Stat{Label: s.t(sec.Label), Value: strconv.FormatInt(n, 10), Href: "/cabinet/" + sec.Collection, Icon: sec.Icon})
	}
	p := s.cabinetPage(e, st, s.t("cabinet.dashboard"))
	return s.render(e, http.StatusOK, p, screens.DashboardScreen(p, stats))
}

// sections

func (s *Server) section(e *core.RequestEvent) (content.Settings, preset.Section, bool) {
	st := s.settings()
	sec, ok := preset.Find(st.Preset, e.Request.PathValue("section"))
	return st, sec, ok
}

func (s *Server) sectionList(e *core.RequestEvent) error {
	st, sec, ok := s.section(e)
	if !ok {
		return s.notFound(e)
	}
	recs, err := s.App.FindRecordsByFilter(sec.Collection, "", "-updated", 500, 0)
	if err != nil {
		return s.fail(e, err)
	}
	rows := make([]view.Row, 0, len(recs))
	for _, r := range recs {
		row := view.Row{ID: r.Id, Title: r.GetString("title"), Status: r.GetString("status"), Updated: st.Date(r.GetDateTime("updated").Time()), EditHref: "/cabinet/" + sec.Collection + "/" + r.Id}
		if row.Status == content.Published {
			row.PublicURL = sec.Path + "/" + r.GetString("slug")
		}
		rows = append(rows, row)
	}
	p := s.cabinetPage(e, st, s.t(sec.Label))
	return s.render(e, http.StatusOK, p, screens.CabinetListScreen(p, screens.CabinetList{Title: s.t(sec.Label), NewHref: "/cabinet/" + sec.Collection + "/new", Rows: rows}))
}

func (s *Server) record(e *core.RequestEvent, sec preset.Section) (*core.Record, error) {
	id := e.Request.PathValue("id")
	if id == "" {
		col, err := s.App.FindCollectionByNameOrId(sec.Collection)
		if err != nil {
			return nil, err
		}
		return core.NewRecord(col), nil
	}
	return s.App.FindRecordById(sec.Collection, id)
}

// form maps a record (and, after a failed post, the posted values) to the
// generated form.
func (s *Server) form(st content.Settings, sec preset.Section, rec *core.Record, posted map[string]string) view.Form {
	f := view.Form{Section: sec.Collection, Status: rec.GetString("status"), IsNew: rec.IsNew()}
	if f.Status == "" {
		f.Status = content.Draft
	}
	if f.IsNew {
		f.Title = s.t("cabinet.new") + ": " + s.t(sec.Singular)
		f.Action = "/cabinet/" + sec.Collection + "/new"
	} else {
		f.Title = rec.GetString("title")
		f.Action = "/cabinet/" + sec.Collection + "/" + rec.Id
		f.DeleteURL = f.Action + "/delete"
		if f.Status == content.Published {
			f.PublicURL = sec.Path + "/" + rec.GetString("slug")
		}
	}
	for _, fd := range sec.Fields {
		v := view.Field{Name: fd.Name, Label: s.t(fd.Label), Kind: string(fd.Kind), Required: fd.Required, Max: fd.Max}
		switch fd.Kind {
		case preset.KindMoney:
			v.Value = money.Plain(int64(rec.GetInt(fd.Name)))
			if rec.IsNew() && rec.GetInt(fd.Name) == 0 {
				v.Value = ""
			}
		case preset.KindNumber:
			v.Value = strconv.Itoa(rec.GetInt(fd.Name))
		case preset.KindBool:
			v.Checked = rec.GetBool(fd.Name) || (rec.IsNew() && fd.Name == "in_stock")
		case preset.KindImage:
			v.ImageSrc = content.CoverURL(rec)
			if rec.IsNew() {
				v.ImageSrc = ""
			}
		default:
			v.Value = rec.GetString(fd.Name)
		}
		if fd.Name == "slug" {
			v.Help = s.t("field.slug_help")
		}
		if fd.Kind == preset.KindMarkdown {
			v.Help = s.t("field.body_help")
		}
		if fd.Kind == preset.KindMoney {
			v.Help = s.Dict.F("field.price_help", "currency", st.Currency)
		}
		if pv, ok := posted[fd.Name]; ok {
			v.Value = pv
			if fd.Kind == preset.KindBool {
				v.Checked = pv == "1"
			}
		}
		f.Fields = append(f.Fields, v)
	}
	if ps, ok := posted["status"]; ok {
		f.Status = ps
	}
	return f
}

func (s *Server) editPage(e *core.RequestEvent) error {
	st, sec, ok := s.section(e)
	if !ok {
		return s.notFound(e)
	}
	rec, err := s.record(e, sec)
	if err != nil {
		return s.notFound(e)
	}
	f := s.form(st, sec, rec, nil)
	p := s.cabinetPage(e, st, f.Title)
	return s.render(e, http.StatusOK, p, screens.CabinetFormScreen(p, f))
}

type formError struct{ msg string }

func (f formError) Error() string { return f.msg }

func (s *Server) editPost(e *core.RequestEvent) error {
	st, sec, ok := s.section(e)
	if !ok {
		return s.notFound(e)
	}
	rec, err := s.record(e, sec)
	if err != nil {
		return s.notFound(e)
	}
	if err := e.Request.ParseMultipartForm(media.MaxBytes + 1<<20); err != nil && !errors.Is(err, http.ErrNotMultipart) {
		return e.String(http.StatusRequestEntityTooLarge, "upload too large\n")
	}
	posted := map[string]string{"status": e.Request.FormValue("status")}
	for _, fd := range sec.Fields {
		if fd.Kind != preset.KindImage {
			posted[fd.Name] = e.Request.FormValue(fd.Name)
		}
	}
	if err := s.apply(e, st, sec, rec, posted); err != nil {
		var fe formError
		msg := s.t("cabinet.save_failed")
		if errors.As(err, &fe) {
			msg = fe.msg
		} else if strings.Contains(err.Error(), "slug") {
			msg = s.t("cabinet.slug_taken")
		} else {
			s.App.Logger().Warn("cabinet save", "collection", sec.Collection, "err", err.Error())
		}
		f := s.form(st, sec, rec, posted)
		p := s.cabinetPage(e, st, f.Title)
		p.Error = msg
		return s.render(e, http.StatusUnprocessableEntity, p, screens.CabinetFormScreen(p, f))
	}
	return e.Redirect(http.StatusSeeOther, "/cabinet/"+sec.Collection+"/"+rec.Id+"?saved=1")
}

// apply validates the posted form, converts the cover to WebP and saves.
func (s *Server) apply(e *core.RequestEvent, st content.Settings, sec preset.Section, rec *core.Record, posted map[string]string) error {
	for _, fd := range sec.Fields {
		raw := strings.TrimSpace(posted[fd.Name])
		switch fd.Kind {
		case preset.KindImage:
			continue
		case preset.KindMoney:
			v, err := money.Parse(raw)
			if err != nil {
				return formError{s.t(fd.Label) + ": " + s.t("error.amount")}
			}
			rec.Set(fd.Name, v)
		case preset.KindNumber:
			n, err := strconv.Atoi(firstNonEmpty(raw, "0"))
			if err != nil {
				return formError{s.t(fd.Label) + ": " + s.t("error.number")}
			}
			rec.Set(fd.Name, n)
		case preset.KindBool:
			rec.Set(fd.Name, raw == "1")
		default:
			if fd.Required && raw == "" {
				return formError{s.t(fd.Label) + ": " + s.t("error.required")}
			}
			if fd.Max > 0 && utf8.RuneCountInString(raw) > fd.Max {
				return formError{s.Dict.F("error.too_long", "field", s.t(fd.Label), "max", strconv.Itoa(fd.Max))}
			}
			rec.Set(fd.Name, raw)
		}
	}
	slug := content.Slugify(firstNonEmpty(strings.TrimSpace(posted["slug"]), posted["title"]))
	if slug == "" {
		return formError{s.t("field.slug") + ": " + s.t("error.slug")}
	}
	posted["slug"] = slug
	rec.Set("slug", slug)
	status := posted["status"]
	if status != content.Published {
		status = content.Draft
	}
	rec.Set("status", status)
	if status == content.Published && rec.GetDateTime("published_at").IsZero() {
		rec.Set("published_at", types.NowDateTime())
	}
	if fh, hdr, err := e.Request.FormFile("cover"); err == nil {
		defer fh.Close()
		if hdr.Size > media.MaxBytes {
			return formError{media.ErrNotImage.Error()}
		}
		raw, err := io.ReadAll(io.LimitReader(fh, media.MaxBytes+1))
		if err != nil {
			return err
		}
		webp, err := media.ToWebP(raw)
		if err != nil {
			return formError{s.t("error.image")}
		}
		file, err := filesystem.NewFileFromBytes(webp, slug+".webp")
		if err != nil {
			return err
		}
		rec.Set("cover", file)
	}
	return s.App.Save(rec)
}

func (s *Server) deletePost(e *core.RequestEvent) error {
	_, sec, ok := s.section(e)
	if !ok {
		return s.notFound(e)
	}
	rec, err := s.App.FindRecordById(sec.Collection, e.Request.PathValue("id"))
	if err != nil {
		return s.notFound(e)
	}
	if err := s.App.Delete(rec); err != nil {
		return s.fail(e, err)
	}
	return e.Redirect(http.StatusSeeOther, "/cabinet/"+sec.Collection)
}

// settings (admin only)

func (s *Server) settingsPage(e *core.RequestEvent) error {
	if !auth.IsAdmin(current(e)) {
		return s.notFound(e)
	}
	st := s.settings()
	p := s.cabinetPage(e, st, s.t("settings.title"))
	return s.render(e, http.StatusOK, p, screens.SettingsScreen(p, settingsForm(st)))
}

func settingsForm(st content.Settings) screens.SettingsForm {
	return screens.SettingsForm{
		Brand: st.Brand, Tagline: st.Tagline, About: st.About,
		ContactLabel: st.ContactLabel, ContactURL: st.ContactURL,
		ContactVariant: st.ContactVariant, ContactSize: st.ContactSize, ContactNewWindow: st.ContactNewWindow,
		Currency: st.Currency, Lang: st.Lang, Preset: st.Preset,
	}
}

func (s *Server) settingsPost(e *core.RequestEvent) error {
	if !auth.IsAdmin(current(e)) {
		return s.notFound(e)
	}
	stored, _ := content.LoadSettings(s.App)
	next := stored
	next.Brand = limit(e.Request.FormValue("brand_name"), 80)
	next.Tagline = limit(e.Request.FormValue("tagline"), 200)
	next.About = limit(e.Request.FormValue("about"), 2000)
	next.ContactLabel = limit(e.Request.FormValue("contact_label"), 40)
	next.ContactURL = limit(e.Request.FormValue("contact_url"), 500)
	next.ContactVariant = e.Request.FormValue("contact_variant")
	next.ContactSize = e.Request.FormValue("contact_size")
	next.ContactNewWindow = e.Request.FormValue("contact_new_window") != ""
	next.Currency = limit(e.Request.FormValue("currency"), 3)
	next.Lang = limit(e.Request.FormValue("lang"), 8)
	var err error
	if next.Brand == "" {
		err = errors.New(s.t("settings.brand_required"))
	} else {
		err = content.SaveSettings(s.App, next)
	}
	if err == nil {
		return e.Redirect(http.StatusSeeOther, "/cabinet/settings?saved=1")
	}
	st := s.settings()
	p := s.cabinetPage(e, st, s.t("settings.title"))
	if errors.Is(err, shop.ErrContactURL) {
		p.Error = s.t("settings.contact_invalid")
	} else {
		p.Error = err.Error()
	}
	form := settingsForm(next)
	form.Preset = st.Preset
	return s.render(e, http.StatusUnprocessableEntity, p, screens.SettingsScreen(p, form))
}
