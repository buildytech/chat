// Package liveruntime runs one opt-in @grok/agent-sdk turn and maps propose_page
// into agentruntime.TurnPlan for Session finishTurn (validated save_page path).
//
// Sidecar manual `agent-sdk run` alone is NOT the product goal — Session HTTP
// PostMessage must own the history/tool loop when BUILDY_LIVE_MODEL is on.
package liveruntime

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/buildytech/chat/services/context-serve/internal/agentruntime"
	"github.com/buildytech/chat/services/context-serve/internal/ui8kitcatalog"
)

const (
	DefaultAgentDir = "/workspace/var/phpingineer/buildy-page-agent"
	DefaultTimeout  = 180 * time.Second
)

var (
	ErrLiveDisabled = errors.New("live model not requested")
	ErrNoPropose    = errors.New("live agent did not call propose_page")
	ErrAgentFailed  = errors.New("agent-sdk run failed")
)

// SessionHint is the bound page identity the agent must use in propose_page.
type SessionHint struct {
	SessionID  string
	PageID     string
	SlugIntent string
	Title      string
	History    []HistoryMessage // prior turns (oldest first), optional
}

type HistoryMessage struct {
	Role    string
	Content string
}

// Config controls the agent-sdk subprocess.
type Config struct {
	AgentDir   string
	NodeBin    string
	Timeout    time.Duration
	APIKeyEnv  string // default CURSOR_API_KEY — never logged
	ExtraEnv   map[string]string
}

func (c Config) withDefaults() Config {
	if c.AgentDir == "" {
		c.AgentDir = strings.TrimSpace(os.Getenv("BUILDY_PAGE_AGENT_DIR"))
	}
	if c.AgentDir == "" {
		c.AgentDir = DefaultAgentDir
	}
	if c.NodeBin == "" {
		c.NodeBin = "node"
	}
	if c.Timeout <= 0 {
		c.Timeout = DefaultTimeout
	}
	if c.APIKeyEnv == "" {
		c.APIKeyEnv = "CURSOR_API_KEY"
	}
	return c
}

// Runner invokes agent-sdk run --json once per Session turn.
type Runner struct {
	Cfg Config
}

// Plan implements the live path: content-only turns → model tool loop → TurnPlan.
func (r *Runner) Plan(ctx context.Context, hint SessionHint, req agentruntime.TurnRequest) (agentruntime.TurnPlan, error) {
	cfg := r.Cfg.withDefaults()
	if !agentruntime.LiveRequested() {
		return agentruntime.TurnPlan{}, ErrLiveDisabled
	}
	if len(req.Tools) > 0 {
		// Explicit client tools stay on deterministic PlanTurn (no duplicate live write).
		return agentruntime.PlanTurn(req)
	}
	content := strings.TrimSpace(req.Content)
	if content == "" {
		return agentruntime.TurnPlan{}, fmt.Errorf("content is required for live turn")
	}

	msg := buildUserMessage(hint, content)
	sdkJS := filepath.Join(cfg.AgentDir, "node_modules/@grok/agent-sdk/dist/bin/agent-serve.js")
	if _, err := os.Stat(sdkJS); err != nil {
		return agentruntime.TurnPlan{}, fmt.Errorf("%w: agent-sdk missing at %s", ErrAgentFailed, sdkJS)
	}

	timeout := cfg.Timeout
	if dl, ok := ctx.Deadline(); ok {
		if rem := time.Until(dl); rem > 0 && rem < timeout {
			timeout = rem
		}
	}
	runCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	tracePath := filepath.Join(os.TempDir(), fmt.Sprintf("buildy-live-%s.ndjson", hint.SessionID))
	args := []string{
		sdkJS, "run",
		"--dir", cfg.AgentDir,
		"--message", msg,
		"--json",
		"--no-stream",
		"--timeout-ms", fmt.Sprintf("%d", timeout.Milliseconds()),
		"--trace", tracePath,
	}
	cmd := exec.CommandContext(runCtx, cfg.NodeBin, args...)
	cmd.Dir = cfg.AgentDir
	cmd.Env = buildEnv(cfg)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	out := stdout.Bytes()
	if err != nil {
		return agentruntime.TurnPlan{}, fmt.Errorf("%w: %v; stderr=%s; stdout_head=%s", ErrAgentFailed, err, clip(stderr.String(), 600), clip(string(out), 400))
	}
	payload, err := extractJSONObject(out)
	if err != nil {
		return agentruntime.TurnPlan{}, fmt.Errorf("%w: parse json: %v", ErrAgentFailed, err)
	}
	plan, err := planFromTrajectory(payload, hint)
	if err != nil {
		return agentruntime.TurnPlan{}, err
	}
	return plan, nil
}

func buildEnv(cfg Config) []string {
	env := os.Environ()
	// Ensure CR points at BuildY-owned :18085 when caller set it; do not invent tokens here.
	for k, v := range cfg.ExtraEnv {
		env = append(env, k+"="+v)
	}
	_ = cfg.APIKeyEnv // presence checked by agent-sdk; we never print it
	return env
}

