// Package stubbuilder is a DETERMINISTIC TEST STUB, not a live model.
//
// It emits a bounded, validated Page DTO from session identity + turn text.
// capabilities.liveModel remains false. Do not treat this as Agent SDK or
// model integration. Production model work is a later milestone.
package stubbuilder

import (
	"context"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/buildytech/chat/services/context-serve/internal/agentruntime"
	"github.com/buildytech/chat/services/context-serve/internal/pagecontract"
)

const (
	Name          = "deterministic-test-stub"
	maxTitleRunes = 160
	maxCopyRunes  = 2000
)

// SessionView is the subset of session identity the stub needs.
type SessionView struct {
	ID         string
	PageID     string
	SlugIntent string
	Title      string
	CreatedAt  string
}

// Build returns a Page DTO map for the session. Same session + same content
// yields the same slug/id/title/copy; timestamps follow RFC3339 millis.
func Build(ctx context.Context, sess SessionView, req agentruntime.TurnRequest) (map[string]any, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	doc, err := pagecontract.CloneValidDraftMap()
	if err != nil {
		return nil, err
	}
	title := firstLine(req.Content)
	if title == "" {
		title = strings.TrimSpace(sess.Title)
	}
	if title == "" {
		title = "Stub draft"
	}
	title = clip(sanitizePlain(title), maxTitleRunes)
	lede := clip(sanitizePlain(strings.TrimSpace(req.Content)), maxCopyRunes)
	if lede == "" {
		lede = "Deterministic stub builder placeholder. Not a live model."
	}
	slug := strings.TrimSpace(sess.SlugIntent)
	if slug == "" {
		slug = sess.ID
	}
	now := time.Now().UTC().Format("2006-01-02T15:04:05.000Z")
	created := sess.CreatedAt
	if created == "" || !looksRFC3339(created) {
		created = now
	} else if len(created) > 24 {
		// RFC3339Nano -> millis Z
		t, err := time.Parse(time.RFC3339Nano, created)
		if err == nil {
			created = t.UTC().Format("2006-01-02T15:04:05.000Z")
		} else {
			created = now
		}
	}

	doc["id"] = sess.PageID
	doc["slug"] = slug
	doc["status"] = "draft"
	doc["title"] = title
	doc["createdAt"] = created
	doc["updatedAt"] = now
	if seo, ok := doc["seo"].(map[string]any); ok {
		seo["title"] = title
	}
	if layout, ok := doc["layout"].(map[string]any); ok {
		if blocks, ok := layout["blocks"].([]any); ok {
			for _, raw := range blocks {
				block, ok := raw.(map[string]any)
				if !ok {
					continue
				}
				if kind, _ := block["kind"].(string); kind == "hero" {
					copy, _ := block["copy"].(map[string]any)
					if copy == nil {
						copy = map[string]any{}
						block["copy"] = copy
					}
					copy["headline"] = title
					copy["lede"] = lede
					copy["eyebrow"] = "Stub builder"
					copy["action"] = "Not a live model"
				}
				if kind, _ := block["kind"].(string); kind == "nav" {
					copy, _ := block["copy"].(map[string]any)
					if copy == nil {
						copy = map[string]any{}
						block["copy"] = copy
					}
					copy["brand"] = title
				}
			}
		}
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if _, err := pagecontract.ParseDraftPage(doc); err != nil {
		return nil, err
	}
	return doc, nil
}

func sanitizePlain(s string) string {
	r := strings.NewReplacer("<", "", ">", "", "{", "", "}", "")
	return strings.TrimSpace(r.Replace(s))
}

func firstLine(s string) string {
	s = strings.TrimSpace(s)
	if i := strings.IndexAny(s, "\r\n"); i >= 0 {
		s = s[:i]
	}
	return strings.TrimSpace(s)
}

func clip(s string, max int) string {
	if utf8.RuneCountInString(s) <= max {
		return s
	}
	runes := []rune(s)
	return string(runes[:max])
}

func looksRFC3339(s string) bool {
	if _, err := time.Parse(time.RFC3339Nano, s); err == nil {
		return true
	}
	_, err := time.Parse(time.RFC3339, s)
	return err == nil
}
