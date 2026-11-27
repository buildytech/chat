package screens

import (
	"strconv"

	"github.com/fastygo/starter/internal/view"
	"github.com/fastygo/starter/ui/blocks"
)

// HomeSection is one teaser list on the home page.
type HomeSection struct {
	Title     string
	Lead      string
	LinkLabel string
	LinkHref  string
	Label     string
	Cards     []view.Card
	Cols      string
}

// Home is the home page data.
type Home struct {
	Hero      blocks.HeroProps
	Sections  []HomeSection
	ShowStore bool
}

// List is a section list page.
type List struct {
	Title string
	Lead  string
	Label string
	Cards []view.Card
	Cols  string
}

// Detail is an item page.
type Detail struct {
	Item      view.Detail
	BackHref  string
	BackLabel string
}

func itoa(n int) string { return strconv.Itoa(n) }
