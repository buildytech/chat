// Package security holds the HTTP defaults of the starter: CSP with a
// per-request nonce, baseline headers, the /_/ and /api/ guard, client IP
// resolution behind trusted proxies, a sign-in rate limiter and the
// same-origin check for form posts.
package security

import (
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"net/netip"
	"net/url"
	"strings"
)

// NewNonce returns a random CSP nonce.
func NewNonce() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

// CSP is the policy of every HTML page: scripts only from self with the
// page nonce, no inline styles, no third-party origins.
func CSP(nonce string) string {
	script := "'self'"
	if nonce != "" {
		script += " 'nonce-" + nonce + "'"
	}
	return strings.Join([]string{
		"default-src 'self'",
		"script-src " + script,
		"style-src 'self'",
		"img-src 'self' data:",
		"font-src 'self'",
		"connect-src 'self'",
		"object-src 'none'",
		"base-uri 'self'",
		"frame-ancestors 'none'",
		"form-action 'self'",
	}, "; ")
}

// PermissionsPolicy turns off powerful features the site never uses.
const PermissionsPolicy = "accelerometer=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()"

// BaseHeaders are set on every response.
func BaseHeaders(h http.Header, production bool) {
	h.Set("X-Content-Type-Options", "nosniff")
	h.Set("X-Frame-Options", "DENY")
	h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
	h.Set("Cross-Origin-Resource-Policy", "same-origin")
	h.Set("Cross-Origin-Opener-Policy", "same-origin")
	h.Set("Permissions-Policy", PermissionsPolicy)
	h.Set("X-XSS-Protection", "0")
	if production {
		h.Set("Strict-Transport-Security", "max-age=31536000")
	}
}

// IsAdminPath reports whether p belongs to PocketBase itself: the admin UI
// (/_/) or its REST API (/api/), except the health probe.
func IsAdminPath(p string) bool {
	if p == "/_" || strings.HasPrefix(p, "/_/") {
		return true
	}
	if strings.HasPrefix(p, "/api/") || p == "/api" {
		return p != "/api/health"
	}
	return false
}

// forwardHeaders are set by reverse proxies. A request that carries any of
// them came through the public edge, not through an SSH tunnel.
var forwardHeaders = []string{"X-Forwarded-For", "X-Real-Ip", "Forwarded", "X-Forwarded-Host", "Cf-Connecting-Ip", "True-Client-Ip"}

// AdminAllowed reports whether r may reach an admin path: the direct peer is
// in allow (loopback by default) and no proxy forwarded the request. Through
// `ssh -L 8090:127.0.0.1:8090 host` the peer is loopback and nothing is
// forwarded; through Caddy there is always X-Forwarded-For, so /_/ is 404.
func AdminAllowed(r *http.Request, allow []netip.Prefix) bool {
	for _, h := range forwardHeaders {
		if r.Header.Get(h) != "" {
			return false
		}
	}
	peer, ok := ParseAddr(r.RemoteAddr)
	if !ok {
		return false
	}
	for _, p := range allow {
		if p.Contains(peer) {
			return true
		}
	}
	return false
}

// SameOrigin reports whether an unsafe request (POST) was sent by a page of
// this site. Browsers send Sec-Fetch-Site and Origin on form posts; a
// request with neither (curl, CLI tools) passes because it carries no
// ambient cookies of a victim.
func SameOrigin(r *http.Request) bool {
	switch r.Header.Get("Sec-Fetch-Site") {
	case "same-origin", "none":
		return true
	case "cross-site", "same-site":
		return false
	}
	o := r.Header.Get("Origin")
	if o == "" || o == "null" {
		return o == ""
	}
	u, err := url.Parse(o)
	return err == nil && strings.EqualFold(u.Host, r.Host)
}

// ParseAddr parses "ip:port" or a bare ip.
func ParseAddr(s string) (netip.Addr, bool) {
	if ap, err := netip.ParseAddrPort(s); err == nil {
		return ap.Addr().Unmap(), true
	}
	if a, err := netip.ParseAddr(strings.Trim(s, "[]")); err == nil {
		return a.Unmap(), true
	}
	return netip.Addr{}, false
}

// ClientIP returns the client address: the direct peer, or, when the peer
// is a trusted proxy, the rightmost untrusted X-Forwarded-For hop.
func ClientIP(r *http.Request, trusted []netip.Prefix) string {
	peer, ok := ParseAddr(r.RemoteAddr)
	if !ok {
		return r.RemoteAddr
	}
	if !in(peer, trusted) {
		return peer.String()
	}
	var hops []string
	for _, v := range r.Header.Values("X-Forwarded-For") {
		hops = append(hops, strings.Split(v, ",")...)
	}
	client := peer
	for i := len(hops) - 1; i >= 0; i-- {
		a, ok := ParseAddr(strings.TrimSpace(hops[i]))
		if !ok {
			break
		}
		client = a
		if !in(a, trusted) {
			break
		}
	}
	return client.String()
}

func in(a netip.Addr, set []netip.Prefix) bool {
	for _, p := range set {
		if p.Contains(a) {
			return true
		}
	}
	return false
}
