package sessionstore

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/buildytech/chat/services/context-serve/internal/agentruntime"
	"github.com/buildytech/chat/services/context-serve/internal/pagestore"
)

var (
	ErrNotFound             = errors.New("session not found")
	ErrRunNotFound          = errors.New("run not found")
	ErrIdempotencyConflict  = errors.New("request id reused with different payload")
	ErrPageIDMismatch       = errors.New("save_page id must match session page id")
	ErrInvalidTool          = errors.New("invalid tool request")
	ErrRunNotPending        = errors.New("run is not pending")
)

type Store struct {
	pages *pagestore.Store
	// AfterPendingCommit runs after a run is durably pending. Tests use it to simulate crash.
	AfterPendingCommit func(ctx context.Context, runID string) error
}

func New(pages *pagestore.Store) *Store {
	return &Store{pages: pages}
}

type Session struct {
	ID           string `json:"id"`
	PageID       string `json:"pageId"`
	SlugIntent   string `json:"slugIntent,omitempty"`
	Title        string `json:"title"`
	PageBound     bool   `json:"pageBound"`
	PageRevision *int64 `json:"pageRevision"`
	CreatedAt    string `json:"createdAt"`
	UpdatedAt    string `json:"updatedAt"`
}

type Message struct {
	ID        string `json:"id"`
	SessionID string `json:"sessionId"`
	Seq       int64  `json:"seq"`
	Role      string `json:"role"`
	Content   string `json:"content"`
	RunID     string `json:"runId,omitempty"`
	CreatedAt string `json:"createdAt"`
}

type Run struct {
	ID           string          `json:"id"`
	SessionID    string          `json:"sessionId"`
	RequestID    string          `json:"requestId,omitempty"`
	Status       string          `json:"status"`
	RequestHash  string          `json:"requestHash,omitempty"`
	Result       json.RawMessage `json:"result,omitempty"`
	ErrorCode    string          `json:"errorCode,omitempty"`
	ErrorMessage string          `json:"errorMessage,omitempty"`
	CreatedAt    string          `json:"createdAt"`
	UpdatedAt    string          `json:"updatedAt"`
}

type TurnResult struct {
	Run      Run                `json:"run"`
	Messages []Message          `json:"messages"`
	Session  Session            `json:"session"`
	Page     *pagestore.Record  `json:"-"`
	PageBody *pageBody          `json:"page"`
}

type pageBody struct {
	Page     any   `json:"page"`
	Revision int64 `json:"revision"`
}

