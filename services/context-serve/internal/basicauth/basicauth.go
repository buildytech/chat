package basicauth

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"net/http"
	"os"
	"strings"
)

// Config is optional HTTP Basic Auth for Session (dev / WP proxy).
// When User is empty, Wrap is a no-op (preserves local Vite loopback).
type Config struct {
	User string
	Pass string
}

func FromEnv() Config {
	return Config{
		User: strings.TrimSpace(os.Getenv("BUILDY_BASIC_AUTH_USER")),
		Pass: os.Getenv("BUILDY_BASIC_AUTH_PASS"),
	}
}

func (c Config) Enabled() bool {
	return c.User != "" && c.Pass != ""
}

// Wrap enforces Basic Auth when enabled. Realm is fixed for Session.
func Wrap(cfg Config, next http.Handler) http.Handler {
	if !cfg.Enabled() {
		return next
	}
	wantUser := sha256.Sum256([]byte(cfg.User))
	wantPass := sha256.Sum256([]byte(cfg.Pass))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, pass, ok := parseBasic(r.Header.Get("Authorization"))
		if !ok {
			challenge(w)
			return
		}
		gotUser := sha256.Sum256([]byte(user))
		gotPass := sha256.Sum256([]byte(pass))
		userOK := subtle.ConstantTimeCompare(gotUser[:], wantUser[:]) == 1
		passOK := subtle.ConstantTimeCompare(gotPass[:], wantPass[:]) == 1
		if userOK && passOK {
			next.ServeHTTP(w, r)
			return
		}
		challenge(w)
	})
}

func challenge(w http.ResponseWriter) {
	w.Header().Set("WWW-Authenticate", `Basic realm="buildy-session"`)
	http.Error(w, `{"error":{"code":"unauthorized","message":"basic auth required"}}`, http.StatusUnauthorized)
}

func parseBasic(h string) (user, pass string, ok bool) {
	const p = "Basic "
	if !strings.HasPrefix(h, p) {
		return "", "", false
	}
	raw, err := base64.StdEncoding.DecodeString(strings.TrimSpace(h[len(p):]))
	if err != nil {
		return "", "", false
	}
	parts := strings.SplitN(string(raw), ":", 2)
	if len(parts) != 2 {
		return "", "", false
	}
	return parts[0], parts[1], true
}
