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
	"github.com/buildytech/chat/services/context-serve/internal/pagecontract"
	"github.com/buildytech/chat/services/context-serve/internal/pagestore"
	"github.com/buildytech/chat/services/context-serve/internal/stubbuilder"
)

const (
	turnTimeout     = 8 * time.Second
	liveTurnTimeout = 180 * time.Second
)

var (
	ErrNotFound               = errors.New("session not found")
	ErrRunNotFound            = errors.New("run not found")
	ErrIdempotencyConflict    = errors.New("request id reused with different payload")
	ErrPageIDMismatch         = errors.New("page id must match session page id")
	ErrInvalidTool            = errors.New("invalid tool request")
	ErrRunNotPending          = errors.New("run is not pending")
	ErrMissingIdempotencyKey  = errors.New("Idempotency-Key or requestId is required")
	ErrIdempotencyKeyMismatch = errors.New("Idempotency-Key does not match requestId")
)

type PageBuilder func(ctx context.Context, sess stubbuilder.SessionView, req agentruntime.TurnRequest) (map[string]any, error)

// LivePlanner plans a content-only turn via the real agent runtime (history/tool loop).
// When nil or when the client sends explicit tools, PlanTurn stays deterministic.
type LivePlanner func(ctx context.Context, sess Session, req agentruntime.TurnRequest, history []Message) (agentruntime.TurnPlan, error)

type Store struct {
	pages *pagestore.Store
	// Builder defaults to the labelled deterministic stub. Tests may inject a fake.
	Builder PageBuilder
	// LivePlanner is optional; wired from main when BUILDY_LIVE_MODEL is on.
	LivePlanner LivePlanner
	// AfterPendingCommit runs after a run is durably pending. Tests use it to simulate crash.
	AfterPendingCommit func(ctx context.Context, runID string) error
}

func New(pages *pagestore.Store) *Store {
	return &Store{pages: pages, Builder: stubbuilder.Build}
}

