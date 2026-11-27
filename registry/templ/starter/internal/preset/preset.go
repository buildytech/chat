// Package preset defines the three site presets and the content sections
// each one turns on. A section is one PocketBase collection plus its public
// routes and its cabinet screens; the cabinet form is generated from the
// section's Fields, so adding a field here (and in a migration) is enough to
// edit it.
package preset

import "slices"

// Names of the presets.
const (
	Blog      = "blog"
	Corporate = "corporate"
	Shop      = "shop"
)

// All lists the presets in display order.
var All = []string{Blog, Corporate, Shop}

// Valid reports whether name is a preset.
func Valid(name string) bool { return slices.Contains(All, name) }

// Kind is how a field is stored and edited.
type Kind string

// Field kinds understood by the cabinet form and the record mapper.
const (
	KindText     Kind = "text"     // one line
	KindTextarea Kind = "textarea" // plain multi-line
	KindMarkdown Kind = "markdown" // body, rendered to sanitized HTML
	KindMoney    Kind = "money"    // integer minor units, edited as 19.90
	KindNumber   Kind = "number"   // integer
	KindBool     Kind = "bool"
	KindImage    Kind = "image" // one WebP cover in a PocketBase file field
)

// Field is one editable column of a section. Label is a dictionary key.
type Field struct {
	Name     string
	Label    string
	Kind     Kind
	Required bool
	Max      int // max length for text kinds (0: no limit beyond the schema)
}

// Section is one content type.
type Section struct {
	Collection string // PocketBase collection name
	Path       string // public list path, e.g. /articles; detail is Path + "/{slug}"
	Label      string // dictionary key of the plural name
	Singular   string // dictionary key of the singular name
	Icon       string // Lucide icon name for the cabinet nav
	Fields     []Field
	Sort       string // PocketBase sort expression of the public list
}

// Common fields every content section has, in form order.
var commonHead = []Field{
	{Name: "title", Label: "field.title", Kind: KindText, Required: true, Max: 200},
	{Name: "slug", Label: "field.slug", Kind: KindText, Max: 120},
	{Name: "excerpt", Label: "field.excerpt", Kind: KindTextarea, Max: 500},
}

var commonTail = []Field{
	{Name: "body", Label: "field.body", Kind: KindMarkdown, Max: 100000},
	{Name: "cover", Label: "field.cover", Kind: KindImage},
}

func fields(extra ...Field) []Field {
	out := slices.Clone(commonHead)
	out = append(out, extra...)
	return append(out, commonTail...)
}

// Sections, by collection.
var (
	Articles = Section{
		Collection: "articles", Path: "/articles", Label: "section.articles", Singular: "section.article", Icon: "newspaper",
		Fields: fields(Field{Name: "tags", Label: "field.tags", Kind: KindText, Max: 200}),
		Sort:   "-published_at,-created",
	}
	Cases = Section{
		Collection: "cases", Path: "/cases", Label: "section.cases", Singular: "section.case", Icon: "briefcase",
		Fields: fields(
			Field{Name: "client", Label: "field.client", Kind: KindText, Max: 120},
			Field{Name: "result", Label: "field.result", Kind: KindText, Max: 200},
		),
		Sort: "-published_at,-created",
	}
	Services = Section{
		Collection: "services", Path: "/services", Label: "section.services", Singular: "section.service", Icon: "layers",
		Fields: fields(
			Field{Name: "price_note", Label: "field.price_note", Kind: KindText, Max: 80},
			Field{Name: "sort", Label: "field.sort", Kind: KindNumber},
		),
		Sort: "sort,title",
	}
	Products = Section{
		Collection: "products", Path: "/products", Label: "section.products", Singular: "section.product", Icon: "package",
		Fields: fields(
			Field{Name: "price", Label: "field.price", Kind: KindMoney, Required: true},
			Field{Name: "in_stock", Label: "field.in_stock", Kind: KindBool},
		),
		Sort: "-published_at,-created",
	}
)

// ContentCollections are every collection that holds publishable content.
var ContentCollections = []string{"articles", "cases", "services", "products"}

// Sections returns the content sections of a preset, in nav order.
func Sections(name string) []Section {
	switch name {
	case Corporate:
		return []Section{Services, Cases, Articles}
	case Shop:
		return []Section{Products, Articles}
	default:
		return []Section{Articles}
	}
}

// Find returns the section of a preset by collection name.
func Find(name, collection string) (Section, bool) {
	for _, s := range Sections(name) {
		if s.Collection == collection {
			return s, true
		}
	}
	return Section{}, false
}

// HasContactPage reports whether the preset has a /contact page (the one
// contact button with the about text; nothing is collected).
func HasContactPage(name string) bool { return name == Corporate }

// HasCart reports whether the preset has the cart and the order request page.
func HasCart(name string) bool { return name == Shop }
