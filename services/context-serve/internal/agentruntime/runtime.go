package agentruntime

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
)

const (
	RuntimeName  = "context-local"
	ToolSavePage = "save_page"
)

// Capabilities describes what this foundation exposes. liveModel is always false in M3.
func Capabilities() map[string]any {
	return map[string]any{
		"runtime":   RuntimeName,
		"mode":      "deterministic-test",
		"liveModel": false,
		"builder":   "deterministic-test-stub",
		"tools":     []string{ToolSavePage},
		"features": map[string]any{
			"sessions":       true,
			"messages":       true,
			"runs":           true,
			"sse":            false,
			"abort":          false,
			"pageStore":      true,
			"agentGateway":   "foundation",
			"contextRuntime": false,
			"lexproto":       false,
		},
		"note": "M3 Session HTTP + deterministic stub builder. Not a live model. Not UI-wired. First successful turn binds one page; later turns update that page.",
	}
}

type ToolCall struct {
	Name      string         `json:"name"`
	Arguments map[string]any `json:"arguments"`
}

type TurnRequest struct {
	Content   string     `json:"content"`
	RequestID string     `json:"requestId"`
	Tools     []ToolCall `json:"tools"`
}

type TurnPlan struct {
	AssistantText string
	SavePage      *SavePageArgs
}

type SavePageArgs struct {
	Page             any
	ExpectedRevision *int64
}

func HashRequest(v any) (string, error) {
	payload := v
	if req, ok := v.(TurnRequest); ok {
		tools := req.Tools
		if tools == nil {
			tools = []ToolCall{}
		}
		payload = map[string]any{"content": req.Content, "tools": tools}
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:]), nil
}

// PlanTurn is a deterministic harness. It does not call a live model.
// Optional save_page supplies an explicit DTO; otherwise the stub builder emits one.
func PlanTurn(req TurnRequest) (TurnPlan, error) {
	tools := req.Tools
	if tools == nil {
		tools = []ToolCall{}
	}
	var save *SavePageArgs
	for i, t := range tools {
		name := strings.TrimSpace(t.Name)
		if name == "" {
			return TurnPlan{}, fmt.Errorf("tools[%d].name is required", i)
		}
		if name != ToolSavePage {
			return TurnPlan{}, fmt.Errorf("unsupported tool %q (deterministic runtime only supports save_page)", name)
		}
		if save != nil {
			return TurnPlan{}, fmt.Errorf("only one save_page tool call is allowed per turn")
		}
		args := t.Arguments
		if args == nil {
			return TurnPlan{}, fmt.Errorf("save_page arguments are required")
		}
		page, ok := args["page"]
		if !ok {
			return TurnPlan{}, fmt.Errorf("save_page.arguments.page is required")
		}
		var expected *int64
		if v, ok := args["expectedRevision"]; ok && v != nil {
			n, err := asInt64(v)
			if err != nil {
				return TurnPlan{}, fmt.Errorf("save_page.arguments.expectedRevision must be an integer")
			}
			expected = &n
		}
		save = &SavePageArgs{Page: page, ExpectedRevision: expected}
	}
	content := strings.TrimSpace(req.Content)
	if save == nil {
		if content == "" {
			return TurnPlan{}, fmt.Errorf("content is required when no tools are requested")
		}
		return TurnPlan{
			AssistantText: "Deterministic stub builder wrote the session page. Not a live model.",
		}, nil
	}
	text := "Explicit page DTO accepted by deterministic test runtime. Not a live model."
	if content != "" {
		text = "Explicit page DTO override recorded. Stub/model invocation is not live."
	}
	return TurnPlan{AssistantText: text, SavePage: save}, nil
}

func asInt64(v any) (int64, error) {
	switch n := v.(type) {
	case float64:
		return int64(n), nil
	case json.Number:
		return n.Int64()
	case int64:
		return n, nil
	case int:
		return int64(n), nil
	default:
		return 0, fmt.Errorf("not int")
	}
}
