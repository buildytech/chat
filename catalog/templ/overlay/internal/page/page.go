// Package page is the home page designed in BuildY Chat. page.json holds the page as the chat renders it: each block
// is a UI8Kit registry item with its props (the JSON shapes its templ block takes). sections_gen.go maps every
// registry block of ui/kit/ui8kit.lock.json to its templ component; it is generated (go generate ./internal/page),
// never edited. Change the page by editing page.json; add a block with `ui8kit add <item>` in ui/kit, then go generate.
package page

//go:generate go run ./gen

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"io"
	"sync"

	"github.com/a-h/templ"
)

//go:embed page.json
var raw []byte

// Block is one block of the page: the registry item, the chat's variant and the props the block renders.
type Block struct {
	ID      string          `json:"id"`
	Item    string          `json:"item"`
	Variant string          `json:"variant,omitempty"`
	Props   json.RawMessage `json:"props"`
}

// Doc is page.json.
type Doc struct {
	Format string `json:"format"`
	Title  string `json:"title"`
	Locale string `json:"locale"`
	Preset string `json:"preset"`
	SEO    struct {
		Title       string `json:"title"`
		Description string `json:"description"`
	} `json:"seo"`
	Blocks []Block `json:"blocks"`
}

// Format is the page.json format this package reads.
const Format = "buildy.templ-page.v1"

var load = sync.OnceValues(func() (Doc, error) {
	var d Doc
	if err := json.Unmarshal(raw, &d); err != nil {
		return d, fmt.Errorf("page.json: %w", err)
	}
	if d.Format != Format {
		return d, fmt.Errorf("page.json: format %q, want %q", d.Format, Format)
	}
	return d, nil
})

// Load reads page.json (once).
func Load() (Doc, error) { return load() }

// Preset is the starter preset chosen in the chat export (blog, corporate or shop); empty when page.json is broken.
func Preset() string {
	d, _ := load()
	return d.Preset
}

// Blocks renders the blocks of the page in order.
func Blocks() templ.Component {
	return templ.ComponentFunc(func(ctx context.Context, w io.Writer) error {
		d, err := load()
		if err != nil {
			return err
		}
		for _, b := range d.Blocks {
			c, err := component(b.Item, b.Props)
			if err != nil {
				return fmt.Errorf("page.json block %q: %w", b.ID, err)
			}
			if err := c.Render(ctx, w); err != nil {
				return err
			}
		}
		return nil
	})
}
