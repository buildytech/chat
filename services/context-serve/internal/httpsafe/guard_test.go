package httpsafe

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHostGuard(t *testing.T) {
	h := Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	req := httptest.NewRequest(http.MethodGet, "/v1/capabilities", nil)
	req.Host = "evil.example"
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("got %d", rec.Code)
	}
	req = httptest.NewRequest(http.MethodGet, "/v1/capabilities", nil)
	req.Host = "127.0.0.1:18090"
	req.Header.Set("Origin", "http://127.0.0.1:5173")
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("loopback got %d", rec.Code)
	}
}

func TestRejectWildcardBindHost(t *testing.T) {
	h := Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	req := httptest.NewRequest(http.MethodPost, "/v1/sessions", strings.NewReader(`{}`))
	req.Host = "0.0.0.0:8090"
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("got %d", rec.Code)
	}
}

func TestRejectBrowserOriginOnWrite(t *testing.T) {
	h := Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
	}))
	req := httptest.NewRequest(http.MethodPost, "/v1/sessions", strings.NewReader(`{}`))
	req.Host = "127.0.0.1:8090"
	req.Header.Set("Origin", "https://evil.example")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("got %d", rec.Code)
	}
	if rec.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatal("must not emit CORS allow origin")
	}
}

func TestRejectForwardedHost(t *testing.T) {
	h := Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	req := httptest.NewRequest(http.MethodGet, "/v1/capabilities", nil)
	req.Host = "127.0.0.1:8090"
	req.Header.Set("X-Forwarded-Host", "evil.example")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("got %d", rec.Code)
	}
}

func TestNoPermissiveCORSOnPreflight(t *testing.T) {
	h := Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	req := httptest.NewRequest(http.MethodOptions, "/v1/sessions", nil)
	req.Host = "127.0.0.1:8090"
	req.Header.Set("Origin", "http://127.0.0.1:5173")
	req.Header.Set("Access-Control-Request-Method", "POST")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatalf("CORS header present: %v", rec.Header())
	}
	if rec.Code == http.StatusNoContent || rec.Code == http.StatusOK {
		t.Fatalf("preflight must not succeed, got %d", rec.Code)
	}
}
