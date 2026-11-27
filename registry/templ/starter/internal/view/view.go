// Package view is the contract between data and markup: typed view models
// that templ components receive. Screens and blocks never see a PocketBase
// record; internal/content maps records to these structs. Change the schema
// or the markup independently, and keep this file the single meeting point.
package view

// Site is the brand and navigation every page shares.
type Site struct {
	Brand   string
	Tagline string
	About   string
	Lang    string
	Preset  string
	BaseURL string
	Nav     []NavLink
	Contact Contact
	HasCart bool
	Year    int
}

// NavLink is one header or footer link. Label is display text.
type NavLink struct {
	Label   string
	Href    string
	Icon    string
	Current bool
}

// Contact is the one seller contact link set in the cabinet. Href is empty
// until the owner sets it.
type Contact struct {
	Label     string // button text; empty = the dictionary default
	Href      string
	Prefill   string // "mailto", "whatsapp" or "": how the order message can travel
	Variant   string // UI8Kit link-button variant
	Size      string // UI8Kit link-button size
	NewWindow bool   // target=_blank rel="noopener noreferrer"
}

// Contact button looks: the UI8Kit link-button recipe (ui/kit/compose) and
// the values of the settings migration.
var (
	ButtonVariants = []string{"default", "secondary", "outline"}
	ButtonSizes    = []string{"sm", "default", "lg"}
)

// Image is a cover. Src is empty when the record has none.
type Image struct {
	Src string
	Alt string
}

// Card is one item of a list (article, case, service, product).
type Card struct {
	Title   string
	Href    string
	Excerpt string
	Meta    string // date, client, price note
	Price   string // formatted, products only
	Image   Image
}

// Meta is a label/value pair on a detail page (client, result, tags).
type Meta struct {
	Label string
	Value string
}

// Detail is a full item page.
type Detail struct {
	Slug     string
	Title    string
	Excerpt  string
	BodyHTML string // sanitized HTML rendered from markdown
	Image    Image
	Date     string
	Meta     []Meta
	Price    string
	InStock  bool
	Product  bool
}

// CatalogItem is one product the browser cart may hold. The cart page
// embeds the catalog as JSON, so prices always come from the database and
// the browser keeps only slugs and quantities (sessionStorage).
type CatalogItem struct {
	Title string `json:"title"`
	Href  string `json:"href"`
	Price int64  `json:"price"`
	Image string `json:"image,omitempty"`
}

// Catalog is the cart page data for app.js.
type Catalog struct {
	Money    any                    `json:"money"`
	Products map[string]CatalogItem `json:"products"`
}

// Row is one record in a cabinet list.
type Row struct {
	ID        string
	Title     string
	Status    string
	Updated   string
	EditHref  string
	PublicURL string
}

// Field is one input of a generated cabinet form.
type Field struct {
	Name     string
	Label    string
	Kind     string
	Value    string
	Checked  bool
	Required bool
	Max      int
	ImageSrc string
	Help     string
}

// Form is a cabinet create/edit form.
type Form struct {
	Section   string
	Title     string
	Action    string
	Fields    []Field
	Status    string
	Error     string
	Saved     bool
	PublicURL string
	DeleteURL string
	IsNew     bool
}

// Stat is a dashboard counter.
type Stat struct {
	Label string
	Value string
	Href  string
	Icon  string
}

// User is the signed-in cabinet user.
type User struct {
	Email string
	Name  string
	Role  string
	Admin bool
}
