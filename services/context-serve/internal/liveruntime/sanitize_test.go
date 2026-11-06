package liveruntime

import "testing"

func TestSanitizeDropsHrefAndRewritesColon(t *testing.T) {
	page := map[string]any{
		"id": "page-x", "slug": "s", "status": "draft", "title": "T",
		"locale": "ru-RU", "createdAt": "2026-11-06T00:00:00.000Z", "updatedAt": "2026-11-06T00:00:00.000Z",
		"seo": map[string]any{"title": "t"},
		"layout": map[string]any{
			"version": 1,
			"blocks": []any{
				map[string]any{
					"id": "nav1", "kind": "nav", "title": "Nav", "summary": "ui8kit:navbar/inline",
					"children": []any{
						map[string]any{
							"id": "nl1", "kind": "nav-link", "title": "Menu", "summary": "link",
							"copy": map[string]any{"href": "/#menu", "action": "Меню"},
						},
					},
				},
			},
		},
	}
	out, err := SanitizeProposedPage(page)
	if err != nil {
		t.Fatal(err)
	}
	blocks := out["layout"].(map[string]any)["blocks"].([]any)
	b0 := blocks[0].(map[string]any)
	if b0["summary"] != "ui8kit/navbar/inline" {
		t.Fatalf("summary=%v", b0["summary"])
	}
	child := b0["children"].([]any)[0].(map[string]any)
	cp := child["copy"].(map[string]any)
	if _, ok := cp["href"]; ok {
		t.Fatal("href must be dropped")
	}
	if cp["action"] != "Меню" {
		t.Fatalf("action=%v", cp["action"])
	}
}
