package shop

import (
	"testing"
)

func TestContactURL(t *testing.T) {
	good := []string{"https://t.me/acme", "https://wa.me/15551234567", "https://vk.com/acme", "mailto:shop@example.com", "tel:+1-555-0100"}
	for _, u := range good {
		if _, err := ValidContactURL(u); err != nil {
			t.Errorf("%s: %v", u, err)
		}
	}
	bad := []string{"", "javascript:alert(1)", "http://t.me/acme", "data:text/html,x", "https://", "mailto:nobody", "https://user:pw@x.test", "ftp://x.test", "tg://resolve?domain=acme", "https://x.test/\"onmouseover"}
	for _, u := range bad {
		if _, err := ValidContactURL(u); err == nil {
			t.Errorf("%s must be refused", u)
		}
	}
	if h := ContactHref("mailto:shop@example.com", "Order", "a b"); h != "mailto:shop@example.com?subject=Order&body=a%20b" {
		t.Fatalf("mailto href %s", h)
	}
	if h := ContactHref("https://wa.me/1555", "", "hi there"); h != "https://wa.me/1555?text=hi+there" {
		t.Fatalf("wa href %s", h)
	}
	if h := ContactHref("https://t.me/acme", "", "x"); h != "https://t.me/acme" {
		t.Fatalf("tg href %s", h)
	}
}
