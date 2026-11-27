package web

import (
	"net/http"
	"strings"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"

	"github.com/fastygo/starter/internal/content"
	"github.com/fastygo/starter/internal/preset"
	"github.com/fastygo/starter/internal/view"
	"github.com/fastygo/starter/internal/web/screens"
	"github.com/fastygo/starter/ui/blocks"
)

func (s *Server) home(e *core.RequestEvent) error {
	st := s.settings()
	p := s.page(e, st, st.Brand, st.Tagline)
	key := "home." + st.Preset + "."
	h := screens.Home{Hero: blocks.HeroProps{
		Eyebrow: s.t(key + "eyebrow"),
		Title:   firstNonEmpty(st.Tagline, s.t(key+"title")),
		Lead:    s.t(key + "lead"),
	}}
	secs := preset.Sections(st.Preset)
	if len(secs) > 0 {
		h.Hero.PrimaryLabel, h.Hero.PrimaryHref = s.t(key+"cta"), secs[0].Path
	}
	if preset.HasContactPage(st.Preset) {
		h.Hero.SecondaryLabel, h.Hero.SecondaryHref = s.t("nav.contact"), "/contact"
	} else if len(secs) > 1 {
		h.Hero.SecondaryLabel, h.Hero.SecondaryHref = s.t(secs[1].Label), secs[1].Path
	}
	for i, sec := range secs {
		limit, cols := 3, "3"
		if sec.Collection == "products" {
			limit, cols = 8, "4"
		}
		if st.Preset == preset.Blog {
			limit = 6
		}
		cards, err := content.List(s.App, sec, st, limit)
		if err != nil {
			return s.fail(e, err)
		}
		if i > 0 && len(cards) == 0 {
			continue
		}
		h.Sections = append(h.Sections, screens.HomeSection{
			Title: s.t(sec.Label), Lead: s.t("lead." + sec.Collection), LinkLabel: s.t("list.all"), LinkHref: sec.Path,
			Label: s.t(sec.Label), Cards: cards, Cols: cols,
		})
	}
	h.ShowStore = preset.HasCart(st.Preset)
	return s.render(e, http.StatusOK, p, screens.HomeScreen(p, h))
}

func (s *Server) list(col string) func(*core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		st := s.settings()
		sec, ok := preset.Find(st.Preset, col)
		if !ok {
			return s.notFound(e)
		}
		cards, err := content.List(s.App, sec, st, 200)
		if err != nil {
			return s.fail(e, err)
		}
		cols := "3"
		if col == "products" {
			cols = "4"
		}
		p := s.page(e, st, s.t(sec.Label), s.t("lead."+col))
		return s.render(e, http.StatusOK, p, screens.ListScreen(p, screens.List{Title: s.t(sec.Label), Lead: s.t("lead." + col), Label: s.t(sec.Label), Cards: cards, Cols: cols}))
	}
}

func (s *Server) detail(col string) func(*core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		st := s.settings()
		sec, ok := preset.Find(st.Preset, col)
		if !ok {
			return s.notFound(e)
		}
		rec, err := content.FindPublished(s.App, col, e.Request.PathValue("slug"))
		if err != nil {
			return s.notFound(e)
		}
		d := content.Detail(sec, st, rec, s.t)
		p := s.page(e, st, d.Title, d.Excerpt)
		if d.Image.Src != "" {
			p.OGImage = p.Site.BaseURL + d.Image.Src
		}
		data := screens.Detail{Item: d, BackHref: sec.Path, BackLabel: s.t(sec.Label)}
		return s.render(e, http.StatusOK, p, screens.DetailScreen(p, data))
	}
}

// contact (corporate): the about text and the one contact button.
func (s *Server) contact(e *core.RequestEvent) error {
	st := s.settings()
	if !preset.HasContactPage(st.Preset) {
		return s.notFound(e)
	}
	p := s.page(e, st, s.t("contact.title"), s.t("contact.lead"))
	return s.render(e, http.StatusOK, p, screens.ContactScreen(p))
}

// cart renders the cart and order request page. The cart itself is in the
// browser; this page only carries the catalog (published, in-stock
// products with their database prices) and the message words.
func (s *Server) cart(e *core.RequestEvent) error {
	st := s.settings()
	if !preset.HasCart(st.Preset) {
		return s.notFound(e)
	}
	recs, err := s.App.FindAllRecords("products", dbx.HashExp{"status": content.Published, "in_stock": true})
	if err != nil {
		return s.fail(e, err)
	}
	cat := view.Catalog{Money: st.MoneySpec(), Products: make(map[string]view.CatalogItem, len(recs))}
	for _, r := range recs {
		slug := r.GetString("slug")
		cat.Products[slug] = view.CatalogItem{Title: r.GetString("title"), Href: "/products/" + slug, Price: int64(r.GetInt("price")), Image: content.CoverURL(r)}
	}
	data := screens.Cart{
		Catalog: cat,
		Subject: s.Dict.F("order.subject", "brand", st.Brand),
		Order: blocks.OrderPanelProps{
			Title: s.t("order.step_message"), Help: s.t("order.message_help"), FieldLabel: s.t("order.message"),
			CopyLabel: s.t("order.copy"), CopiedLabel: s.t("order.copied"),
			Greeting: strings.ReplaceAll(s.t("order.msg_greeting"), "{brand}", st.Brand),
			Items:    s.t("order.msg_items"), Total: s.t("cart.total"),
			Name: s.t("order.msg_name"), Contact: s.t("order.msg_contact"), Note: s.t("order.msg_note"),
		},
	}
	p := s.page(e, st, s.t("order.title"), "")
	p.NoIndex = true
	return s.render(e, http.StatusOK, p, screens.CartScreen(p, data))
}

func limit(v string, max int) string {
	v = strings.TrimSpace(v)
	if r := []rune(v); len(r) > max {
		return string(r[:max])
	}
	return v
}

func firstNonEmpty(v ...string) string {
	for _, s := range v {
		if s != "" {
			return s
		}
	}
	return ""
}
