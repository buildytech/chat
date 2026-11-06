package agentruntime

import "testing"

func TestPlanTurnConversationNoSave(t *testing.T) {
	plan, err := PlanTurn(TurnRequest{Content: "hi"})
	if err != nil {
		t.Fatal(err)
	}
	if plan.SavePage != nil {
		t.Fatal("conversation planned a save")
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
