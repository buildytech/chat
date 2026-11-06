package siteauth

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/json"
	"net/http"
	"os"
	"strings"
)

type ctxKey int

const keySiteID ctxKey = 1

const (
	HeaderSiteID    = "X-BuildY-Site-Id"
	HeaderSiteToken = "X-BuildY-Site-Token"
)

// Registry maps siteId → sha256(token). Empty registry = site auth disabled.
type Registry map[string][32]byte

func FromEnv() Registry {
	raw := strings.TrimSpace(os.Getenv("BUILDY_SITE_TOKENS"))
	if raw == "" {
		if f := strings.TrimSpace(os.Getenv("BUILDY_SITE_TOKENS_FILE")); f != "" {
			b, err := os.ReadFile(f)
			if err == nil {
				raw = string(b)
			}
		}
	}
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	reg := Registry{}
	// JSON object {"site-a":"token",...} or CSV site:token,site2:token2
	if strings.HasPrefix(raw, "{") {
		var m map[string]string
		if err := json.Unmarshal([]byte(raw), &m); err == nil {
			for id, tok := range m {
				id = normalizeSiteID(id)
				if id == "" || tok == "" {
					continue
				}
				reg[id] = sha256.Sum256([]byte(tok))
			}
			return reg
		}
	}
	for _, part := range strings.Split(raw, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		id, tok, ok := strings.Cut(part, ":")
		if !ok {
			continue
		}
		id = normalizeSiteID(id)
		tok = strings.TrimSpace(tok)
		if id == "" || tok == "" {
			continue
		}
		reg[id] = sha256.Sum256([]byte(tok))
	}
	if len(reg) == 0 {
		return nil
	}
	return reg
}

func normalizeSiteID(id string) string {
	id = strings.TrimSpace(strings.ToLower(id))
	var b strings.Builder
	for _, r := range id {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			b.WriteRune(r)
		}
	}
	out := b.String()
	if len(out) > 64 {
		out = out[:64]
	}
	return out
}

func (r Registry) Enabled() bool { return len(r) > 0 }

func (r Registry) Valid(siteID, token string) bool {
	if !r.Enabled() {
		return true
	}
	siteID = normalizeSiteID(siteID)
	want, ok := r[siteID]
	if !ok || token == "" {
		return false
	}
	got := sha256.Sum256([]byte(token))
	return subtle.ConstantTimeCompare(got[:], want[:]) == 1
}

// Wrap requires site id+token when registry is enabled. Does not authorize anonymous spend:
// live model remains gated by BUILDY_LIVE_MODEL + server agent credentials.
func Wrap(reg Registry, next http.Handler) http.Handler {
	if !reg.Enabled() {
		return next
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// healthz may stay open for probes without site (optional)
		if r.URL.Path == "/healthz" {
			next.ServeHTTP(w, r)
			return
		}
		siteID := normalizeSiteID(r.Header.Get(HeaderSiteID))
		token := r.Header.Get(HeaderSiteToken)
		if !reg.Valid(siteID, token) {
			w.Header().Set("Content-Type", "application/json")
			http.Error(w, `{"error":{"code":"site_unauthorized","message":"valid X-BuildY-Site-Id and X-BuildY-Site-Token required"}}`, http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), keySiteID, siteID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func SiteIDFrom(ctx context.Context) string {
	v, _ := ctx.Value(keySiteID).(string)
	return v
}

func WithSiteID(ctx context.Context, siteID string) context.Context {
	return context.WithValue(ctx, keySiteID, normalizeSiteID(siteID))
}
