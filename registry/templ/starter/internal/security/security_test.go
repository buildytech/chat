package security

import (
	"net/http/httptest"
	"net/netip"
	"strings"
	"testing"
	"time"
)

var loop = []netip.Prefix{netip.MustParsePrefix("127.0.0.1/32"), netip.MustParsePrefix("::1/128")}

func TestAdminPath(t *testing.T) {
	for p, want := range map[string]bool{"/_/": true, "/_": true, "/_/images/x.png": true, "/api/collections/users/records": true, "/api/health": false, "/": false, "/articles": false, "/_x": false} {
		if IsAdminPath(p) != want {
			t.Errorf("IsAdminPath(%q) != %v", p, want)
		}
	}
}

func TestAdminAllowed(t *testing.T) {
	r := httptest.NewRequest("GET", "/_/", nil)
	r.RemoteAddr = "127.0.0.1:5555"
	if !AdminAllowed(r, loop) {
		t.Fatal("tunnel (loopback, no proxy headers) must pass")
	}
	r.Header.Set("X-Forwarded-For", "203.0.113.9")
	if AdminAllowed(r, loop) {
		t.Fatal("proxied request must be refused even from loopback")
	}
	r = httptest.NewRequest("GET", "/_/", nil)
	r.RemoteAddr = "203.0.113.9:5555"
	if AdminAllowed(r, loop) {
		t.Fatal("public peer must be refused")
	}
}

func TestClientIP(t *testing.T) {
	trusted := []netip.Prefix{netip.MustParsePrefix("10.0.0.1/32")}
	r := httptest.NewRequest("GET", "/", nil)
	r.RemoteAddr = "10.0.0.1:1"
	r.Header.Set("X-Forwarded-For", "198.51.100.7, 203.0.113.5")
	if got := ClientIP(r, trusted); got != "203.0.113.5" {
		t.Fatalf("got %s", got)
	}
	r.RemoteAddr = "192.0.2.1:1"
	if got := ClientIP(r, trusted); got != "192.0.2.1" {
		t.Fatalf("untrusted peer must win, got %s", got)
	}
}

func TestSameOrigin(t *testing.T) {
	r := httptest.NewRequest("POST", "http://site.test/cart", nil)
	if !SameOrigin(r) {
		t.Fatal("no browser headers pass")
	}
	r.Header.Set("Sec-Fetch-Site", "cross-site")
	if SameOrigin(r) {
		t.Fatal("cross-site must fail")
	}
	r.Header.Del("Sec-Fetch-Site")
	r.Header.Set("Origin", "https://evil.test")
	if SameOrigin(r) {
		t.Fatal("foreign origin must fail")
	}
	r.Header.Set("Origin", "http://site.test")
	if !SameOrigin(r) {
		t.Fatal("own origin must pass")
	}
}

func TestCSPAndLimiter(t *testing.T) {
	p := CSP("abc")
	if !strings.Contains(p, "'nonce-abc'") || strings.Contains(p, "unsafe-inline") {
		t.Fatal(p)
	}
	now := time.Unix(0, 0)
	l := &Limiter{Max: 2, Window: time.Minute, Now: func() time.Time { return now }}
	l.Allow("a")
	l.Allow("a")
	if ok, wait := l.Allow("a"); ok || wait <= 0 {
		t.Fatal("third hit must be limited")
	}
	now = now.Add(61 * time.Second)
	if ok, _ := l.Allow("a"); !ok {
		t.Fatal("window must slide")
	}
}
