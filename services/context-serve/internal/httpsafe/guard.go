package httpsafe

import (
	"net"
	"net/http"
	"strings"
)

// Wrap enforces loopback Host/Origin checks. Loopback bind alone does not
// stop CSRF from websites, so unexpected Host, forwarded Host, and browser
// Origins are rejected on every request, especially writes. No CORS headers
// are emitted.
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
		origin := strings.TrimSpace(r.Header.Get("Origin"))
		if origin != "" && !allowedOrigin(origin) {
			writeForbidden(w, "origin_not_allowed", "Origin is not a loopback origin")
			return
		}
		// Never emit Access-Control-Allow-Origin. Preflight cannot succeed.
		if r.Method == http.MethodOptions {
			writeForbidden(w, "cors_disabled", "browser CORS is not enabled")
			return
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
	case "127.0.0.1", "localhost", "::1":
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
