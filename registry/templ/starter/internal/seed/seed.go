// Package seed adds demo content for a preset (local development only; the
// CLI refuses production). Covers are generated WebP images, so the repo
// ships no stock photos.
package seed

import (
	"fmt"
	"image"
	"image/color"
	"math"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/filesystem"
	"github.com/pocketbase/pocketbase/tools/types"

	"github.com/fastygo/starter/internal/content"
	"github.com/fastygo/starter/internal/media"
	"github.com/fastygo/starter/internal/preset"
)

type item struct {
	Title, Excerpt, Body string
	Extra                map[string]any
}

const body = `This is demo content from ` + "`site demo seed`" + `. Edit or delete it in the cabinet.

## Why it is here

Every preset starts with a few records so that you can see the layout, the cards and the detail page before writing real content.

- Text is **markdown**, rendered to sanitized HTML.
- Covers are converted to WebP on upload.
- Only *published* records appear on the site.

> Replace this text with your own story.`

var articles = []item{
	{"Launching our new website", "A short note on why we rebuilt the site as one small Go binary.", body, map[string]any{"tags": "news, website"}},
	{"How we choose what to write about", "Three questions we ask before starting any article.", body, map[string]any{"tags": "writing"}},
	{"A week in the studio", "What a normal week looks like for a small team.", body, map[string]any{"tags": "team"}},
	{"Five tools we use every day", "The short list of software that keeps the lights on.", body, map[string]any{"tags": "tools"}},
	{"Lessons from our first year", "What worked, what did not, and what we would do again.", body, map[string]any{"tags": "story"}},
	{"Answers to common questions", "The questions we hear most, answered in one place.", body, map[string]any{"tags": "faq"}},
}

var services = []item{
	{"Strategy", "Workshops that turn a vague goal into a clear plan.", body, map[string]any{"price_note": "from $1,200", "sort": 1}},
	{"Design", "Interfaces and brand systems that people enjoy using.", body, map[string]any{"price_note": "from $2,400", "sort": 2}},
	{"Development", "Fast, accessible websites built to last.", body, map[string]any{"price_note": "from $3,600", "sort": 3}},
}

var cases = []item{
	{"A booking site for a city clinic", "Online booking cut phone calls by half in two months.", body, map[string]any{"client": "City Clinic", "result": "-50% phone calls"}},
	{"A catalog for a furniture maker", "A simple catalog that brings in qualified requests.", body, map[string]any{"client": "Oak and Pine", "result": "3x more requests"}},
	{"A new identity for a coffee roaster", "A brand refresh across packaging and the web.", body, map[string]any{"client": "Morning Roast", "result": "+30% repeat orders"}},
}

var products = []item{
	{"Ceramic mug", "Hand-glazed stoneware mug, 350 ml.", body, map[string]any{"price": 1800, "in_stock": true}},
	{"Linen tote bag", "Sturdy natural linen bag for every day.", body, map[string]any{"price": 2400, "in_stock": true}},
	{"Notebook, dotted", "A5 notebook with 160 dotted pages.", body, map[string]any{"price": 1250, "in_stock": true}},
	{"Desk lamp", "Warm light, brass finish, dimmable.", body, map[string]any{"price": 8900, "in_stock": true}},
	{"Wool throw", "Soft merino throw, 130 x 170 cm.", body, map[string]any{"price": 12000, "in_stock": true}},
	{"Scented candle", "Cedar and fig, 40 hours of burn time.", body, map[string]any{"price": 2200, "in_stock": false}},
	{"Wall calendar", "Twelve illustrated months on recycled paper.", body, map[string]any{"price": 1500, "in_stock": true}},
	{"Plant pot", "Terracotta pot with saucer, 14 cm.", body, map[string]any{"price": 1900, "in_stock": true}},
}

var brands = map[string]content.Settings{
	preset.Blog:      {Brand: "Northwind Journal", Tagline: "Notes on making things, one article at a time", About: "A small independent blog about craft, tools and the people behind them."},
	preset.Corporate: {Brand: "Northwind Studio", Tagline: "We design and build websites that work", About: "A small studio for strategy, design and development. Based anywhere, working everywhere.", ContactLabel: "Email the studio", ContactURL: "mailto:studio@example.com", ContactVariant: "default", ContactSize: "lg"},
	preset.Shop:      {Brand: "Northwind Goods", Tagline: "Useful things for home and desk", About: "A small shop of everyday goods. Add items to the cart and send us the order request.", ContactLabel: "Contact via Email", ContactURL: "mailto:hello@example.com", ContactVariant: "default", ContactSize: "lg"},
}

// Covers turns generated cover images on (tests switch it off for speed).
var Covers = true

