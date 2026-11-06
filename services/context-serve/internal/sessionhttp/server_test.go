package sessionhttp

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/buildytech/chat/services/context-serve/internal/httpsafe"
	"github.com/buildytech/chat/services/context-serve/internal/pagecontract"
	"github.com/buildytech/chat/services/context-serve/internal/pagestore"
	"github.com/buildytech/chat/services/context-serve/internal/sessionstore"
)

func testHandler(t *testing.T) http.Handler {
	t.Helper()
	pages, err := pagestore.Open(filepath.Join(t.TempDir(), "pages.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = pages.Close() })
	return NewMux(pages, sessionstore.New(pages))
}

func doJSON(t *testing.T, h http.Handler, method, path string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var rdr *bytes.Reader
	if body == nil {
		rdr = bytes.NewReader(nil)
	} else {
		raw, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		rdr = bytes.NewReader(raw)
	}
	req := httptest.NewRequest(method, path, rdr)
	req.Header.Set("Content-Type", "application/json")
	req.Host = "127.0.0.1:8090"
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestHTTPSessionConversationAndSave(t *testing.T) {
	h := testHandler(t)
	rec := doJSON(t, h, http.MethodPost, "/v1/sessions", map[string]any{"slugIntent": "home"})
	if rec.Code != http.StatusCreated {
		t.Fatalf("create session %d %s", rec.Code, rec.Body.String())
	}
	var created struct {
		Session sessionstore.Session `json:"session"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	rec = doJSON(t, h, http.MethodPost, "/v1/sessions/"+created.Session.ID+"/messages", map[string]any{
		"content":   "hello there",
		"requestId": "http-chat-1",
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("chat %d %s", rec.Code, rec.Body.String())
	}
	var turn map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &turn); err != nil {
		t.Fatal(err)
	}
	if turn["page"] != nil {
		t.Fatalf("chat wrote page: %v", turn["page"])
	}

	doc, err := pagecontract.CloneValidDraftMap()
	if err != nil {
		t.Fatal(err)
	}
	doc["id"] = created.Session.PageID
	doc["slug"] = "home"
	rec = doJSON(t, h, http.MethodPost, "/v1/sessions/"+created.Session.ID+"/messages", map[string]any{
		"requestId": "http-save-1",
		"tools": []map[string]any{{
			"name":      "save_page",
			"arguments": map[string]any{"page": doc},
		}},
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("save %d %s", rec.Code, rec.Body.String())
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &turn); err != nil {
		t.Fatal(err)
	}
	if turn["page"] == nil {
		t.Fatal("expected page after save")
	}

	rec = doJSON(t, h, http.MethodGet, "/v1/capabilities", nil)
	if rec.Code != http.StatusOK || !bytes.Contains(rec.Body.Bytes(), []byte(`"liveModel":false`)) {
		t.Fatalf("capabilities %d %s", rec.Code, rec.Body.String())
	}
}

func TestHTTPHostGuard(t *testing.T) {
	pages, err := pagestore.Open(filepath.Join(t.TempDir(), "pages.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = pages.Close() })
	h := httpsafe.Wrap(NewMux(pages, sessionstore.New(pages)))
	req := httptest.NewRequest(http.MethodGet, "/v1/capabilities", nil)
	req.Host = "evil.example"
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("got %d", rec.Code)
	}
}

func TestHTTPPagesStillWork(t *testing.T) {
	h := testHandler(t)
	doc, err := pagecontract.CloneValidDraftMap()
	if err != nil {
		t.Fatal(err)
	}
	rec := doJSON(t, h, http.MethodPost, "/v1/pages", map[string]any{"page": doc})
	if rec.Code != http.StatusCreated {
		t.Fatalf("page create %d %s", rec.Code, rec.Body.String())
	}
}
