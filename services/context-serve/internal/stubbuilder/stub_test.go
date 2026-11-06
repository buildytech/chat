package stubbuilder

import (
	"context"
	"strings"
	"testing"

	"github.com/buildytech/chat/services/context-serve/internal/agentruntime"
	"github.com/buildytech/chat/services/context-serve/internal/pagecontract"
)

func TestBuildIsValidatedDraft(t *testing.T) {
	doc, err := Build(context.Background(), SessionView{
		ID: "sess-abcd1234abcd1234", PageID: "page-abcd1234abcd1234", SlugIntent: "home",
	}, agentruntime.TurnRequest{Content: "Harbor tables"})
	if err != nil {
		t.Fatal(err)
	}
	page, err := pagecontract.ParseDraftPage(doc)
	if err != nil {
		t.Fatal(err)
	}
	if page.ID != "page-abcd1234abcd1234" || page.Slug != "home" {
		t.Fatalf("%+v", page)
	}
	if page.Title != "Harbor tables" {
		t.Fatalf("title %q", page.Title)
	}
}

func TestBuildStripsMarkupAndIsNotLiveModel(t *testing.T) {
	doc, err := Build(context.Background(), SessionView{
		ID: "sess-abcd1234abcd1234", PageID: "page-abcd1234abcd1234",
	}, agentruntime.TurnRequest{Content: "Hello <script> {}"})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(doc["title"].(string), "<") {
		t.Fatalf("markup leaked: %v", doc["title"])
	}
	if Name != "deterministic-test-stub" {
		t.Fatalf("builder name %s", Name)
	}
}
