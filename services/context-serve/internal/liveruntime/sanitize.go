package liveruntime

import (
	"fmt"
	"strings"

	"github.com/buildytech/chat/services/context-serve/internal/pagecontract"
)

var allowedCopy = func() map[string]struct{} {
	m := map[string]struct{}{}
	for _, k := range pagecontract.CopyKeys {
		m[k] = struct{}{}
	}
	return m
}()

// SanitizeProposedPage drops/rewrites fields that violate the Page DTO allowlist
// so a live propose_page can still persist when the model adds extras (e.g. href).
func SanitizeProposedPage(page any) (map[string]any, error) {
	m, err := asMap(page)
	if err != nil {
		return nil, err
	}
	out := map[string]any{}
	for _, k := range []string{"id", "slug", "status", "title", "layout", "seo", "locale", "createdAt", "updatedAt"} {
		if v, ok := m[k]; ok {
			out[k] = v
		}
	}
	if layout, ok := out["layout"].(map[string]any); ok {
		out["layout"] = sanitizeLayout(layout)
	} else if layoutRaw, ok := m["layout"]; ok {
		if lm, err := asMap(layoutRaw); err == nil {
			out["layout"] = sanitizeLayout(lm)
		}
	}
	if seo, ok := out["seo"]; ok {
		if sm, err := asMap(seo); err == nil {
			clean := map[string]any{}
			if v, ok := sm["title"]; ok {
				clean["title"] = v
			}
			if v, ok := sm["description"]; ok {
				clean["description"] = v
			}
			out["seo"] = clean
		}
	}
	return out, nil
}

func sanitizeLayout(layout map[string]any) map[string]any {
	out := map[string]any{"version": layout["version"]}
	blocks, _ := layout["blocks"].([]any)
	clean := make([]any, 0, len(blocks))
	for _, b := range blocks {
		bm, err := asMap(b)
		if err != nil {
			continue
		}
		clean = append(clean, sanitizeBlock(bm))
	}
	out["blocks"] = clean
	return out
}

func sanitizeBlock(b map[string]any) map[string]any {
	out := map[string]any{}
	for _, k := range []string{"id", "kind", "title", "summary"} {
		if v, ok := b[k]; ok {
			out[k] = v
		}
	}
	if s, ok := out["summary"].(string); ok {
		out["summary"] = rewriteUI8KitCitation(s)
	}
	if c, ok := b["copy"]; ok {
		if cm, err := asMap(c); err == nil {
			cp := map[string]any{}
			for k, v := range cm {
				if _, ok := allowedCopy[k]; !ok {
					continue
				}
				if sv, ok := v.(string); ok {
					cp[k] = rewriteUI8KitCitation(sv)
				}
			}
			if len(cp) > 0 {
				out["copy"] = cp
			}
		}
	}
	if ch, ok := b["children"].([]any); ok {
		kids := make([]any, 0, len(ch))
		for _, c := range ch {
			cm, err := asMap(c)
			if err != nil {
				continue
			}
			kids = append(kids, sanitizeBlock(cm))
		}
		if len(kids) > 0 {
			out["children"] = kids
		}
	}
	return out
}

func rewriteUI8KitCitation(s string) string {
	// Avoid scheme-like "ui8kit:..." which pagecontract rejects as unsafe_url.
	s = strings.ReplaceAll(s, "ui8kit:", "ui8kit/")
	return s
}

// EnsureTimestamps fills createdAt/updatedAt if the model omitted them.
func EnsureTimestamps(page map[string]any, nowISO string) {
	if _, ok := page["createdAt"]; !ok || strings.TrimSpace(fmt.Sprint(page["createdAt"])) == "" {
		page["createdAt"] = nowISO
	}
	if _, ok := page["updatedAt"]; !ok || strings.TrimSpace(fmt.Sprint(page["updatedAt"])) == "" {
		page["updatedAt"] = nowISO
	}
	if _, ok := page["locale"]; !ok {
		page["locale"] = "ru-RU"
	}
	if _, ok := page["status"]; !ok {
		page["status"] = "draft"
	}
	if _, ok := page["seo"]; !ok {
		page["seo"] = map[string]any{}
	}
}
