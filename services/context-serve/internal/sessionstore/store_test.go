package sessionstore

import (
	"context"
	"errors"
	"path/filepath"
	"testing"

	"github.com/buildytech/chat/services/context-serve/internal/agentruntime"
	"github.com/buildytech/chat/services/context-serve/internal/pagecontract"
	"github.com/buildytech/chat/services/context-serve/internal/pagestore"
)

func open(t *testing.T) (*Store, *pagestore.Store) {
	t.Helper()
	pages, err := pagestore.Open(filepath.Join(t.TempDir(), "pages.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = pages.Close() })
	return New(pages), pages
}

func draftFor(t *testing.T, pageID, slug string) map[string]any {
	t.Helper()
	doc, err := pagecontract.CloneValidDraftMap()
	if err != nil {
		t.Fatal(err)
	}
	doc["id"] = pageID
	doc["slug"] = slug
	return doc
}

func TestConversationDoesNotCreatePage(t *testing.T) {
	s, pages := open(t)
	ctx := context.Background()
	sess, err := s.Create(ctx, "home", "")
	if err != nil {
		t.Fatal(err)
	}
	res, err := s.PostMessage(ctx, sess.ID, agentruntime.TurnRequest{
		Content:   "What color should the hero be?",
		RequestID: "req-chat-1",
	})
	if err != nil {
		t.Fatal(err)
	}
	if res.Run.Status != "completed" {
		t.Fatalf("status %s", res.Run.Status)
	}
	if res.Session.PageBound {
		t.Fatal("conversation bound a page")
	}
	pc, rc, err := pages.Counts(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if pc != 0 || rc != 0 {
		t.Fatalf("expected zero page revisions, got pages=%d revisions=%d", pc, rc)
	}
	msgs, err := s.ListMessages(ctx, sess.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(msgs) < 2 {
		t.Fatalf("expected user+assistant messages, got %d", len(msgs))
	}
}

func TestSavePageCreatesThenUpdatesSamePage(t *testing.T) {
	s, pages := open(t)
	ctx := context.Background()
	sess, err := s.Create(ctx, "home", "")
	if err != nil {
		t.Fatal(err)
	}
	doc := draftFor(t, sess.PageID, "home")
	res, err := s.PostMessage(ctx, sess.ID, agentruntime.TurnRequest{
		Content:   "Please save",
		RequestID: "req-save-1",
		Tools: []agentruntime.ToolCall{{
			Name:      agentruntime.ToolSavePage,
			Arguments: map[string]any{"page": doc},
		}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if !res.Session.PageBound || res.Page == nil || res.Page.Revision != 1 {
		t.Fatalf("first save %+v", res.Session)
	}
	doc["title"] = "Harbor Kitchen Updated"
	rev := int64(1)
	res2, err := s.PostMessage(ctx, sess.ID, agentruntime.TurnRequest{
		RequestID: "req-save-2",
		Tools: []agentruntime.ToolCall{{
			Name: agentruntime.ToolSavePage,
			Arguments: map[string]any{
				"page":             doc,
				"expectedRevision": rev,
			},
		}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if res2.Page == nil || res2.Page.Revision != 2 {
		t.Fatalf("second save %+v", res2.Page)
	}
	if res2.Page.Page.ID != sess.PageID {
		t.Fatalf("page id changed")
	}
	pc, rc, err := pages.Counts(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if pc != 1 || rc != 2 {
		t.Fatalf("pages=%d revisions=%d", pc, rc)
	}
}

func TestNewSessionIsCleanIsolated(t *testing.T) {
	s, _ := open(t)
	ctx := context.Background()
	a, err := s.Create(ctx, "home", "A")
	if err != nil {
		t.Fatal(err)
	}
	b, err := s.Create(ctx, "about", "B")
	if err != nil {
		t.Fatal(err)
	}
	if a.PageID == b.PageID || a.ID == b.ID {
		t.Fatal("sessions leaked identity")
	}
	_, err = s.PostMessage(ctx, a.ID, agentruntime.TurnRequest{
		RequestID: "req-a",
		Tools: []agentruntime.ToolCall{{
			Name:      agentruntime.ToolSavePage,
			Arguments: map[string]any{"page": draftFor(t, a.PageID, "home")},
		}},
	})
	if err != nil {
		t.Fatal(err)
	}
	b2, err := s.Get(ctx, b.ID)
	if err != nil {
		t.Fatal(err)
	}
	if b2.PageBound {
		t.Fatal("saving A bound B")
	}
	msgs, err := s.ListMessages(ctx, b.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(msgs) != 0 {
		t.Fatalf("B should be empty, got %d", len(msgs))
	}
}

func TestIdempotentReplayAndConflict(t *testing.T) {
	s, pages := open(t)
	ctx := context.Background()
	sess, err := s.Create(ctx, "home", "")
	if err != nil {
		t.Fatal(err)
	}
	doc := draftFor(t, sess.PageID, "home")
	req := agentruntime.TurnRequest{
		RequestID: "req-idem",
		Tools: []agentruntime.ToolCall{{
			Name:      agentruntime.ToolSavePage,
			Arguments: map[string]any{"page": doc},
		}},
	}
	res1, err := s.PostMessage(ctx, sess.ID, req)
	if err != nil {
		t.Fatal(err)
	}
	res2, err := s.PostMessage(ctx, sess.ID, req)
	if err != nil {
		t.Fatal(err)
	}
	if res1.Run.ID != res2.Run.ID {
		t.Fatalf("replay created new run")
	}
	pc, rc, _ := pages.Counts(ctx)
	if pc != 1 || rc != 1 {
		t.Fatalf("replay created extra pages: %d %d", pc, rc)
	}
	doc2 := draftFor(t, sess.PageID, "home")
	doc2["title"] = "Different Payload"
	_, err = s.PostMessage(ctx, sess.ID, agentruntime.TurnRequest{
		RequestID: "req-idem",
		Tools: []agentruntime.ToolCall{{
			Name:      agentruntime.ToolSavePage,
			Arguments: map[string]any{"page": doc2},
		}},
	})
	if !errors.Is(err, ErrIdempotencyConflict) {
		t.Fatalf("got %v", err)
	}
}

func TestRestartPreservesSessionAndPage(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "pages.sqlite")
	ctx := context.Background()
	pages, err := pagestore.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	s := New(pages)
	sess, err := s.Create(ctx, "home", "")
	if err != nil {
		t.Fatal(err)
	}
	_, err = s.PostMessage(ctx, sess.ID, agentruntime.TurnRequest{
		Content:   "hi",
		RequestID: "req-chat",
	})
	if err != nil {
		t.Fatal(err)
	}
	_, err = s.PostMessage(ctx, sess.ID, agentruntime.TurnRequest{
		RequestID: "req-save",
		Tools: []agentruntime.ToolCall{{
			Name:      agentruntime.ToolSavePage,
			Arguments: map[string]any{"page": draftFor(t, sess.PageID, "home")},
		}},
	})
	if err != nil {
		t.Fatal(err)
	}
	_ = pages.Close()

	pages2, err := pagestore.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer pages2.Close()
	s2 := New(pages2)
	got, err := s2.Get(ctx, sess.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !got.PageBound || got.PageID != sess.PageID {
		t.Fatalf("restart lost binding: %+v", got)
	}
	msgs, err := s2.ListMessages(ctx, sess.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(msgs) < 3 {
		t.Fatalf("restart lost messages: %d", len(msgs))
	}
}

func TestPendingRecovery(t *testing.T) {
	s, _ := open(t)
	ctx := context.Background()
	sess, err := s.Create(ctx, "home", "")
	if err != nil {
		t.Fatal(err)
	}
	var pendingID string
	s.AfterPendingCommit = func(ctx context.Context, runID string) error {
		pendingID = runID
		return errors.New("simulated crash after pending")
	}
	_, err = s.PostMessage(ctx, sess.ID, agentruntime.TurnRequest{
		RequestID: "req-crash",
		Tools: []agentruntime.ToolCall{{
			Name:      agentruntime.ToolSavePage,
			Arguments: map[string]any{"page": draftFor(t, sess.PageID, "home")},
		}},
	})
	if err == nil || pendingID == "" {
		t.Fatalf("expected crash, err=%v pending=%s", err, pendingID)
	}
	run, err := s.GetRun(ctx, sess.ID, pendingID)
	if err != nil {
		t.Fatal(err)
	}
	if run.Status != "pending" {
		t.Fatalf("status %s", run.Status)
	}
	s.AfterPendingCommit = nil
	res, err := s.RecoverRun(ctx, sess.ID, pendingID)
	if err != nil {
		t.Fatal(err)
	}
	if res.Run.Status != "completed" || res.Page == nil {
		t.Fatalf("recover failed: %+v", res.Run)
	}
}

func TestRejectWrongPageID(t *testing.T) {
	s, _ := open(t)
	ctx := context.Background()
	sess, err := s.Create(ctx, "home", "")
	if err != nil {
		t.Fatal(err)
	}
	doc := draftFor(t, "page-other", "home")
	_, err = s.PostMessage(ctx, sess.ID, agentruntime.TurnRequest{
		RequestID: "req-wrong",
		Tools: []agentruntime.ToolCall{{
			Name:      agentruntime.ToolSavePage,
			Arguments: map[string]any{"page": doc},
		}},
	})
	if !errors.Is(err, ErrPageIDMismatch) {
		t.Fatalf("got %v", err)
	}
}
