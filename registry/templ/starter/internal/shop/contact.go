// Package shop holds the rules of the one seller contact link. The cart
// itself lives in the browser (app.js, sessionStorage); the server never
// stores or receives anything a visitor types.
package shop

import (
	"errors"
	"net/url"
	"strings"
)

// ErrContactURL explains which contact links are accepted.
var ErrContactURL = errors.New("contact link must start with https://, mailto: or tel:")

// ValidContactURL checks the one seller contact link. Accepted: https://
// (Telegram t.me, WhatsApp wa.me, VK, any site), mailto: and tel:.
// Everything else (javascript:, data:, plain http, app schemes such as
// tg:// that templ would not render) is refused.
func ValidContactURL(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" || len(raw) > 500 || strings.ContainsAny(raw, " \t\r\n<>\"'`") {
		return "", ErrContactURL
	}
	u, err := url.Parse(raw)
	if err != nil {
		return "", ErrContactURL
	}
	switch strings.ToLower(u.Scheme) {
	case "https":
		if u.Host == "" || u.User != nil {
			return "", ErrContactURL
		}
	case "mailto":
		if !strings.Contains(u.Opaque, "@") {
			return "", ErrContactURL
		}
	case "tel":
		if strings.Trim(u.Opaque, "+0123456789-()") != "" || len(u.Opaque) < 3 {
			return "", ErrContactURL
		}
	default:
		return "", ErrContactURL
	}
	return raw, nil
}

// Prefill names how a contact link can carry the message: "mailto" (body),
// "whatsapp" (text), or "" (the buyer pastes the copied message).
func Prefill(raw string) string {
	u, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	switch {
	case strings.EqualFold(u.Scheme, "mailto"):
		return "mailto"
	case strings.EqualFold(u.Scheme, "https") && (strings.EqualFold(u.Host, "wa.me") || strings.EqualFold(u.Host, "api.whatsapp.com")):
		return "whatsapp"
	}
	return ""
}

// ContactHref adds the message to links that can carry it (app.js does the
// same in the browser; kept for tests and server-side callers).
func ContactHref(raw, subject, message string) string {
	u, err := url.Parse(raw)
	if err != nil {
		return raw
	}
	switch Prefill(raw) {
	case "mailto":
		addr, _, _ := strings.Cut(u.Opaque, "?")
		return "mailto:" + addr + "?subject=" + url.PathEscape(subject) + "&body=" + url.PathEscape(message)
	case "whatsapp":
		q := u.Query()
		q.Set("text", message)
		u.RawQuery = q.Encode()
		return u.String()
	}
	return raw
}
