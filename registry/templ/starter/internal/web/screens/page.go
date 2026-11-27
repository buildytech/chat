// Package screens is the apps layer: full pages assembled from ui/blocks
// and UI8Kit primitives. Screens may brand freely (no 8+4 check), but they
// still use primitives only, tokens for colors, Lucide icons and words
// from the dictionary (Page.T).
package screens

import (
	"strconv"

	"github.com/fastygo/starter/internal/view"
	"github.com/fastygo/starter/ui/blocks"
)

// Page is the shell data of every screen.
type Page struct {
	Site        view.Site
	T           func(string) string
	Nonce       string
	Title       string
	Description string
	Canonical   string
	OGImage     string
	NoIndex     bool
	User        *view.User
	CabinetNav  []view.NavLink
	Flash       string
	Error       string
}

func (p Page) pageTitle() string {
	if p.Title == "" || p.Title == p.Site.Brand {
		return p.Site.Brand
	}
	return p.Title + " | " + p.Site.Brand
}

func (p Page) description() string {
	if p.Description != "" {
		return p.Description
	}
	return p.Site.Tagline
}

func (p Page) lang() string {
	if p.Site.Lang == "" {
		return "en"
	}
	return p.Site.Lang
}

func (p Page) header() blocks.HeaderProps {
	return blocks.HeaderProps{
		Brand: p.Site.Brand, HomeHref: "/", Nav: p.Site.Nav, NavLabel: p.T("nav.label"), MenuLabel: p.T("nav.menu"),
		ShowCart: p.Site.HasCart, CartLabel: p.T("cart.title"), CartHref: "/cart",
		Cabinet: view.NavLink{Label: p.T("nav.cabinet"), Href: "/cabinet"},
	}
}

func (p Page) footer() blocks.FooterProps {
	return blocks.FooterProps{
		Brand: p.Site.Brand, About: p.Site.About, Nav: p.Site.Nav, NavLabel: p.T("nav.footer"),
		Copyright: "\u00a9 " + strconv.Itoa(p.Site.Year) + " " + p.Site.Brand + ". " + p.T("footer.rights"),
		Cabinet:   view.NavLink{Label: p.T("nav.cabinet"), Href: "/cabinet"},
	}
}

func (p Page) contactCard() blocks.ContactCardProps {
	return blocks.ContactCardProps{
		Title: p.T("store.title"), Brand: p.Site.Brand, About: p.Site.About,
		ButtonLabel: p.contactLabel(), Href: p.Site.Contact.Href, Prefill: p.Site.Contact.Prefill,
		Variant: p.Site.Contact.Variant, Size: p.Site.Contact.Size, NewWindow: p.Site.Contact.NewWindow,
		EmptyText: p.T("store.no_contact"),
	}
}

func (p Page) contactLabel() string {
	if p.Site.Contact.Label != "" {
		return p.Site.Contact.Label
	}
	return p.T("store.contact")
}
