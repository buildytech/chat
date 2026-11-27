// Package blocks is the layouts layer of the starter: site header and
// footer, hero, card grid, contact card, order panel and the cabinet
// pieces. Every block opens on one compose.Block, is built only from UI8Kit
// primitives (retag via Tag / As), takes its words through props and keeps
// the 8+4 spacing grid (even Tailwind steps; odd steps only inside
// controls). Repeated parts (cards, rows) live in their own files.
package blocks

import "github.com/fastygo/starter/internal/view"

// HeaderProps configures SiteHeader.
type HeaderProps struct {
	Brand     string
	HomeHref  string
	Nav       []view.NavLink
	NavLabel  string
	MenuLabel string
	ShowCart  bool
	CartLabel string
	CartHref  string
	CartCount int
	Cabinet   view.NavLink
}

// FooterProps configures SiteFooter.
type FooterProps struct {
	Brand     string
	About     string
	Nav       []view.NavLink
	NavLabel  string
	Copyright string
	Cabinet   view.NavLink
}

// HeroProps configures Hero.
type HeroProps struct {
	Eyebrow        string
	Title          string
	Lead           string
	PrimaryLabel   string
	PrimaryHref    string
	SecondaryLabel string
	SecondaryHref  string
}

// SectionHeaderProps configures SectionHeader.
type SectionHeaderProps struct {
	Title     string
	Lead      string
	LinkLabel string
	LinkHref  string
	As        string
}

// CardGridProps configures CardGrid.
type CardGridProps struct {
	Label     string
	Cards     []view.Card
	Cols      string // grid cols token, default 3
	EmptyText string
	NoImage   string
}

// ContactCardProps configures ContactCard: the store card with the one
// contact button. ButtonID marks the button for the order page script.
type ContactCardProps struct {
	Title       string
	Brand       string
	About       string
	ButtonLabel string
	Href        string
	Prefill     string
	Variant     string // UI8Kit link-button variant (default, secondary, outline)
	Size        string // UI8Kit link-button size (sm, default, lg)
	NewWindow   bool   // target=_blank with rel="noopener noreferrer"
	ButtonID    string
	Subject     string
	EmptyText   string
}

// EmptyStateProps configures EmptyState.
type EmptyStateProps struct {
	Icon        string
	Title       string
	Text        string
	ActionLabel string
	ActionHref  string
}

// OrderPanelProps configures OrderPanel (message + copy button).
type OrderPanelProps struct {
	Title       string
	Help        string
	CopyLabel   string
	CopiedLabel string
	FieldLabel  string
	// Message lines (app.js builds the text in the browser).
	Greeting, Items, Total, Name, Contact, Note string
}

// CabinetNavProps configures CabinetNav.
type CabinetNavProps struct {
	Label string
	Items []view.NavLink
}

// RecordTableProps configures RecordTable.
type RecordTableProps struct {
	Caption    string
	Rows       []view.Row
	TitleHead  string
	StatusHead string
	DateHead   string
	EditLabel  string
	ViewLabel  string
	EmptyText  string
	Status     func(string) string
}

// FormFieldProps configures FormField: one generated cabinet input.
type FormFieldProps struct {
	Field        view.Field
	ImageAlt     string
	KeepImageMsg string
}
