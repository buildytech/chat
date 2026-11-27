// Package content reads PocketBase records and maps them to view models
// (internal/view). It is the only package that knows both the schema and
// the view contract. Public reads return published records only.
package content

import (
	"bytes"
	"errors"
	"slices"
	"strings"
	"time"

	"github.com/microcosm-cc/bluemonday"
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"

	"github.com/fastygo/starter/internal/money"
	"github.com/fastygo/starter/internal/preset"
	"github.com/fastygo/starter/internal/shop"
	"github.com/fastygo/starter/internal/view"
)

// Status values (mirrors internal/migrations).
const (
	Draft     = "draft"
	Published = "published"
)

// ErrNotFound is returned for a missing or unpublished record.
var ErrNotFound = errors.New("content: not found")

// Settings is the site settings record.
type Settings struct {
	Preset       string
	Brand        string
	Tagline      string
	About        string
	ContactLabel string // the button text
	ContactURL   string
	// ContactVariant and ContactSize follow the UI8Kit link-button recipe;
	// ContactNewWindow opens the link with target=_blank rel=noopener noreferrer.
	ContactVariant   string
	ContactSize      string
	ContactNewWindow bool
	Currency         string
	Lang             string
}

// DefaultSettings are used before `site init` runs.
func DefaultSettings() Settings {
	return Settings{Preset: preset.Blog, Brand: "Starter", Currency: "USD", Lang: "en", ContactVariant: "default", ContactSize: "lg"}
}

// LoadSettings returns the settings record (defaults when there is none).
func LoadSettings(app core.App) (Settings, *core.Record) {
	s := DefaultSettings()
	recs, err := app.FindRecordsByFilter("settings", "", "created", 1, 0)
	if err != nil || len(recs) == 0 {
		return s, nil
	}
	r := recs[0]
	s.Preset = or(r.GetString("preset"), s.Preset)
	s.Brand = or(r.GetString("brand_name"), s.Brand)
	s.Tagline = r.GetString("tagline")
	s.About = r.GetString("about")
	s.ContactLabel = r.GetString("contact_label")
	s.ContactURL = r.GetString("contact_url")
	s.ContactVariant = or(r.GetString("contact_variant"), s.ContactVariant)
	s.ContactSize = or(r.GetString("contact_size"), s.ContactSize)
	s.ContactNewWindow = r.GetBool("contact_new_window")
	s.Currency = or(r.GetString("currency"), s.Currency)
	s.Lang = or(r.GetString("lang"), s.Lang)
	return s, r
}

// SaveSettings writes the settings record (creates it on first save). The
// contact link is validated here, so no path can store a bad scheme.
func SaveSettings(app core.App, s Settings) error {
	if !preset.Valid(s.Preset) {
		return errors.New("settings: unknown preset " + s.Preset)
	}
	if strings.TrimSpace(s.Brand) == "" {
		return errors.New("settings: brand name is required")
	}
	if s.ContactURL != "" {
		u, err := shop.ValidContactURL(s.ContactURL)
		if err != nil {
			return err
		}
		s.ContactURL = u
	}
	if !slices.Contains(view.ButtonVariants, s.ContactVariant) {
		s.ContactVariant = "default"
	}
	if !slices.Contains(view.ButtonSizes, s.ContactSize) {
		s.ContactSize = "lg"
	}
	_, rec := LoadSettings(app)
	if rec == nil {
		col, err := app.FindCollectionByNameOrId("settings")
		if err != nil {
			return err
		}
		rec = core.NewRecord(col)
	}
	rec.Set("preset", s.Preset)
	rec.Set("brand_name", strings.TrimSpace(s.Brand))
	rec.Set("tagline", strings.TrimSpace(s.Tagline))
	rec.Set("about", strings.TrimSpace(s.About))
	rec.Set("contact_label", strings.TrimSpace(s.ContactLabel))
	rec.Set("contact_url", s.ContactURL)
	rec.Set("contact_variant", s.ContactVariant)
	rec.Set("contact_size", s.ContactSize)
	rec.Set("contact_new_window", s.ContactNewWindow)
	rec.Set("currency", strings.ToUpper(strings.TrimSpace(s.Currency)))
	rec.Set("lang", strings.ToLower(strings.TrimSpace(s.Lang)))
	return app.Save(rec)
}

// Contact maps the settings to the one contact link.
func (s Settings) Contact() view.Contact {
	if s.ContactURL == "" {
		return view.Contact{}
	}
	return view.Contact{
		Label: s.ContactLabel, Href: s.ContactURL, Prefill: shop.Prefill(s.ContactURL),
		Variant: s.ContactVariant, Size: s.ContactSize, NewWindow: s.ContactNewWindow,
	}
}

// MoneySpec is the price format for the browser cart.
func (s Settings) MoneySpec() money.Spec { return money.SpecFor(s.Currency, s.Lang) }

// Price formats minor units with the site currency.
func (s Settings) Price(minor int64) string { return money.Format(minor, s.Currency, s.Lang) }

