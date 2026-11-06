package httpsafe

import (
	"net"
	"net/http"
	"strings"
)

// Wrap enforces loopback-oriented Host/Origin checks and never emits permissive CORS.
func Wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if host := r.Host; host != "" && !allowedHost(host) {
			writeForbidden(w, "host_not_allowed", "Host is not a loopback name")
			return
		}
		// Reject forwarded hosts that are not loopback (DNS-rebinding / proxy abuse).
		for _, hdr := range []string{"X-Forwarded-Host", "Forwarded"} {
			if v := strings.TrimSpace(r.Header.Get(hdr)); v != "" && !allowedForwarded(v) {
				writeForbidden(w, "host_not_allowed", "forwarded host is not a loopback name")
				return
			}
		}
		if origin := strings.TrimSpace(r.Header.Get("Origin")); origin != "" && !allowedOrigin(origin) {
			writeForbidden(w, "origin_not_allowed", "Origin is not a loopback origin")
			return
		}
		// Explicitly avoid Access-Control-Allow-Origin: *
		if acr := r.Header.Get("Access-Control-Request-Method"); acr != "" || r.Method == http.MethodOptions {
			w.Header().Set("Vary", "Origin")
			if origin := strings.TrimSpace(r.Header.Get("Origin")); allowedOrigin(origin) {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Idempotency-Key, If-Match")
				w.Header().Set("Access-Control-Max-Age", "600")
			}
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func allowedHost(host string) bool {
	h, _, err := net.SplitHostPort(host)
	if err != nil {
		h = host
	}
	h = strings.Trim(strings.ToLower(h), "[]")
	switch h {
	case "127.0.0.1", "localhost", "::1", "0.0.0.0":
		return true
	default:
		return false
	}
}

func allowedOrigin(origin string) bool {
	origin = strings.ToLower(strings.TrimSpace(origin))
	if origin == "" {
		return false
	}
	return strings.HasPrefix(origin, "http://127.0.0.1") ||
		strings.HasPrefix(origin, "http://localhost") ||
		strings.HasPrefix(origin, "http://[::1]")
}

func allowedForwarded(raw string) bool {
	// Forwarded: for=...;host=example.com — take host= if present, else first token.
	lower := strings.ToLower(raw)
	if strings.Contains(lower, "host=") {
		for _, part := range strings.Split(raw, ";") {
			part = strings.TrimSpace(part)
			if strings.HasPrefix(strings.ToLower(part), "host=") {
				return allowedHost(strings.Trim(part[5:], `"`))
			}
		}
	}
	// X-Forwarded-Host may be a comma list — require every entry loopback.
	for _, part := range strings.Split(raw, ",") {
		if !allowedHost(strings.TrimSpace(part)) {
			return false
		}
	}
	return true
}

func writeForbidden(w http.ResponseWriter, code, message string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusForbidden)
	_, _ = w.Write([]byte(`{"error":{"code":"` + code + `","path":"$","message":"` + message + `"}}` + "\n"))
}
