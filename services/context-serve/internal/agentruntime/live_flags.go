package agentruntime

import (
	"context"
	"os"
	"strings"
	"sync/atomic"
	"time"

	"github.com/buildytech/chat/services/context-serve/internal/contextclient"
	"github.com/buildytech/chat/services/context-serve/internal/lexproto"
)

// liveSuccess is set only after a real live model turn succeeds (not from env alone).
var liveSuccess atomic.Bool

// crProbed caches last successful CR health (process-local; refreshed by ProbeContextRuntime).
var crReady atomic.Bool

// MarkLiveSuccess records that a real model request completed successfully.
func MarkLiveSuccess() { liveSuccess.Store(true) }

// ClearLiveSuccess supports manual disable after owner testing.
func ClearLiveSuccess() { liveSuccess.Store(false) }

// LiveRequested is the env opt-in (intent). Truthful liveModel capability still
// requires MarkLiveSuccess after a real adapter turn.
func LiveRequested() bool {
	v := strings.TrimSpace(os.Getenv("BUILDY_LIVE_MODEL"))
	return v == "1" || strings.EqualFold(v, "true") || strings.EqualFold(v, "on")
}

func liveModelEnabled() bool { return LiveRequested() }

// ProbeContextRuntime hits the real CR /health. Call at process start and from Capabilities.
func ProbeContextRuntime() bool {
	c := contextclient.FromEnv()
	if c == nil {
		crReady.Store(false)
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 1500*time.Millisecond)
	defer cancel()
	h, err := c.Health(ctx)
	ok := err == nil && (h.APIVersion == "v1" || h.OK || h.Ready)
	crReady.Store(ok)
	return ok
}

func contextRuntimeEnabled() bool {
	// Prefer last probe; re-probe cheaply when never succeeded yet.
	if crReady.Load() {
		return true
	}
	return ProbeContextRuntime()
}

func lexprotoEnabled() bool {
	// Never invent availability from BUILDY_LEXPROTO env — adapter probe only.
	return lexproto.NewDefault().Available()
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

func lexprotoStatusMap() map[string]any {
	return lexproto.Status()
}
