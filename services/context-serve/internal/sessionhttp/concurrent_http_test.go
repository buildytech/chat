package sessionhttp

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/buildytech/chat/services/context-serve/internal/pagecontract"
)

// Concurrent page creates via real HTTP mux: exactly one slug wins.
func TestHTTPConcurrentSlugCreates(t *testing.T) {
	h := testHandler(t)
	var okCount, conflict atomic.Int32
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			doc, err := pagecontract.CloneValidDraftMap()
			if err != nil {
				t.Errorf("fixture: %v", err)
				return
			}
			doc["id"] = fmt.Sprintf("page-race-%d", n)
			doc["slug"] = "harbor-race"
			rec := doJSON(t, h, http.MethodPost, "/v1/pages", map[string]any{"page": doc})
			switch rec.Code {
			case http.StatusCreated:
				okCount.Add(1)
			case http.StatusConflict:
				conflict.Add(1)
			default:
				t.Errorf("unexpected %d body=%s", rec.Code, rec.Body.String())
			}
		}(i)
	}
	wg.Wait()
	if okCount.Load() != 1 {
		t.Fatalf("winners=%d conflicts=%d", okCount.Load(), conflict.Load())
	}
	if conflict.Load() < 1 {
		t.Fatalf("expected conflicts, got %d", conflict.Load())
	}
	req := httptest.NewRequest(http.MethodGet, "/v1/slugs/harbor-race", nil)
	req.Host = "127.0.0.1:8090"
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("slug get %d", rec.Code)
	}
}

// Conversation messages must not create pages.
func TestHTTPConversationNoPageSideEffect(t *testing.T) {
	h := testHandler(t)
	rec := doJSON(t, h, http.MethodPost, "/v1/sessions", map[string]any{"slugIntent": "chat-only", "title": "Chat"})
	if rec.Code != http.StatusCreated {
		t.Fatalf("create %d %s", rec.Code, rec.Body.String())
	}
	var created struct {
		Session struct {
			ID string `json:"id"`
		} `json:"session"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	rec = doJSONHeader(t, h, http.MethodPost, "/v1/sessions/"+created.Session.ID+"/messages", map[string]any{
		"content": "just chatting, no save",
	}, http.Header{"Idempotency-Key": []string{"conv-no-page-1"}})
	if rec.Code != http.StatusOK && rec.Code != http.StatusCreated {
		t.Fatalf("message %d %s", rec.Code, rec.Body.String())
	}
	rec = doJSON(t, h, http.MethodGet, "/v1/sessions/"+created.Session.ID, nil)
	var got map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &got)
	sess := got["session"].(map[string]any)
	if bound, _ := sess["pageBound"].(bool); bound {
		t.Fatalf("conversation bound a page: %+v", sess)
	}
	if _, has := got["page"]; has {
		t.Fatalf("unexpected page in session get after chat-only")
	}
}
