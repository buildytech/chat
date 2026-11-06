// Package lexproto defines the BuildY boundary for github.com/fastygo/lexproto.
//
// Provenance (2026-11-06 Europe/Moscow):
//   https://github.com/fastygo/lexproto @ 3b092b891e67dd5c8a3fb5050725acdc01b26358
//   Tree is documentation-only (README, LICENSE, .project) — no Go module API,
//   no HTTP runtime binary, no SDK, no release artifacts.
//
// github.com/fastygo/jev (and @grok/agent-sdk/extensions/jev) is a SEPARATE
// experimental evaluate service. It MUST NOT be substituted for lexproto
// capabilities or gates.
//
// BuildY ships Adapter so Session/Agent can depend on a stable contract.
// Default implementation is Unavailable — never stub success.
package lexproto

import (
	"context"
	"errors"
	"fmt"
)

// ErrUnavailable is returned when no real lexproto runtime is installed.
var ErrUnavailable = errors.New("lexproto runtime unavailable")

// MissingArtifact describes what would be required for a real adapter.
const MissingArtifact = "github.com/fastygo/lexproto @3b092b8 is docs-only (no Go module, HTTP runtime, SDK, or release); Jev≠lexproto — do not substitute"

// UpstreamSHA is the inspected tip used for this Unavailable decision.
const UpstreamSHA = "3b092b891e67dd5c8a3fb5050725acdc01b26358"

// Request is the future evaluate/validate input once a runtime exists.
type Request struct {
	ProjectID string         `json:"project_id"`
	Query     string         `json:"query"`
	Context   map[string]any `json:"context,omitempty"`
}

// Result is the future evaluate/validate output.
type Result struct {
	OK      bool           `json:"ok"`
	Message string         `json:"message,omitempty"`
	Data    map[string]any `json:"data,omitempty"`
}

// Adapter is the BuildY lexproto port (ADR-0004 style).
type Adapter interface {
	Name() string
	Available() bool
	Evaluate(ctx context.Context, req Request) (Result, error)
}

// Unavailable is the honest default when no runtime artifact exists.
type Unavailable struct{}

func (Unavailable) Name() string    { return "lexproto-unavailable" }
func (Unavailable) Available() bool { return false }

func (Unavailable) Evaluate(_ context.Context, _ Request) (Result, error) {
	return Result{OK: false, Message: MissingArtifact}, fmt.Errorf("%w: %s", ErrUnavailable, MissingArtifact)
}

// NewDefault returns the Unavailable adapter (only truthful option today).
func NewDefault() Adapter { return Unavailable{} }

// Status is a capabilities fragment — never claims available from env flags.
func Status() map[string]any {
	a := NewDefault()
	return map[string]any{
		"available":       a.Available(),
		"adapter":         a.Name(),
		"upstream":        "github.com/fastygo/lexproto",
		"upstreamSha":     UpstreamSHA,
		"missingArtifact": MissingArtifact,
		"note":            "Jev is not lexproto; BUILDY_LEXPROTO env cannot invent a runtime",
	}
}
