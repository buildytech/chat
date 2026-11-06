package pagehttp

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/buildytech/chat/services/context-serve/internal/pagecontract"
	"github.com/buildytech/chat/services/context-serve/internal/pagestore"
)

func testServer(t *testing.T) http.Handler {
	t.Helper()
	s, err := pagestore.Open(filepath.Join(t.TempDir(), "pages.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = s.Close() })
	return NewMux(s)
}

func postJSON(t *testing.T, h http.Handler, path string, body any) *httptest.ResponseRecorder {
	t.Helper()
	raw, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestHTTPCreateRead(t *testing.T) {
	h := testServer(t)
	page, err := pagecontract.CloneValidDraftMap()
	if err != nil {
		t.Fatal(err)
	}
	rec := postJSON(t, h, "/v1/pages", map[string]any{"page": page})
	if rec.Code != http.StatusCreated {
		t.Fatalf("create %d %s", rec.Code, rec.Body.String())
	}
	req := httptest.NewRequest(http.MethodGet, "/v1/pages/page-home", nil)
	got := httptest.NewRecorder()
	h.ServeHTTP(got, req)
	if got.Code != http.StatusOK {
		t.Fatalf("get %d %s", got.Code, got.Body.String())
	}
	req = httptest.NewRequest(http.MethodGet, "/v1/slugs/home", nil)
	got = httptest.NewRecorder()
	h.ServeHTTP(got, req)
	if got.Code != http.StatusOK {
		t.Fatalf("slug %d %s", got.Code, got.Body.String())
	}
}

func TestHTTPUnknownField(t *testing.T) {
	h := testServer(t)
	page, err := pagecontract.CloneValidDraftMap()
	if err != nil {
		t.Fatal(err)
	}
	page["extra"] = true
	rec := postJSON(t, h, "/v1/pages", map[string]any{"page": page})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("got %d %s", rec.Code, rec.Body.String())
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"unexpected_key"`)) {
		t.Fatalf("body %s", rec.Body.String())
	}
}

func TestHTTPDuplicateSlug(t *testing.T) {
	h := testServer(t)
	page, err := pagecontract.CloneValidDraftMap()
	if err != nil {
		t.Fatal(err)
	}
	if rec := postJSON(t, h, "/v1/pages", map[string]any{"page": page}); rec.Code != http.StatusCreated {
		t.Fatalf("first %d %s", rec.Code, rec.Body.String())
	}
	page["id"] = "page-other"
	rec := postJSON(t, h, "/v1/pages", map[string]any{"page": page})
	if rec.Code != http.StatusConflict {
		t.Fatalf("dup %d %s", rec.Code, rec.Body.String())
	}
}

func TestHTTPRevisionConflict(t *testing.T) {
	h := testServer(t)
	page, err := pagecontract.CloneValidDraftMap()
	if err != nil {
		t.Fatal(err)
	}
	if rec := postJSON(t, h, "/v1/pages", map[string]any{"page": page}); rec.Code != http.StatusCreated {
		t.Fatalf("create %d %s", rec.Code, rec.Body.String())
	}
	page["title"] = "Harbor Kitchen"
	raw, _ := json.Marshal(map[string]any{"page": page, "revision": 1})
	req := httptest.NewRequest(http.MethodPut, "/v1/pages/page-home", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("update %d %s", rec.Code, rec.Body.String())
	}
	page["title"] = "Stale"
	raw, _ = json.Marshal(map[string]any{"page": page, "revision": 1})
	req = httptest.NewRequest(http.MethodPut, "/v1/pages/page-home", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusConflict {
		t.Fatalf("stale %d %s", rec.Code, rec.Body.String())
	}
}

func TestHealthz(t *testing.T) {
	h := testServer(t)
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("healthz %d %s", rec.Code, rec.Body.String())
	}
}
