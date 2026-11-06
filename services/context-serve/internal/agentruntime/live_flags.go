package agentruntime

import (
	"context"
	"os"
	"strings"
	"sync/atomic"
	"time"

	"github.com/buildytech/chat/services/context-serve/internal/contextclient"
)

// liveSuccess is set only after a real live model turn succeeds (not from env alone).
var liveSuccess atomic.Bool

// MarkLiveSuccess records that a real model request completed successfully.
func MarkLiveSuccess() { liveSuccess.Store(true) }

// ClearLiveSuccess supports manual disable after owner testing.
func ClearLiveSuccess() { liveSuccess.Store(false) }

func liveModelEnabled() bool {
	v := strings.TrimSpace(os.Getenv("BUILDY_LIVE_MODEL"))
	return v == "1" || strings.EqualFold(v, "true") || strings.EqualFold(v, "on")
}

func contextRuntimeEnabled() bool {
	c := contextclient.FromEnv()
	if c == nil {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 1500*time.Millisecond)
	defer cancel()
	h, err := c.Health(ctx)
	return err == nil && (h.APIVersion == "v1" || h.OK || h.Ready)
}

func lexprotoEnabled() bool {
	// Jev / TypeSafe gate path — advertised only when explicitly enabled.
	v := strings.TrimSpace(os.Getenv("BUILDY_LEXPROTO"))
	return v == "1" || strings.EqualFold(v, "true") || strings.EqualFold(v, "on")
}

func liveProviderName() string {
	if p := strings.TrimSpace(os.Getenv("BUILDY_LIVE_PROVIDER")); p != "" {
		return p
	}
	if liveModelEnabled() {
		return "@grok/agent-sdk"
	}
	return ""
}

func liveModelName() string {
	if m := strings.TrimSpace(os.Getenv("BUILDY_LIVE_MODEL_NAME")); m != "" {
		return m
	}
	if liveModelEnabled() {
		return "grok-4.7"
	}
	return ""
}

func modeLabel(live, cr bool) string {
	switch {
	case live && cr:
		return "live+context-runtime"
	case live:
		return "live-requested"
	case cr:
		return "deterministic+context-runtime"
	default:
		return "deterministic-test"
	}
}
