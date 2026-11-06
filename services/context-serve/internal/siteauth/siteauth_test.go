package siteauth

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestDisabledPassthrough(t *testing.T) {
	h := Wrap(nil, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(204)
	}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/v1/capabilities", nil))
	if rec.Code != 204 {
		t.Fatalf("%d", rec.Code)
	}
}

func TestRejectAndAccept(t *testing.T) {
	t.Setenv("BUILDY_SITE_TOKENS", "site-a:secret-a,site-b:secret-b")
	reg := FromEnv()
	h := Wrap(reg, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if SiteIDFrom(r.Context()) != "site-a" {
			t.Fatalf("site %q", SiteIDFrom(r.Context()))
		}
		w.WriteHeader(204)
	}))
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/v1/capabilities", nil)
	h.ServeHTTP(rec, req)
	if rec.Code != 401 {
		t.Fatalf("missing: %d", rec.Code)
	}
	req = httptest.NewRequest(http.MethodGet, "/v1/capabilities", nil)
	req.Header.Set(HeaderSiteID, "site-a")
	req.Header.Set(HeaderSiteToken, "secret-a")
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != 204 {
		t.Fatalf("good: %d", rec.Code)
	}
}
