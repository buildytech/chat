package screens

import (
	c "github.com/ui8kit/codegen/generated/templ/compose"
	selectfield "github.com/ui8kit/codegen/generated/templ/ui/select"

	"github.com/fastygo/starter/internal/view"
)

// Login is the sign-in page state.
type Login struct {
	Email string
	Error string
	Next  string
}

// CabinetList is a section list in the cabinet.
type CabinetList struct {
	Title   string
	NewHref string
	Rows    []view.Row
}

// SettingsForm is the site settings page state (admin only).
type SettingsForm struct {
	Brand        string
	Tagline      string
	About        string
	ContactLabel string
	ContactURL   string
	// contact button look (UI8Kit link-button recipe)
	ContactVariant   string
	ContactSize      string
	ContactNewWindow bool
	Currency         string
	Lang             string
	Preset           string
	Saved            bool
	Error            string
}

// buttonClasses maps "variant|size" to the UI8Kit link-button classes, so
// the settings preview can restyle the button without a request.
func buttonClasses() map[string]string {
	out := map[string]string{}
	for _, v := range view.ButtonVariants {
		for _, sz := range view.ButtonSizes {
			out[v+"|"+sz] = c.Join(c.Rc("link-button", map[string]string{"variant": v, "size": sz}), "w-full")
		}
	}
	return out
}

func buttonVariantOptions(p Page) []selectfield.SelectOptionItem {
	out := make([]selectfield.SelectOptionItem, 0, len(view.ButtonVariants))
	for _, v := range view.ButtonVariants {
		out = append(out, selectfield.SelectOptionItem{Value: v, Label: p.T("button.variant." + v)})
	}
	return out
}

func buttonSizeOptions(p Page) []selectfield.SelectOptionItem {
	out := make([]selectfield.SelectOptionItem, 0, len(view.ButtonSizes))
	for _, v := range view.ButtonSizes {
		out = append(out, selectfield.SelectOptionItem{Value: v, Label: p.T("button.size." + v)})
	}
	return out
}

func previewHref(u string) string {
	if u == "" {
		return "#"
	}
	return u
}

func previewLabel(p Page, label string) string {
	if label != "" {
		return label
	}
	return p.T("store.contact")
}
