package sessionhttp

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
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
	return doJSONHeader(t, h, method, path, body, nil)
}

func doJSONHeader(t *testing.T, h http.Handler, method, path string, body any, extra http.Header) *httptest.ResponseRecorder {
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
	for k, vs := range extra {
		for _, v := range vs {
			req.Header.Set(k, v)
		}
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestHTTPSessionCreateMessageReadRunReplay(t *testing.T) {
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

	rec = doJSONHeader(t, h, http.MethodPost, "/v1/sessions/"+created.Session.ID+"/messages", map[string]any{
		"content": "hello there",
	}, http.Header{"Idempotency-Key": []string{"http-chat-1"}})
	if rec.Code != http.StatusOK {
		t.Fatalf("chat %d %s", rec.Code, rec.Body.String())
	}
	var turn map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &turn); err != nil {
		t.Fatal(err)
	}
	if turn["page"] == nil {
		t.Fatal("first turn must bind a page")
	}
	run := turn["run"].(map[string]any)
	runID, _ := run["id"].(string)
	if run["status"] != "completed" {
		t.Fatalf("status %v", run["status"])
	}

	rec = doJSON(t, h, http.MethodGet, "/v1/sessions", nil)
	if rec.Code != http.StatusOK || !bytes.Contains(rec.Body.Bytes(), []byte(created.Session.ID)) {
		t.Fatalf("list sessions %d %s", rec.Code, rec.Body.String())
	}
	rec = doJSON(t, h, http.MethodGet, "/v1/sessions/"+created.Session.ID, nil)
	if rec.Code != http.StatusOK || !bytes.Contains(rec.Body.Bytes(), []byte(`"pageBound":true`)) {
		t.Fatalf("get session %d %s", rec.Code, rec.Body.String())
	}
	rec = doJSON(t, h, http.MethodGet, "/v1/sessions/"+created.Session.ID+"/messages", nil)
	if rec.Code != http.StatusOK || !bytes.Contains(rec.Body.Bytes(), []byte(`"role":"assistant"`)) {
		t.Fatalf("messages %d %s", rec.Code, rec.Body.String())
	}
	rec = doJSON(t, h, http.MethodGet, "/v1/runs/"+runID, nil)
	if rec.Code != http.StatusOK || !bytes.Contains(rec.Body.Bytes(), []byte(`"status":"completed"`)) {
		t.Fatalf("get run %d %s", rec.Code, rec.Body.String())
	}

	rec = doJSONHeader(t, h, http.MethodPost, "/v1/sessions/"+created.Session.ID+"/messages", map[string]any{
		"content": "hello there",
	}, http.Header{"Idempotency-Key": []string{"http-chat-1"}})
	if rec.Code != http.StatusOK {
		t.Fatalf("replay %d %s", rec.Code, rec.Body.String())
	}
	var replay map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &replay); err != nil {
		t.Fatal(err)
	}
	if replay["run"].(map[string]any)["id"] != runID {
		t.Fatal("replay minted a new run")
	}

	rec = doJSONHeader(t, h, http.MethodPost, "/v1/sessions/"+created.Session.ID+"/messages", map[string]any{
		"content": "different",
	}, http.Header{"Idempotency-Key": []string{"http-chat-1"}})
	if rec.Code != http.StatusConflict {
		t.Fatalf("conflict %d %s", rec.Code, rec.Body.String())
	}

	rec = doJSON(t, h, http.MethodGet, "/v1/capabilities", nil)
	if rec.Code != http.StatusOK || !bytes.Contains(rec.Body.Bytes(), []byte(`"liveModel":false`)) {
		t.Fatalf("capabilities %d %s", rec.Code, rec.Body.String())
	}
}

func TestHTTPConformanceFixture(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join("..", "..", "testdata", "session-conformance.json"))
	if err != nil {
		t.Fatal(err)
	}
	var spec struct {
		Capabilities struct {
			Runtime   string `json:"runtime"`
			LiveModel bool   `json:"liveModel"`
			Mode      string `json:"mode"`
		} `json:"capabilities"`
	}
	if err := json.Unmarshal(raw, &spec); err != nil {
		t.Fatal(err)
	}
	h := testHandler(t)
	rec := doJSON(t, h, http.MethodGet, "/v1/capabilities", nil)
	if rec.Code != http.StatusOK {
		t.Fatal(rec.Body.String())
	}
	if !bytes.Contains(rec.Body.Bytes(), []byte(`"runtime":"`+spec.Capabilities.Runtime+`"`)) {
		t.Fatalf("runtime mismatch %s", rec.Body.String())
	}
	if spec.Capabilities.LiveModel {
		t.Fatal("conformance fixture must keep liveModel false")
	}
}

func TestHTTPInvalidDTO(t *testing.T) {
	h := testHandler(t)
	rec := doJSON(t, h, http.MethodPost, "/v1/sessions", map[string]any{"slugIntent": "home"})
	var created struct {
		Session sessionstore.Session `json:"session"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	doc, err := pagecontract.CloneValidDraftMap()
	if err != nil {
		t.Fatal(err)
	}
	doc["id"] = created.Session.PageID
	doc["promo"] = "off"
	rec = doJSON(t, h, http.MethodPost, "/v1/sessions/"+created.Session.ID+"/messages", map[string]any{
		"requestId": "bad-dto",
		"tools": []map[string]any{{
			"name":      "save_page",
			"arguments": map[string]any{"page": doc},
		}},
	})
	if rec.Code == http.StatusOK {
		t.Fatalf("invalid dto succeeded: %s", rec.Body.String())
	}
	rec = doJSON(t, h, http.MethodGet, "/v1/sessions/"+created.Session.ID, nil)
	if bytes.Contains(rec.Body.Bytes(), []byte(`"pageBound":true`)) {
		t.Fatal("invalid dto bound page")
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
