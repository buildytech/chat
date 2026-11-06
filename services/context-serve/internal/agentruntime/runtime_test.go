package agentruntime

import (
	"strings"
	"testing"
)

func TestPlanTurnConversationNoSave(t *testing.T) {
	plan, err := PlanTurn(TurnRequest{Content: "hi"})
	if err != nil {
		t.Fatal(err)
	}
	if plan.SavePage != nil {
		t.Fatal("conversation planned a save")
	}
	if !strings.Contains(plan.AssistantText, "ordinary conversation") {
		t.Fatalf("assistant text %q", plan.AssistantText)
	}
}

func TestPlanTurnRequiresExplicitTool(t *testing.T) {
	_, err := PlanTurn(TurnRequest{Content: "please create the page now"})
	if err != nil {
		t.Fatal(err)
	}
	plan, err := PlanTurn(TurnRequest{
		Tools: []ToolCall{{Name: ToolSavePage, Arguments: map[string]any{"page": map[string]any{"id": "page-x"}}}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if plan.SavePage == nil {
		t.Fatal("expected save")
	}
}

func TestHashRequestIgnoresIdempotencyKey(t *testing.T) {
	a, err := HashRequest(TurnRequest{Content: "hi", RequestID: "k1"})
	if err != nil {
		t.Fatal(err)
	}
	b, err := HashRequest(TurnRequest{Content: "hi", RequestID: "k2"})
	if err != nil {
		t.Fatal(err)
	}
	if a != b {
		t.Fatal("payload hash must ignore request id")
	}
	c, err := HashRequest(TurnRequest{Content: "other", RequestID: "k1"})
	if err != nil {
		t.Fatal(err)
	}
	if a == c {
		t.Fatal("different payload must hash differently")
	}
}