// Run seeds the preset; it skips collections that already have records
// (reset deletes their records first). It returns the number of records added.
func Run(app core.App, name string, reset bool) (int, error) {
	st, _ := content.LoadSettings(app)
	if st.Brand == content.DefaultSettings().Brand || reset {
		b := brands[name]
		st.Brand, st.Tagline, st.About = b.Brand, b.Tagline, b.About
		if st.ContactURL == "" || reset {
			st.ContactLabel, st.ContactURL = b.ContactLabel, b.ContactURL
			st.ContactVariant, st.ContactSize, st.ContactNewWindow = b.ContactVariant, b.ContactSize, false
		}
	}
	st.Preset = name
	if err := content.SaveSettings(app, st); err != nil {
		return 0, err
	}
	data := map[string][]item{"articles": articles, "services": services, "cases": cases, "products": products}
	added := 0
	for _, sec := range preset.Sections(name) {
		items := data[sec.Collection]
		if name != preset.Blog && sec.Collection == "articles" {
			items = items[:3]
		}
		n, err := fill(app, sec.Collection, items, reset)
		if err != nil {
			return added, err
		}
		added += n
	}
	return added, nil
}

func fill(app core.App, collection string, items []item, reset bool) (int, error) {
	col, err := app.FindCollectionByNameOrId(collection)
	if err != nil {
		return 0, err
	}
	if reset {
		recs, err := app.FindAllRecords(collection)
		if err != nil {
			return 0, err
		}
		for _, r := range recs {
			if err := app.Delete(r); err != nil {
				return 0, err
			}
		}
	} else if n, _ := app.CountRecords(collection); n > 0 {
		return 0, nil
	}
	now := time.Now().UTC()
	for i, it := range items {
		rec := core.NewRecord(col)
		slug := content.Slugify(it.Title)
		rec.Set("title", it.Title)
		rec.Set("slug", slug)
		rec.Set("excerpt", it.Excerpt)
		rec.Set("body", it.Body)
		rec.Set("status", content.Published)
		dt, _ := types.ParseDateTime(now.Add(-time.Duration(i) * 72 * time.Hour))
		rec.Set("published_at", dt)
		for k, v := range it.Extra {
			rec.Set(k, v)
		}
		if Covers {
			webp, err := media.Encode(cover(collection, i))
			if err != nil {
				return i, err
			}
			f, err := filesystem.NewFileFromBytes(webp, slug+".webp")
			if err != nil {
				return i, err
			}
			rec.Set("cover", f)
		}
		if err := app.Save(rec); err != nil {
			return i, fmt.Errorf("seed %s %q: %w", collection, it.Title, err)
		}
	}
	return len(items), nil
}

// cover draws a soft two-color gradient with circles (960x540).
func cover(collection string, i int) image.Image {
	const w, h = 960, 540
	palettes := map[string][][2]color.NRGBA{
		"articles": {{{0xf4, 0xe9, 0xd8, 255}, {0xd9, 0x8c, 0x5f, 255}}, {{0xe3, 0xee, 0xf5, 255}, {0x5b, 0x8d, 0xb8, 255}}, {{0xe9, 0xf2, 0xe4, 255}, {0x6f, 0x9e, 0x6a, 255}}},
		"products": {{{0xf6, 0xf1, 0xea, 255}, {0xb8, 0x8b, 0x5a, 255}}, {{0xee, 0xec, 0xf6, 255}, {0x7c, 0x6f, 0xb8, 255}}, {{0xf3, 0xe6, 0xe6, 255}, {0xc0, 0x60, 0x60, 255}}},
		"cases":    {{{0xe6, 0xef, 0xf3, 255}, {0x2f, 0x5d, 0x7c, 255}}, {{0xf1, 0xee, 0xe4, 255}, {0x8a, 0x7a, 0x3c, 255}}},
		"services": {{{0xec, 0xec, 0xec, 255}, {0x3a, 0x3a, 0x3a, 255}}, {{0xe8, 0xf1, 0xee, 255}, {0x3f, 0x7f, 0x6f, 255}}},
	}
	pal := palettes[collection]
	pair := pal[i%len(pal)]
	img := image.NewNRGBA(image.Rect(0, 0, w, h))
	cx, cy := float64(w)*(0.3+0.1*float64(i%4)), float64(h)*(0.4+0.08*float64(i%3))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			t := (float64(x)/w*0.6 + float64(y)/h*0.4)
			d := math.Hypot(float64(x)-cx, float64(y)-cy)
			if d < 140+float64(i%3)*30 {
				t = math.Min(1, t+0.35)
			}
			img.SetNRGBA(x, y, mix(pair[0], pair[1], t))
		}
	}
	return img
}

func mix(a, b color.NRGBA, t float64) color.NRGBA {
	l := func(x, y uint8) uint8 { return uint8(float64(x)*(1-t) + float64(y)*t) }
	return color.NRGBA{l(a.R, b.R), l(a.G, b.G), l(a.B, b.B), 255}
}
