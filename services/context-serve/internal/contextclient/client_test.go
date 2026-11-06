package contextclient

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestContextPackAgainstFakeServer(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"api_version": "v1", "ok": true, "ready": true})
	})
	mux.HandleFunc("/v1/context-pack", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer tok" {
			t.Fatalf("missing token")
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"context_pack": map[string]any{"id": "pack_x", "checksum": "abc"},
		})
	})
	srv := httptest.NewServer(mux)
	defer srv.Close()
	c := &Client{BaseURL: srv.URL, Token: "tok", HTTP: srv.Client()}
	h, err := c.Health(context.Background())
	if err != nil || h.APIVersion != "v1" {
		t.Fatalf("health %+v %v", h, err)
	}
	pack, err := c.ContextPack(context.Background(), "p", "мангал")
	if err != nil {
		t.Fatal(err)
	}
	if len(pack.ContextPack) == 0 {
		t.Fatal("empty pack")
	}
}