// Date formats a date for the site language.
func (s Settings) Date(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	if s.Lang == "" || s.Lang == "en" {
		return t.Format("Jan 2, 2006")
	}
	return t.Format("02.01.2006")
}

// CoverURL is the public path of a record's cover (served by /media/...).
func CoverURL(r *core.Record) string {
	f := r.GetString("cover")
	if f == "" {
		return ""
	}
	return "/media/" + r.Collection().Name + "/" + r.Id + "/" + f
}

// PublishedDate is published_at, or created when it is empty.
func PublishedDate(r *core.Record) time.Time {
	if t := r.GetDateTime("published_at"); !t.IsZero() {
		return t.Time()
	}
	return r.GetDateTime("created").Time()
}

// List returns published records of a section as cards.
func List(app core.App, sec preset.Section, s Settings, limit int) ([]view.Card, error) {
	recs, err := app.FindRecordsByFilter(sec.Collection, "status = {:s}", sec.Sort, limit, 0, dbx.Params{"s": Published})
	if err != nil {
		return nil, err
	}
	out := make([]view.Card, 0, len(recs))
	for _, r := range recs {
		out = append(out, Card(sec, s, r))
	}
	return out, nil
}

// Card maps one record to a list card.
func Card(sec preset.Section, s Settings, r *core.Record) view.Card {
	c := view.Card{
		Title:   r.GetString("title"),
		Href:    sec.Path + "/" + r.GetString("slug"),
		Excerpt: r.GetString("excerpt"),
		Image:   view.Image{Src: CoverURL(r), Alt: r.GetString("title")},
	}
	switch sec.Collection {
	case "products":
		c.Price = s.Price(int64(r.GetInt("price")))
	case "cases":
		c.Meta = r.GetString("client")
	case "services":
		c.Meta = r.GetString("price_note")
	default:
		c.Meta = s.Date(PublishedDate(r))
	}
	return c
}

// FindPublished returns one published record by slug.
func FindPublished(app core.App, collection, slug string) (*core.Record, error) {
	r, err := app.FindFirstRecordByFilter(collection, "slug = {:slug} && status = {:s}", dbx.Params{"slug": slug, "s": Published})
	if err != nil {
		return nil, ErrNotFound
	}
	return r, nil
}

// Detail maps a record to its page model. labels maps a field name to its
// display label (dictionary words) for the meta list.
func Detail(sec preset.Section, s Settings, r *core.Record, labels func(string) string) view.Detail {
	d := view.Detail{
		Slug:     r.GetString("slug"),
		Title:    r.GetString("title"),
		Excerpt:  r.GetString("excerpt"),
		BodyHTML: Markdown(r.GetString("body")),
		Image:    view.Image{Src: CoverURL(r), Alt: r.GetString("title")},
		Date:     s.Date(PublishedDate(r)),
	}
	switch sec.Collection {
	case "products":
		d.Product = true
		d.Price = s.Price(int64(r.GetInt("price")))
		d.InStock = r.GetBool("in_stock")
		d.Date = ""
	case "cases":
		for _, f := range []string{"client", "result"} {
			if v := r.GetString(f); v != "" {
				d.Meta = append(d.Meta, view.Meta{Label: labels("field." + f), Value: v})
			}
		}
	case "services":
		d.Date = ""
		if v := r.GetString("price_note"); v != "" {
			d.Meta = append(d.Meta, view.Meta{Label: labels("field.price_note"), Value: v})
		}
	case "articles":
		if v := r.GetString("tags"); v != "" {
			d.Meta = append(d.Meta, view.Meta{Label: labels("field.tags"), Value: v})
		}
	}
	return d
}

var md = goldmark.New(goldmark.WithExtensions(extension.GFM, extension.Typographer))

var policy = func() *bluemonday.Policy {
	p := bluemonday.UGCPolicy()
	p.RequireNoFollowOnLinks(true)
	p.AddTargetBlankToFullyQualifiedLinks(true)
	return p
}()

// Markdown renders markdown to sanitized HTML. goldmark drops raw HTML
// (no WithUnsafe) and bluemonday removes anything left that could script.
func Markdown(src string) string {
	if strings.TrimSpace(src) == "" {
		return ""
	}
	var buf bytes.Buffer
	if err := md.Convert([]byte(src), &buf); err != nil {
		return ""
	}
	return policy.Sanitize(buf.String())
}

// Slugify makes a slug from a title (ASCII letters and digits; other
// scripts are transliterated where a simple table exists, else dropped).
func Slugify(s string) string {
	var b strings.Builder
	dash := false
	for _, r := range strings.ToLower(s) {
		switch {
		case r >= 'a' && r <= 'z' || r >= '0' && r <= '9':
			b.WriteRune(r)
			dash = false
		default:
			if t, ok := translit[r]; ok {
				b.WriteString(t)
				dash = false
				continue
			}
			if !dash && b.Len() > 0 {
				b.WriteByte('-')
				dash = true
			}
		}
	}
	out := strings.Trim(b.String(), "-")
	if len(out) > 100 {
		out = strings.Trim(out[:100], "-")
	}
	return out
}

func or(v, def string) string {
	if v == "" {
		return def
	}
	return v
}
