// Package ui8kitcatalog records UI8Kit commerce block component+variant ids
// extracted from codegen-x/ui8kit catalog.json (format 2, version 3.0.0,
// inspected path: itgarage-theme/.../ui8kit/twig/catalog.json).
// These are selection identifiers for agent provenance — Creator Preview still
// renders Page DTO kinds (nav/hero/menu/…).
package ui8kitcatalog

// Selection is one catalog block variant the agent may cite.
type Selection struct {
	ComponentID string `json:"componentId"`
	VariantID   string `json:"variantId"`
	MapsToKind  string `json:"mapsToKind"` // Page DTO kind
}

// CatalogMeta records the inspected catalog tip.
var CatalogMeta = map[string]string{
	"id":      "ui8kit",
	"format":  "2",
	"version": "3.0.0",
	"source":  "ui8kit/twig/catalog.json (codegen-x/ui8kit tree)",
}

// CommerceAllowlist is the curated subset for food/landing drafts.
// Variant ids are real catalog.variants[].id values (not invented).
var CommerceAllowlist = []Selection{
	{ComponentID: "pagehead", VariantID: "start", MapsToKind: "hero"},
	{ComponentID: "pagehead", VariantID: "center", MapsToKind: "hero"},
	{ComponentID: "hero", VariantID: "centered", MapsToKind: "hero"},
	{ComponentID: "hero", VariantID: "split", MapsToKind: "hero"},
	{ComponentID: "hero", VariantID: "shop", MapsToKind: "hero"},
	{ComponentID: "navbar", VariantID: "inline", MapsToKind: "nav"},
	{ComponentID: "products", VariantID: "grid3", MapsToKind: "menu"},
	{ComponentID: "products", VariantID: "catalog", MapsToKind: "menu"},
	{ComponentID: "products", VariantID: "list", MapsToKind: "menu"},
	{ComponentID: "cta", VariantID: "banner", MapsToKind: "cta"},
	{ComponentID: "cta", VariantID: "shop", MapsToKind: "cta"},
	{ComponentID: "delivery", VariantID: "full", MapsToKind: "cta"},
	{ComponentID: "delivery", VariantID: "facts", MapsToKind: "cta"},
	{ComponentID: "footer", VariantID: "minimal", MapsToKind: "footer"},
}

// FormatForPrompt returns a compact agent instruction fragment.
func FormatForPrompt() string {
	s := "UI8Kit commerce variants (cite in block.summary as ui8kit/<id>/<variant>):\n"
	for _, x := range CommerceAllowlist {
		s += "- " + x.ComponentID + "/" + x.VariantID + " → kind " + x.MapsToKind + "\n"
	}
	return s
}
