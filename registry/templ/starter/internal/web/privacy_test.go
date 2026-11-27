package web_test

import (
	"os"
	"strings"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/core"

	"github.com/fastygo/starter/internal/config"
	"github.com/fastygo/starter/internal/preset"
	"github.com/fastygo/starter/internal/privacy"
)

const visitorIP = "203.0.113.77"

// storedLogs waits for PocketBase's batched log writer and returns the
// serialized _logs rows.
func storedLogs(t *testing.T, app core.App, wait time.Duration) string {
	t.Helper()
	var logs []*core.Log
	deadline := time.Now().Add(wait)
	for {
		logs = logs[:0]
		if err := app.LogQuery().All(&logs); err != nil {
			t.Fatal(err)
		}
		if len(logs) > 0 || time.Now().After(deadline) {
			break
		}
		time.Sleep(200 * time.Millisecond)
	}
	var b strings.Builder
	for _, l := range logs {
		b.WriteString(l.Message)
		for k, v := range l.Data {
			b.WriteString(" " + k + "=")
			if s, ok := v.(string); ok {
				b.WriteString(s)
			}
		}
		b.WriteString("\n")
	}
	return b.String()
}

func visit(s *site) {
	for _, p := range []string{"/", "/articles", "/nope", "/robots.txt"} {
		s.do("GET", p, nil, map[string]string{"X-Forwarded-For": visitorIP, "X-Real-IP": visitorIP})
	}
}

// TestAccessLogModes: off writes nothing, anon writes requests without
// IPs, full (opt-in) writes IPs. The full case proves the test can see an
// IP when one is logged.
func TestAccessLogModes(t *testing.T) {
	cases := []struct {
		mode    string
		wantAny bool
		wantIP  bool
	}{
		{config.AccessLogOff, false, false},
		{config.AccessLogAnon, true, false},
		{config.AccessLogFull, true, true},
	}
	for _, c := range cases {
		t.Run(c.mode, func(t *testing.T) {
			t.Parallel()
			s := newSite(t, preset.Blog)
			if err := privacy.ApplyLogSettings(s.app, c.mode); err != nil {
				t.Fatal(err)
			}
			visit(s)
			wait := 5 * time.Second
			logs := storedLogs(t, s.app, wait)
			if c.wantAny != (logs != "") {
				t.Fatalf("mode %s: logs present = %v, want %v:\n%s", c.mode, logs != "", c.wantAny, logs)
			}
			// the test client's remote address is 192.0.2.10
			hasIP := strings.Contains(logs, visitorIP) || strings.Contains(logs, "192.0.2.10")
			if hasIP != c.wantIP {
				t.Fatalf("mode %s: IP in logs = %v, want %v:\n%s", c.mode, hasIP, c.wantIP, logs)
			}
		})
	}
}

// TestDefaultsArePrivate guards the defaults the deploy files rely on.
func TestDefaultsArePrivate(t *testing.T) {
	if config.DefaultAccessLog != config.AccessLogOff {
		t.Fatal("SITE_ACCESS_LOG must default to off")
	}
	css, err := os.ReadFile("static/app.css")
	if err != nil {
		t.Fatal(err)
	}
	for _, bad := range []string{"@import", "url(http", "url(//", "url(\"http", "url('http"} {
		if strings.Contains(string(css), bad) {
			t.Fatalf("app.css references another host (%s)", bad)
		}
	}
	js, err := os.ReadFile("static/app.js")
	if err != nil {
		t.Fatal(err)
	}
	for _, bad := range []string{"fetch(", "XMLHttpRequest", "sendBeacon", "document.cookie", "WebSocket", "http://", "https://"} {
		if strings.Contains(string(js), bad) {
			t.Fatalf("app.js must not talk to the network or set cookies (%s)", bad)
		}
	}
}
