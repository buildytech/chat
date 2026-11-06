package liveruntime

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/buildytech/chat/services/context-serve/internal/agentruntime"
)

func TestPlanFromTrajectoryProposePage(t *testing.T) {
	page := map[string]any{
		"id": "page-wrong", "slug": "demo", "status": "draft", "title": "T",
		"layout": map[string]any{"version": 1, "blocks": []any{}},
		"seo": map[string]any{}, "locale": "ru-RU",
		"createdAt": "2026-11-06T00:00:00Z", "updatedAt": "2026-11-06T00:00:00Z",
	}
	args, _ := json.Marshal(map[string]any{"page": page})
	payload := map[string]any{
		"ok": true,
		"trajectory": map[string]any{
			"ok": true, "finalText": "done",
			"turns": []any{
				map[string]any{
					"assistantText": "done",
					"toolCalls": []any{
						map[string]any{"toolName": "propose_page", "isError": false, "args": json.RawMessage(args)},
					},
				},
			},
		},
	}
	raw, _ := json.Marshal(payload)
	plan, err := planFromTrajectory(raw, SessionHint{PageID: "page-bound", SlugIntent: "mangal"})
	if err != nil {
		t.Fatal(err)
	}
	if plan.SavePage == nil {
		t.Fatal("expected SavePage")
	}
	m, _ := asMap(plan.SavePage.Page)
	if m["id"] != "page-bound" {
		t.Fatalf("id forced to session page, got %v", m["id"])
	}
}

func TestPlanFromTrajectoryNoPropose(t *testing.T) {
	payload := map[string]any{
		"ok": true,
		"trajectory": map[string]any{
			"ok": true, "finalText": "need dates?",
			"turns": []any{map[string]any{"assistantText": "need dates?", "toolCalls": []any{}}},
		},
	}
	raw, _ := json.Marshal(payload)
	plan, err := planFromTrajectory(raw, SessionHint{PageID: "page-x"})
	if err != nil {
		t.Fatal(err)
	}
	if plan.SavePage != nil {
		t.Fatal("must not invent save")
	}
	if plan.AssistantText == "" {
		t.Fatal("text required")
	}
}

func TestExtractJSONObjectSkipsLogNoise(t *testing.T) {
	raw := []byte("20:00 INFO noise\n{\"ok\":true,\"trajectory\":{\"ok\":true,\"finalText\":\"x\",\"turns\":[]}}\n")
	got, err := extractJSONObject(raw)
	if err != nil {
		t.Fatal(err)
	}
	var m map[string]any
	if err := json.Unmarshal(got, &m); err != nil {
		t.Fatal(err)
	}
	if m["ok"] != true {
		t.Fatalf("%v", m)
	}
}

func TestLiveDisabledWithoutEnv(t *testing.T) {
	t.Setenv("BUILDY_LIVE_MODEL", "0")
	r := &Runner{}
	_, err := r.Plan(context.Background(), SessionHint{}, agentruntime.TurnRequest{Content: "hi"})
	if err != ErrLiveDisabled {
		t.Fatalf("got %v", err)
	}
}
