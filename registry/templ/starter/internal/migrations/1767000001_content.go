package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(upContent, downContent)
}

// Statuses of a content record. Only published records reach public pages.
const (
	StatusDraft     = "draft"
	StatusPublished = "published"
)

// SlugPattern is the slug format of every content record.
const SlugPattern = `^[a-z0-9]+(?:-[a-z0-9]+)*$`

// CoverMimeTypes: the cabinet converts uploads to WebP before saving.
var CoverMimeTypes = []string{"image/webp"}

func text(name string, required bool, max int) *core.TextField {
	return &core.TextField{Name: name, Required: required, Max: max}
}

func timestamps(c *core.Collection) {
	c.Fields.Add(&core.AutodateField{Name: "created", OnCreate: true})
	c.Fields.Add(&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true})
}

// contentCollection is the shared shape of articles, cases, services and
// products: title, slug, excerpt, markdown body, WebP cover, status.
func contentCollection(name string, extra ...core.Field) *core.Collection {
	c := core.NewBaseCollection(name)
	c.Fields.Add(
		text("title", true, 200),
		&core.TextField{Name: "slug", Required: true, Max: 120, Pattern: SlugPattern},
		text("excerpt", false, 500),
		text("body", false, 100000),
		&core.FileField{Name: "cover", MaxSelect: 1, MaxSize: 8 << 20, MimeTypes: CoverMimeTypes, Thumbs: []string{}},
		&core.SelectField{Name: "status", Required: true, MaxSelect: 1, Values: []string{StatusDraft, StatusPublished}},
		&core.DateField{Name: "published_at"},
	)
	c.Fields.Add(extra...)
	timestamps(c)
	c.AddIndex("idx_"+name+"_slug", true, "slug", "")
	c.AddIndex("idx_"+name+"_status", false, "status, published_at", "")
	return c
}

func upContent(app core.App) error {
	cols := []*core.Collection{
		contentCollection("articles", text("tags", false, 200)),
		contentCollection("cases", text("client", false, 120), text("result", false, 200)),
		contentCollection("services", text("price_note", false, 80), &core.NumberField{Name: "sort", OnlyInt: true}),
		contentCollection("products", &core.NumberField{Name: "price", OnlyInt: true, Min: ptr(0.0)}, &core.BoolField{Name: "in_stock"}),
	}

	settings := core.NewBaseCollection("settings")
	settings.Fields.Add(
		&core.SelectField{Name: "preset", Required: true, MaxSelect: 1, Values: []string{"blog", "corporate", "shop"}},
		text("brand_name", true, 80),
		text("tagline", false, 200),
		text("about", false, 2000),
		text("contact_label", false, 40),
		text("contact_url", false, 500),
		text("currency", false, 3),
		text("lang", false, 8),
	)
	timestamps(settings)
	cols = append(cols, settings)

	for _, c := range cols {
		if err := app.Save(c); err != nil {
			return err
		}
	}
	return nil
}

func downContent(app core.App) error {
	for _, name := range []string{"settings", "products", "services", "cases", "articles"} {
		c, err := app.FindCollectionByNameOrId(name)
		if err != nil {
			continue
		}
		if err := app.Delete(c); err != nil {
			return err
		}
	}
	return nil
}

func ptr[T any](v T) *T { return &v }
