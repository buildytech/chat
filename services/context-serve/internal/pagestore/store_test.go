package pagestore

import (
	"context"
	"database/sql"
	"errors"
	"path/filepath"
	"strconv"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/buildytech/chat/services/context-serve/internal/pagecontract"
)

func openStore(t *testing.T) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "pages.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = s.Close() })
	return s
}

func fixtureMap(t *testing.T) map[string]any {
	t.Helper()
	doc, err := pagecontract.CloneValidDraftMap()
	if err != nil {
		t.Fatal(err)
	}
	return doc
}

func withIDSlug(t *testing.T, id, slug string) map[string]any {
	t.Helper()
	doc := fixtureMap(t)
	doc["id"] = id
	doc["slug"] = slug
	return doc
}

func TestCreateGetRestart(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "pages.sqlite")
	ctx := context.Background()
	s, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	rec, err := s.CreateDraft(ctx, fixtureMap(t), "")
	if err != nil {
		t.Fatal(err)
	}
	if rec.Revision != 1 || rec.Page.Slug != "home" {
		t.Fatalf("create %+v", rec)
	}
	got, err := s.GetByID(ctx, "page-home")
	if err != nil {
		t.Fatal(err)
	}
	if got.Page.Title != rec.Page.Title {
		t.Fatalf("get by id mismatch")
	}
	bySlug, err := s.GetBySlug(ctx, "home")
	if err != nil {
		t.Fatal(err)
	}
	if bySlug.Revision != 1 {
		t.Fatalf("slug revision %d", bySlug.Revision)
	}
	if err := s.Close(); err != nil {
		t.Fatal(err)
	}
	s2, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer s2.Close()
	again, err := s2.GetByID(ctx, "page-home")
	if err != nil {
		t.Fatal(err)
	}
	if again.Page.ID != "page-home" || again.Revision != 1 {
		t.Fatalf("restart lost page: %+v", again)
	}
}

func TestDuplicateSlugNoOverwrite(t *testing.T) {
	s := openStore(t)
	ctx := context.Background()
	if _, err := s.CreateDraft(ctx, withIDSlug(t, "page-a", "home"), ""); err != nil {
		t.Fatal(err)
	}
	_, err := s.CreateDraft(ctx, withIDSlug(t, "page-b", "home"), "")
	if !errors.Is(err, ErrDuplicateSlug) {
		t.Fatalf("got %v want duplicate slug", err)
	}
	got, err := s.GetByID(ctx, "page-a")
	if err != nil {
		t.Fatal(err)
	}
	if got.Page.ID != "page-a" {
		t.Fatalf("overwrote page")
	}
	if _, err := s.GetByID(ctx, "page-b"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("placeholder row for rejected slug: %v", err)
	}
}