func (s *Store) Create(ctx context.Context, slugIntent, title string) (Session, error) {
	slugIntent = strings.TrimSpace(slugIntent)
	title = strings.TrimSpace(title)
	now := nowUTC()
	sess := Session{
		ID:         newID("sess"),
		PageID:     newID("page"),
		SlugIntent: slugIntent,
		Title:      title,
		PageBound:   false,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	_, err := s.pages.DB().ExecContext(ctx, `INSERT INTO sessions (id, page_id, slug_intent, title, page_revision, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, ?, ?)`,
		sess.ID, sess.PageID, nullIfEmpty(slugIntent), title, now, now)
	if err != nil {
		return Session{}, err
	}
	return sess, nil
}

func (s *Store) List(ctx context.Context) ([]Session, error) {
	rows, err := s.pages.DB().QueryContext(ctx, `SELECT id, page_id, slug_intent, title, page_revision, created_at, updated_at FROM sessions ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Session, 0)
	for rows.Next() {
		sess, err := scanSession(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, sess)
	}
	return out, rows.Err()
}

func (s *Store) Get(ctx context.Context, id string) (Session, error) {
	row := s.pages.DB().QueryRowContext(ctx, `SELECT id, page_id, slug_intent, title, page_revision, created_at, updated_at FROM sessions WHERE id = ?`, id)
	return scanSession(row)
}

func (s *Store) ListMessages(ctx context.Context, sessionID string) ([]Message, error) {
	if _, err := s.Get(ctx, sessionID); err != nil {
		return nil, err
	}
	rows, err := s.pages.DB().QueryContext(ctx, `SELECT id, session_id, seq, role, content, run_id, created_at FROM messages WHERE session_id = ? ORDER BY seq ASC`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Message, 0)
	for rows.Next() {
		m, err := scanMessage(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s *Store) GetRun(ctx context.Context, sessionID, runID string) (Run, error) {
	row := s.pages.DB().QueryRowContext(ctx, `SELECT id, session_id, request_id, status, request_hash, result_json, error_code, error_message, created_at, updated_at FROM runs WHERE id = ? AND session_id = ?`, runID, sessionID)
	return scanRun(row)
}

func (s *Store) PostMessage(ctx context.Context, sessionID string, req agentruntime.TurnRequest) (TurnResult, error) {
	sess, err := s.Get(ctx, sessionID)
	if err != nil {
		return TurnResult{}, err
	}
	req.RequestID = strings.TrimSpace(req.RequestID)
	req.Content = strings.TrimSpace(req.Content)
	if req.Tools == nil {
		req.Tools = []agentruntime.ToolCall{}
	}
	hash, err := agentruntime.HashRequest(req)
	if err != nil {
		return TurnResult{}, err
	}
	if req.RequestID != "" {
		if existing, ok, err := s.lookupRequest(ctx, req.RequestID); err != nil {
			return TurnResult{}, err
		} else if ok {
			if existing.RequestHash != hash {
				return TurnResult{}, ErrIdempotencyConflict
			}
			return s.materializeTurn(ctx, existing)
		}
	}

	plan, err := agentruntime.PlanTurn(req)
	if err != nil {
		return TurnResult{}, fmt.Errorf("%w: %v", ErrInvalidTool, err)
	}

	rawReq, err := json.Marshal(req)
	if err != nil {
		return TurnResult{}, err
	}
	now := nowUTC()
	runID := newID("run")

	// Phase 1: durable pending run + user message.
	tx, err := s.pages.BeginTx(ctx, nil)
	if err != nil {
		return TurnResult{}, err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.ExecContext(ctx, `PRAGMA foreign_keys = ON;`); err != nil {
		return TurnResult{}, err
	}
	seq, err := nextSeq(ctx, tx, sessionID)
	if err != nil {
		return TurnResult{}, err
	}
	userMsg := Message{
		ID: newID("msg"), SessionID: sessionID, Seq: seq, Role: "user",
		Content: req.Content, RunID: runID, CreatedAt: now,
	}
	if userMsg.Content == "" && plan.SavePage != nil {
		userMsg.Content = "(explicit save_page tool request)"
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO runs (id, session_id, request_id, status, request_hash, request_json, created_at, updated_at) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)`,
		runID, sessionID, nullIfEmpty(req.RequestID), hash, string(rawReq), now, now); err != nil {
		if req.RequestID != "" && isUnique(err) {
			_ = tx.Rollback()
			existing, ok, lookErr := s.lookupRequest(ctx, req.RequestID)
			if lookErr != nil {
				return TurnResult{}, lookErr
			}
			if ok {
				if existing.RequestHash != hash {
					return TurnResult{}, ErrIdempotencyConflict
				}
				return s.materializeTurn(ctx, existing)
			}
		}
		return TurnResult{}, err
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO messages (id, session_id, seq, role, content, run_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		userMsg.ID, userMsg.SessionID, userMsg.Seq, userMsg.Role, userMsg.Content, userMsg.RunID, userMsg.CreatedAt); err != nil {
		return TurnResult{}, err
	}
	if strings.TrimSpace(sess.Title) == "" && userMsg.Content != "" && userMsg.Content != "(explicit save_page tool request)" {
		title := userMsg.Content
		runes := []rune(title)
		if len(runes) > 48 {
			title = string(runes[:48])
		}
		if _, err := tx.ExecContext(ctx, `UPDATE sessions SET title = ?, updated_at = ? WHERE id = ? AND title = ''`, title, now, sessionID); err != nil {
			return TurnResult{}, err
		}
		sess.Title = title
		sess.UpdatedAt = now
	}
	if err := tx.Commit(); err != nil {
		return TurnResult{}, err
	}
	if s.AfterPendingCommit != nil {
		if err := s.AfterPendingCommit(ctx, runID); err != nil {
			return TurnResult{}, err
		}
	}
	return s.completeRun(ctx, sess, runID, req, plan)
}

func (s *Store) RecoverRun(ctx context.Context, sessionID, runID string) (TurnResult, error) {
	run, err := s.GetRun(ctx, sessionID, runID)
	if err != nil {
		return TurnResult{}, err
	}
	if run.Status != "pending" {
		if run.Status == "completed" || run.Status == "failed" {
			return s.materializeTurn(ctx, run)
		}
		return TurnResult{}, ErrRunNotPending
	}
	sess, err := s.Get(ctx, sessionID)
	if err != nil {
		return TurnResult{}, err
	}
	var req agentruntime.TurnRequest
	raw, err := s.requestJSON(ctx, runID)
	if err != nil {
		return TurnResult{}, err
	}
	if err := json.Unmarshal(raw, &req); err != nil {
		return TurnResult{}, err
	}
	plan, err := agentruntime.PlanTurn(req)
	if err != nil {
		return TurnResult{}, fmt.Errorf("%w: %v", ErrInvalidTool, err)
	}
	return s.completeRun(ctx, sess, runID, req, plan)
}

func (s *Store) completeRun(ctx context.Context, sess Session, runID string, req agentruntime.TurnRequest, plan agentruntime.TurnPlan) (TurnResult, error) {
	tx, err := s.pages.BeginTx(ctx, nil)
	if err != nil {
		return TurnResult{}, err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.ExecContext(ctx, `PRAGMA foreign_keys = ON;`); err != nil {
		return TurnResult{}, err
	}

	var status string
	if err := tx.QueryRowContext(ctx, `SELECT status FROM runs WHERE id = ? AND session_id = ?`, runID, sess.ID).Scan(&status); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return TurnResult{}, ErrRunNotFound
		}
		return TurnResult{}, err
	}
	if status != "pending" {
		_ = tx.Rollback()
		run, err := s.GetRun(ctx, sess.ID, runID)
		if err != nil {
			return TurnResult{}, err
		}
		return s.materializeTurn(ctx, run)
	}

	now := nowUTC()
	var pageRec *pagestore.Record
	msgs := make([]Message, 0, 3)

	if plan.SavePage != nil {
		pageMap, ok := plan.SavePage.Page.(map[string]any)
		if !ok {
			// re-decode via JSON for typed maps from request
			raw, err := json.Marshal(plan.SavePage.Page)
			if err != nil {
				return TurnResult{}, err
			}
			if err := json.Unmarshal(raw, &pageMap); err != nil {
				return TurnResult{}, err
			}
		}
		if id, _ := pageMap["id"].(string); id != "" && id != sess.PageID {
			return TurnResult{}, ErrPageIDMismatch
		}
		pageMap["id"] = sess.PageID
		if _, hasSlug := pageMap["slug"]; !hasSlug || pageMap["slug"] == "" || pageMap["slug"] == nil {
			if sess.SlugIntent != "" {
				pageMap["slug"] = sess.SlugIntent
			}
		}

		var rec pagestore.Record
		var err error
		idem := req.RequestID
		if sess.PageBound {
			expected := int64(0)
			if plan.SavePage.ExpectedRevision != nil {
				expected = *plan.SavePage.ExpectedRevision
			} else if sess.PageRevision != nil {
				expected = *sess.PageRevision
			} else {
				return TurnResult{}, pagestore.ErrRevisionConflict
			}
			rec, err = s.pages.UpdateDraftTx(ctx, tx, sess.PageID, expected, pageMap, idem)
		} else {
			rec, err = s.pages.CreateDraftTx(ctx, tx, pageMap, idem)
		}
		if err != nil {
			return TurnResult{}, err
		}
		pageRec = &rec
		rev := rec.Revision
		if _, err := tx.ExecContext(ctx, `UPDATE sessions SET page_revision = ?, title = ?, updated_at = ? WHERE id = ?`,
			rev, coalesceTitle(sess.Title, rec.Page.Title), now, sess.ID); err != nil {
			return TurnResult{}, err
		}
		sess.PageBound = true
		sess.PageRevision = &rev
		sess.Title = coalesceTitle(sess.Title, rec.Page.Title)
		sess.UpdatedAt = now

		toolMsg := Message{
			ID: newID("msg"), SessionID: sess.ID, Role: "tool",
			Content: fmt.Sprintf(`{"tool":"save_page","pageId":%q,"revision":%d,"slug":%q}`, rec.Page.ID, rec.Revision, rec.Page.Slug),
			RunID: runID, CreatedAt: now,
		}
		seq, err := nextSeq(ctx, tx, sess.ID)
		if err != nil {
			return TurnResult{}, err
		}
		toolMsg.Seq = seq
		if _, err := tx.ExecContext(ctx, `INSERT INTO messages (id, session_id, seq, role, content, run_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			toolMsg.ID, toolMsg.SessionID, toolMsg.Seq, toolMsg.Role, toolMsg.Content, toolMsg.RunID, toolMsg.CreatedAt); err != nil {
			return TurnResult{}, err
		}
		msgs = append(msgs, toolMsg)
	}

	asst := Message{
		ID: newID("msg"), SessionID: sess.ID, Role: "assistant",
		Content: plan.AssistantText, RunID: runID, CreatedAt: now,
	}
	seq, err := nextSeq(ctx, tx, sess.ID)
	if err != nil {
		return TurnResult{}, err
	}
	asst.Seq = seq
	if _, err := tx.ExecContext(ctx, `INSERT INTO messages (id, session_id, seq, role, content, run_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		asst.ID, asst.SessionID, asst.Seq, asst.Role, asst.Content, asst.RunID, asst.CreatedAt); err != nil {
		return TurnResult{}, err
	}
	msgs = append(msgs, asst)

	result := map[string]any{
		"assistantText": plan.AssistantText,
		"saved":         pageRec != nil,
	}
	if pageRec != nil {
		result["pageId"] = pageRec.Page.ID
		result["revision"] = pageRec.Revision
		result["slug"] = pageRec.Page.Slug
	}
	rawResult, err := json.Marshal(result)
	if err != nil {
		return TurnResult{}, err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE runs SET status = 'completed', result_json = ?, updated_at = ?, error_code = NULL, error_message = NULL WHERE id = ? AND status = 'pending'`,
		string(rawResult), now, runID); err != nil {
		return TurnResult{}, err
	}
	if !sess.PageBound {
		if _, err := tx.ExecContext(ctx, `UPDATE sessions SET updated_at = ? WHERE id = ?`, now, sess.ID); err != nil {
			return TurnResult{}, err
		}
		sess.UpdatedAt = now
	}
	if err := tx.Commit(); err != nil {
		return TurnResult{}, err
	}

	run, err := s.GetRun(ctx, sess.ID, runID)
	if err != nil {
		return TurnResult{}, err
	}
	// Include the user message for response convenience.
	all, err := s.messagesForRun(ctx, sess.ID, runID)
	if err != nil {
		return TurnResult{}, err
	}
	out := TurnResult{Run: run, Messages: all, Session: sess}
	if pageRec != nil {
		out.Page = pageRec
		out.PageBody = &pageBody{Page: pageRec.Page, Revision: pageRec.Revision}
	}
	_ = msgs
	return out, nil
}

func (s *Store) materializeTurn(ctx context.Context, run Run) (TurnResult, error) {
	sess, err := s.Get(ctx, run.SessionID)
	if err != nil {
		return TurnResult{}, err
	}
	msgs, err := s.messagesForRun(ctx, run.SessionID, run.ID)
	if err != nil {
		return TurnResult{}, err
	}
	out := TurnResult{Run: run, Messages: msgs, Session: sess}
	if sess.PageBound {
		rec, err := s.pages.GetByID(ctx, sess.PageID)
		if err == nil {
			out.Page = &rec
			out.PageBody = &pageBody{Page: rec.Page, Revision: rec.Revision}
		}
	}
	return out, nil
}

func (s *Store) messagesForRun(ctx context.Context, sessionID, runID string) ([]Message, error) {
	rows, err := s.pages.DB().QueryContext(ctx, `SELECT id, session_id, seq, role, content, run_id, created_at FROM messages WHERE session_id = ? AND run_id = ? ORDER BY seq ASC`, sessionID, runID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]Message, 0)
	for rows.Next() {
		m, err := scanMessage(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s *Store) lookupRequest(ctx context.Context, requestID string) (Run, bool, error) {
	row := s.pages.DB().QueryRowContext(ctx, `SELECT id, session_id, request_id, status, request_hash, result_json, error_code, error_message, created_at, updated_at FROM runs WHERE request_id = ?`, requestID)
	run, err := scanRun(row)
	if errors.Is(err, ErrRunNotFound) || errors.Is(err, sql.ErrNoRows) {
		return Run{}, false, nil
	}
	if err != nil {
		return Run{}, false, err
	}
	return run, true, nil
}

func (s *Store) requestJSON(ctx context.Context, runID string) ([]byte, error) {
	var raw string
	err := s.pages.DB().QueryRowContext(ctx, `SELECT request_json FROM runs WHERE id = ?`, runID).Scan(&raw)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrRunNotFound
	}
	return []byte(raw), err
}

func (s *Store) PageCounts(ctx context.Context) (pages, revisions int, err error) {
	return s.pages.Counts(ctx)
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanSession(row rowScanner) (Session, error) {
	var sess Session
	var slug sql.NullString
	var rev sql.NullInt64
	err := row.Scan(&sess.ID, &sess.PageID, &slug, &sess.Title, &rev, &sess.CreatedAt, &sess.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Session{}, ErrNotFound
	}
	if err != nil {
		return Session{}, err
	}
	if slug.Valid {
		sess.SlugIntent = slug.String
	}
	if rev.Valid {
		v := rev.Int64
		sess.PageRevision = &v
		sess.PageBound = true
	}
	return sess, nil
}

func scanMessage(row rowScanner) (Message, error) {
	var m Message
	var runID sql.NullString
	err := row.Scan(&m.ID, &m.SessionID, &m.Seq, &m.Role, &m.Content, &runID, &m.CreatedAt)
	if err != nil {
		return Message{}, err
	}
	if runID.Valid {
		m.RunID = runID.String
	}
	return m, nil
}

func scanRun(row rowScanner) (Run, error) {
	var run Run
	var reqID sql.NullString
	var result sql.NullString
	var errCode, errMsg sql.NullString
	err := row.Scan(&run.ID, &run.SessionID, &reqID, &run.Status, &run.RequestHash, &result, &errCode, &errMsg, &run.CreatedAt, &run.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Run{}, ErrRunNotFound
	}
	if err != nil {
		return Run{}, err
	}
	if reqID.Valid {
		run.RequestID = reqID.String
	}
	if result.Valid {
		run.Result = json.RawMessage(result.String)
	}
	if errCode.Valid {
		run.ErrorCode = errCode.String
	}
	if errMsg.Valid {
		run.ErrorMessage = errMsg.String
	}
	return run, nil
}

func nextSeq(ctx context.Context, tx *sql.Tx, sessionID string) (int64, error) {
	var seq sql.NullInt64
	if err := tx.QueryRowContext(ctx, `SELECT MAX(seq) FROM messages WHERE session_id = ?`, sessionID).Scan(&seq); err != nil {
		return 0, err
	}
	if !seq.Valid {
		return 1, nil
	}
	return seq.Int64 + 1, nil
}

func newID(prefix string) string {
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		panic(err)
	}
	return prefix + "-" + hex.EncodeToString(b[:])
}

func nowUTC() string {
	return time.Now().UTC().Format(time.RFC3339Nano)
}

func nullIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func coalesceTitle(a, b string) string {
	if strings.TrimSpace(a) != "" {
		return a
	}
	return b
}

func isUnique(err error) bool {
	return err != nil && strings.Contains(err.Error(), "UNIQUE constraint failed")
}