func buildUserMessage(hint SessionHint, content string) string {
	var b strings.Builder
	b.WriteString("Session-integrated BuildY Creator turn.\n")
	b.WriteString("sessionId="+hint.SessionID+"\n")
	b.WriteString("pageId="+hint.PageID+" (MUST be page.id in propose_page)\n")
	if hint.SlugIntent != "" {
		b.WriteString("slugIntent="+hint.SlugIntent+"\n")
	}
	if hint.Title != "" {
		b.WriteString("sessionTitle="+hint.Title+"\n")
	}
	b.WriteString("\n")
	b.WriteString(ui8kitcatalog.FormatForPrompt())
	b.WriteString("\nCatalog prices: use pack_price / pack_price_display with weight \"100 гр\" from context_pack only. No currency/RUB field in corpus — do not invent ₽. No promo/delivery facts unless in pack.\n")
	b.WriteString("Call context_pack first, then propose_page at most once. Do not call save_page HTTP.\n")
	if len(hint.History) > 0 {
		b.WriteString("\n--- prior messages ---\n")
		for _, m := range hint.History {
			b.WriteString(m.Role + ": " + clip(m.Content, 1200) + "\n")
		}
		b.WriteString("--- end prior ---\n")
	}
	b.WriteString("\nUser request:\n")
	b.WriteString(content)
	return b.String()
}

type runPayload struct {
	OK         bool           `json:"ok"`
	SessionID  string         `json:"sessionId"`
	Trajectory trajectoryRoot `json:"trajectory"`
}

type trajectoryRoot struct {
	OK            bool   `json:"ok"`
	FinalText     string `json:"finalText"`
	ToolCallCount int    `json:"toolCallCount"`
	Turns         []struct {
		AssistantText string `json:"assistantText"`
		ToolCalls     []struct {
			ToolName string          `json:"toolName"`
			IsError  bool            `json:"isError"`
			Args     json.RawMessage `json:"args"`
			Output   json.RawMessage `json:"output"`
		} `json:"toolCalls"`
	} `json:"turns"`
}

func planFromTrajectory(raw []byte, hint SessionHint) (agentruntime.TurnPlan, error) {
	var p runPayload
	if err := json.Unmarshal(raw, &p); err != nil {
		return agentruntime.TurnPlan{}, err
	}
	if !p.OK && !p.Trajectory.OK {
		return agentruntime.TurnPlan{}, fmt.Errorf("%w: ok=false", ErrAgentFailed)
	}
	text := strings.TrimSpace(p.Trajectory.FinalText)
	var proposed any
	for _, turn := range p.Trajectory.Turns {
		if text == "" {
			text = strings.TrimSpace(turn.AssistantText)
		}
		for _, tc := range turn.ToolCalls {
			if tc.ToolName != "propose_page" || tc.IsError {
				continue
			}
			var args struct {
				Page any `json:"page"`
			}
			// Prefer args (model tool input); fall back to output.page
			if len(tc.Args) > 0 && string(tc.Args) != "null" {
				_ = json.Unmarshal(tc.Args, &args)
			}
			if args.Page == nil && len(tc.Output) > 0 {
				var out struct {
					Page any `json:"page"`
				}
				_ = json.Unmarshal(tc.Output, &out)
				args.Page = out.Page
			}
			if args.Page != nil {
				proposed = args.Page
			}
		}
	}
	if proposed == nil {
		// Conversation-only live reply (e.g. clarifying questions) is valid — no page write.
		if text == "" {
			text = "Live model replied without propose_page; no page draft was saved."
		}
		return agentruntime.TurnPlan{AssistantText: text}, nil
	}
	// Force bound page id + sanitize to Page DTO allowlist (drop href etc.)
	m, err := SanitizeProposedPage(proposed)
	if err != nil {
		return agentruntime.TurnPlan{}, fmt.Errorf("sanitize propose_page: %w", err)
	}
	m["id"] = hint.PageID
	if slug, _ := m["slug"].(string); strings.TrimSpace(slug) == "" && hint.SlugIntent != "" {
		m["slug"] = hint.SlugIntent
	}
	EnsureTimestamps(m, time.Now().UTC().Format("2006-01-02T15:04:05.000Z"))
	proposed = m
	if text == "" {
		text = "Live model proposed a page draft via propose_page; Session will validate and persist."
	}
	return agentruntime.TurnPlan{
		AssistantText: text,
		SavePage:      &agentruntime.SavePageArgs{Page: proposed},
	}, nil
}

func extractJSONObject(b []byte) ([]byte, error) {
	s := string(b)
	// agent-sdk may print log lines before the JSON document
	idx := strings.LastIndex(s, "\n{")
	if idx >= 0 {
		s = s[idx+1:]
	} else {
		idx = strings.Index(s, "{")
		if idx < 0 {
			return nil, errors.New("no json object in agent-sdk stdout")
		}
		s = s[idx:]
	}
	// trim trailing noise after matching braces
	var start = -1
	depth := 0
	inStr := false
	esc := false
	for i, r := range s {
		if inStr {
			if esc {
				esc = false
				continue
			}
			if r == '\\' {
				esc = true
				continue
			}
			if r == '"' {
				inStr = false
			}
			continue
		}
		switch r {
		case '"':
			inStr = true
		case '{':
			if depth == 0 {
				start = i
			}
			depth++
		case '}':
			depth--
			if depth == 0 && start >= 0 {
				return []byte(s[start : i+1]), nil
			}
		}
	}
	return nil, errors.New("unterminated json object")
}

func asMap(v any) (map[string]any, error) {
	if m, ok := v.(map[string]any); ok {
		return m, nil
	}
	raw, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	var m map[string]any
	return m, json.Unmarshal(raw, &m)
}

func clip(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