func TestConcurrentSameSlug(t *testing.T) {
	s := openStore(t)
	ctx := context.Background()
	const n = 12
	var ok, conflict atomic.Int32
	var wg sync.WaitGroup
	wg.Add(n)
	for i := 0; i < n; i++ {
		i := i
		go func() {
			defer wg.Done()
			id := "page-c" + strconv.Itoa(i)
			_, err := s.CreateDraft(ctx, withIDSlug(t, id, "harbor"), "")
			switch {
			case err == nil:
				ok.Add(1)
			case errors.Is(err, ErrDuplicateSlug):
				conflict.Add(1)
			default:
				t.Errorf("unexpected %v", err)
			}
		}()
	}
	wg.Wait()
	if ok.Load() != 1 {
		t.Fatalf("successes %d want 1", ok.Load())
	}
	if conflict.Load() != int32(n-1) {
		t.Fatalf("conflicts %d", conflict.Load())
	}
	pages, revs, err := s.Counts(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if pages != 1 || revs != 1 {
		t.Fatalf("rows pages=%d revisions=%d", pages, revs)
	}
}

func TestMalformedRejected(t *testing.T) {
	s := openStore(t)
	ctx := context.Background()
	doc := fixtureMap(t)
	doc["promo"] = "off"
	_, err := s.CreateDraft(ctx, doc, "")
	var ce *pagecontract.Error
	if !errors.As(err, &ce) || ce.Code != "unexpected_key" {
		t.Fatalf("got %v", err)
	}
	pages, revs, err := s.Counts(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if pages != 0 || revs != 0 {
		t.Fatalf("wrote invalid dto pages=%d revisions=%d", pages, revs)
	}
}

func TestDuplicateIDsInDTO(t *testing.T) {
	s := openStore(t)
	ctx := context.Background()
	doc := fixtureMap(t)
	layout := doc["layout"].(map[string]any)
	blocks := layout["blocks"].([]any)
	b1 := blocks[1].(map[string]any)
	b1["id"] = "block-nav"
	_, err := s.CreateDraft(ctx, doc, "")
	var ce *pagecontract.Error
	if !errors.As(err, &ce) || ce.Code != "duplicate_id" {
		t.Fatalf("got %v", err)
	}
}

func TestRevisionConflict(t *testing.T) {
	s := openStore(t)
	ctx := context.Background()
	if _, err := s.CreateDraft(ctx, fixtureMap(t), ""); err != nil {
		t.Fatal(err)
	}
	doc := fixtureMap(t)
	doc["title"] = "Harbor Kitchen"
	first, err := s.UpdateDraft(ctx, "page-home", 1, doc, "")
	if err != nil {
		t.Fatal(err)
	}
	if first.Revision != 2 {
		t.Fatalf("revision %d", first.Revision)
	}
	doc["title"] = "Stale write"
	_, err = s.UpdateDraft(ctx, "page-home", 1, doc, "")
	if !errors.Is(err, ErrRevisionConflict) {
		t.Fatalf("got %v", err)
	}
	got, err := s.GetByID(ctx, "page-home")
	if err != nil {
		t.Fatal(err)
	}
	if got.Revision != 2 || got.Page.Title != "Harbor Kitchen" {
		t.Fatalf("stale write applied: %+v", got)
	}
}

func TestRollbackAfterPageInsert(t *testing.T) {
	s := openStore(t)
	ctx := context.Background()
	s.AfterPageInsert = func(ctx context.Context, tx *sql.Tx) error {
		return errors.New("injected failure")
	}
	_, err := s.CreateDraft(ctx, fixtureMap(t), "")
	if err == nil || err.Error() != "injected failure" {
		t.Fatalf("got %v", err)
	}
	pages, revs, err := s.Counts(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if pages != 0 || revs != 0 {
		t.Fatalf("placeholder rows pages=%d revisions=%d", pages, revs)
	}
}

func TestIdempotentCreate(t *testing.T) {
	s := openStore(t)
	ctx := context.Background()
	a, err := s.CreateDraft(ctx, fixtureMap(t), "req-1")
	if err != nil {
		t.Fatal(err)
	}
	b, err := s.CreateDraft(ctx, fixtureMap(t), "req-1")
	if err != nil {
		t.Fatal(err)
	}
	if a.Revision != b.Revision || a.Page.ID != b.Page.ID {
		t.Fatalf("idempotency mismatch")
	}
	pages, revs, err := s.Counts(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if pages != 1 || revs != 1 {
		t.Fatalf("idempotency duplicated rows pages=%d revisions=%d", pages, revs)
	}
}

func TestIdempotentConflictDifferentPayloadNoPartialRows(t *testing.T) {
	s := openStore(t)
	ctx := context.Background()
	if _, err := s.CreateDraft(ctx, fixtureMap(t), "req-1"); err != nil {
		t.Fatal(err)
	}
	doc := fixtureMap(t)
	doc["title"] = "Different Payload"
	_, err := s.CreateDraft(ctx, doc, "req-1")
	if !errors.Is(err, ErrIdempotencyConflict) {
		t.Fatalf("got %v", err)
	}
	pages, revs, err := s.Counts(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if pages != 1 || revs != 1 {
		t.Fatalf("conflict wrote rows pages=%d revisions=%d", pages, revs)
	}
	got, err := s.GetByID(ctx, "page-home")
	if err != nil {
		t.Fatal(err)
	}
	if got.Page.Title == "Different Payload" {
		t.Fatal("conflicting payload was stored")
	}
}