type Session struct {
	ID           string `json:"id"`
	PageID       string `json:"pageId"`
	SlugIntent   string `json:"slugIntent,omitempty"`
	Title        string `json:"title"`
	PageBound    bool   `json:"pageBound"`
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
	Run      Run               `json:"run"`
	Messages []Message         `json:"messages"`
	Session  Session           `json:"session"`
	Page     *pagestore.Record `json:"-"`
	PageBody *pageBody         `json:"page"`
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
		PageBound:  false,
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

func (s *Store) GetRunByID(ctx context.Context, runID string) (Run, error) {
	row := s.pages.DB().QueryRowContext(ctx, `SELECT id, session_id, request_id, status, request_hash, result_json, error_code, error_message, created_at, updated_at FROM runs WHERE id = ?`, runID)
	return scanRun(row)
}

func (s *Store) PostMessage(ctx context.Context, sessionID string, req agentruntime.TurnRequest) (TurnResult, error) {
	if _, ok := ctx.Deadline(); !ok {
		to := turnTimeout
		if agentruntime.LiveRequested() && s.LivePlanner != nil {
			to = liveTurnTimeout
		}
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, to)
		defer cancel()
	}
	sess, err := s.Get(ctx, sessionID)
	if err != nil {
		return TurnResult{}, err
	}
	req.RequestID = strings.TrimSpace(req.RequestID)
	req.Content = strings.TrimSpace(req.Content)
	if req.Tools == nil {
		req.Tools = []agentruntime.ToolCall{}
	}
	if req.RequestID == "" {
		return TurnResult{}, ErrMissingIdempotencyKey
	}
	hash, err := agentruntime.HashRequest(req)
	if err != nil {
		return TurnResult{}, err
	}
	if existing, ok, err := s.lookupRequest(ctx, sessionID, req.RequestID); err != nil {
		return TurnResult{}, err
	} else if ok {
		if existing.RequestHash != hash {
			return TurnResult{}, ErrIdempotencyConflict
		}
		if existing.Status == "pending" {
			return s.RecoverRun(ctx, existing.SessionID, existing.ID)
		}
		return s.materializeTurn(ctx, existing)
	}

	plan, liveUsed, err := s.planTurn(ctx, sess, req)
	if err != nil {
		return TurnResult{}, fmt.Errorf("%w: %v", ErrInvalidTool, err)
	}
	_ = liveUsed

	rawReq, err := json.Marshal(req)
	if err != nil {
		return TurnResult{}, err
	}
	now := nowUTC()
	runID := newID("run")

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
	if userMsg.Content == "" {
		userMsg.Content = "(stub page turn)"
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO runs (id, session_id, request_id, status, request_hash, request_json, created_at, updated_at) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)`,
		runID, sessionID, req.RequestID, hash, string(rawReq), now, now); err != nil {
		if isUnique(err) {
			_ = tx.Rollback()
			existing, ok, lookErr := s.lookupRequest(ctx, sessionID, req.RequestID)
			if lookErr != nil {
				return TurnResult{}, lookErr
			}
			if ok {
				if existing.RequestHash != hash {
					return TurnResult{}, ErrIdempotencyConflict
				}
				if existing.Status == "pending" {
					return s.RecoverRun(ctx, existing.SessionID, existing.ID)
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
	if strings.TrimSpace(sess.Title) == "" && userMsg.Content != "" && userMsg.Content != "(stub page turn)" {
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
	return s.finishTurn(ctx, sess, runID, req, plan, liveUsed)
}

func (s *Store) RecoverRun(ctx context.Context, sessionID, runID string) (TurnResult, error) {
	if _, ok := ctx.Deadline(); !ok {
		to := turnTimeout
		if agentruntime.LiveRequested() && s.LivePlanner != nil {
			to = liveTurnTimeout
		}
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, to)
		defer cancel()
	}
	run, err := s.GetRun(ctx, sessionID, runID)
	if err != nil {
		return TurnResult{}, err
	}
	if run.Status != "pending" {
		return s.materializeTurn(ctx, run)
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
	plan, liveUsed, err := s.planTurn(ctx, sess, req)
	if err != nil {
		_ = s.failRun(ctx, runID, fmt.Errorf("%w: %v", ErrInvalidTool, err))
		return TurnResult{}, fmt.Errorf("%w: %v", ErrInvalidTool, err)
	}
	return s.finishTurn(ctx, sess, runID, req, plan, liveUsed)
}

func (s *Store) planTurn(ctx context.Context, sess Session, req agentruntime.TurnRequest) (agentruntime.TurnPlan, bool, error) {
	useLive := agentruntime.LiveRequested() && s.LivePlanner != nil && len(req.Tools) == 0 && strings.TrimSpace(req.Content) != ""
	if !useLive {
		plan, err := agentruntime.PlanTurn(req)
		return plan, false, err
	}
	history, _ := s.ListMessages(ctx, sess.ID)
	// Cap history to keep prompt bounded
	if len(history) > 24 {
		history = history[len(history)-24:]
	}
	plan, err := s.LivePlanner(ctx, sess, req, history)
	if err != nil {
		return agentruntime.TurnPlan{}, true, err
	}
	return plan, true, nil
}

func (s *Store) finishTurn(ctx context.Context, sess Session, runID string, req agentruntime.TurnRequest, plan agentruntime.TurnPlan, liveUsed bool) (TurnResult, error) {
	pageInput, err := s.buildPage(ctx, sess, req, plan)
	if err != nil {
		_ = s.failRun(ctx, runID, err)
		return TurnResult{}, err
	}
	res, err := s.completeRun(ctx, sess, runID, req, plan, pageInput, liveUsed)
	if err != nil {
		_ = s.failRun(ctx, runID, err)
		return TurnResult{}, err
	}
	if liveUsed {
		agentruntime.MarkLiveSuccess()
	}
	return res, nil
}

// buildPage returns a page DTO only for explicit save_page. Ordinary chat returns nil (no draft mutation).
func (s *Store) buildPage(ctx context.Context, sess Session, req agentruntime.TurnRequest, plan agentruntime.TurnPlan) (map[string]any, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if plan.SavePage == nil {
		return nil, nil
	}
	_ = sess
	_ = req
	_ = s.Builder // retained for explicit test harnesses that inject a builder behind save_page
	return asObjectMap(plan.SavePage.Page)
}

func (s *Store) completeRun(ctx context.Context, sess Session, runID string, req agentruntime.TurnRequest, plan agentruntime.TurnPlan, pageInput map[string]any, liveUsed bool) (TurnResult, error) {
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
	// Page-layer idempotency keys are global (M2 PagePort). Session
	// exactly-once is the runs UNIQUE(session_id, request_id) + payload hash.
	var pageRec *pagestore.Record
	if pageInput != nil {
		rec, err := s.persistBoundPage(ctx, tx, sess, pageInput, req.RequestID)
		if err != nil {
			return TurnResult{}, err
		}
		pageRec = &rec
		rev := rec.Revision
		title := coalesceTitle(sess.Title, rec.Page.Title)
		if _, err := tx.ExecContext(ctx, `UPDATE sessions SET page_revision = ?, title = ?, updated_at = ? WHERE id = ?`,
			rev, title, now, sess.ID); err != nil {
			return TurnResult{}, err
		}
		sess.PageBound = true
		sess.PageRevision = &rev
		sess.Title = title
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
	} else if _, err := tx.ExecContext(ctx, `UPDATE sessions SET updated_at = ? WHERE id = ?`, now, sess.ID); err != nil {
		return TurnResult{}, err
	} else {
		sess.UpdatedAt = now
	}

	asstText := plan.AssistantText
	if asstText == "" {
		asstText = "Acknowledged."
	}
	asst := Message{
		ID: newID("msg"), SessionID: sess.ID, Role: "assistant",
		Content: asstText, RunID: runID, CreatedAt: now,
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

	result := map[string]any{
		"assistantText": asstText,
		"liveModel":     liveUsed,
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
	if err := tx.Commit(); err != nil {
		return TurnResult{}, err
	}

	run, err := s.GetRun(ctx, sess.ID, runID)
	if err != nil {
		return TurnResult{}, err
	}
	all, err := s.messagesForRun(ctx, sess.ID, runID)
	if err != nil {
		return TurnResult{}, err
	}
	out := TurnResult{
		Run:      run,
		Messages: all,
		Session:  sess,
	}
	if pageRec != nil {
		out.Page = pageRec
		out.PageBody = &pageBody{Page: pageRec.Page, Revision: pageRec.Revision}
	}
	return out, nil
}

func (s *Store) persistBoundPage(ctx context.Context, tx *sql.Tx, sess Session, pageMap map[string]any, idem string) (pagestore.Record, error) {
	if id, _ := pageMap["id"].(string); id != "" && id != sess.PageID {
		return pagestore.Record{}, ErrPageIDMismatch
	}
	pageMap["id"] = sess.PageID
	if slug, _ := pageMap["slug"].(string); strings.TrimSpace(slug) == "" {
		if sess.SlugIntent != "" {
			pageMap["slug"] = sess.SlugIntent
		} else {
			pageMap["slug"] = sess.ID
		}
	}

	if !sess.PageBound {
		rec, err := s.pages.CreateDraftTx(ctx, tx, pageMap, idem)
		if errors.Is(err, pagestore.ErrDuplicateID) || errors.Is(err, pagestore.ErrDuplicateSlug) {
			current, gerr := s.pages.GetByIDTx(ctx, tx, sess.PageID)
			if gerr != nil {
				return pagestore.Record{}, err
			}
			return s.pages.UpdateDraftTx(ctx, tx, sess.PageID, current.Revision, pageMap, idem)
		}
		return rec, err
	}
	expected := int64(0)
	if sess.PageRevision != nil {
		expected = *sess.PageRevision
	}
	rec, err := s.pages.UpdateDraftTx(ctx, tx, sess.PageID, expected, pageMap, idem)
	if errors.Is(err, pagestore.ErrRevisionConflict) {
		current, gerr := s.pages.GetByIDTx(ctx, tx, sess.PageID)
		if gerr != nil {
			return pagestore.Record{}, err
		}
		return s.pages.UpdateDraftTx(ctx, tx, sess.PageID, current.Revision, pageMap, idem)
	}
	return rec, err
}

func (s *Store) failRun(ctx context.Context, runID string, cause error) error {
	code, msg := classifyError(cause)
	_, err := s.pages.DB().ExecContext(context.WithoutCancel(ctx), `UPDATE runs SET status = 'failed', error_code = ?, error_message = ?, updated_at = ? WHERE id = ? AND status = 'pending'`,
		code, msg, nowUTC(), runID)
	return err
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
	if run.Status == "completed" && sess.PageBound {
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

func (s *Store) lookupRequest(ctx context.Context, sessionID, requestID string) (Run, bool, error) {
	row := s.pages.DB().QueryRowContext(ctx, `SELECT id, session_id, request_id, status, request_hash, result_json, error_code, error_message, created_at, updated_at FROM runs WHERE session_id = ? AND request_id = ?`, sessionID, requestID)
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
	err := row.Scan(&m.ID, &m.SessionID, &m.Seq, &m.Role, &m.Content, &m.RunID, &m.CreatedAt)
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

func asObjectMap(v any) (map[string]any, error) {
	if m, ok := v.(map[string]any); ok {
		return m, nil
	}
	raw, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil, err
	}
	return m, nil
}

func stubAssistantText(rec pagestore.Record) string {
	return fmt.Sprintf("Deterministic stub builder (%s) wrote page %s revision %d. Not a live model.", stubbuilder.Name, rec.Page.ID, rec.Revision)
}

func classifyError(err error) (code, msg string) {
	if err == nil {
		return "internal", "internal error"
	}
	var ce *pagecontract.Error
	if errors.As(err, &ce) {
		return ce.Code, clip(ce.Msg, 240)
	}
	switch {
	case errors.Is(err, ErrIdempotencyConflict):
		return "idempotency_conflict", err.Error()
	case errors.Is(err, ErrPageIDMismatch):
		return "invalid_id", err.Error()
	case errors.Is(err, ErrInvalidTool):
		return "invalid_tool", err.Error()
	case errors.Is(err, ErrMissingIdempotencyKey):
		return "missing_idempotency_key", err.Error()
	case errors.Is(err, pagestore.ErrDuplicateSlug):
		return "duplicate_slug", err.Error()
	case errors.Is(err, pagestore.ErrDuplicateID):
		return "duplicate_id", err.Error()
	case errors.Is(err, pagestore.ErrRevisionConflict):
		return "revision_conflict", err.Error()
	case errors.Is(err, pagestore.ErrIdempotencyConflict):
		return "idempotency_conflict", err.Error()
	case errors.Is(err, context.Canceled):
		return "canceled", "request canceled"
	case errors.Is(err, context.DeadlineExceeded):
		return "timeout", "request timed out"
	default:
		return "internal", clip(err.Error(), 240)
	}
}

func clip(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}
