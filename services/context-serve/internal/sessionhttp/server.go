package sessionhttp

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"regexp"
	"strings"

	"github.com/buildytech/chat/services/context-serve/internal/agentruntime"
	"github.com/buildytech/chat/services/context-serve/internal/pagecontract"
	"github.com/buildytech/chat/services/context-serve/internal/pagehttp"
	"github.com/buildytech/chat/services/context-serve/internal/pagestore"
	"github.com/buildytech/chat/services/context-serve/internal/sessionstore"
)

const maxBody = 72 * 1024

var (
	idPattern          = regexp.MustCompile(`^[a-z][a-z0-9-]{0,62}$`)
	idempotencyPattern = regexp.MustCompile(`^[a-zA-Z0-9._:-]{1,128}$`)
	slugPattern        = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)
)

type Server struct {
	sessions *sessionstore.Store
	pages    *pagestore.Store
}

// NewMux mounts page routes and session/gateway foundation routes on one handler.
func NewMux(pages *pagestore.Store, sessions *sessionstore.Store) http.Handler {
	s := &Server{sessions: sessions, pages: pages}
	mux := http.NewServeMux()
	pagehttp.Register(mux, pages)
	mux.HandleFunc("GET /v1/capabilities", s.capabilities)
	mux.HandleFunc("POST /v1/sessions", s.createSession)
	mux.HandleFunc("GET /v1/sessions", s.listSessions)
	mux.HandleFunc("GET /v1/sessions/{id}", s.getSession)
	mux.HandleFunc("POST /v1/sessions/{id}/messages", s.postMessage)
	mux.HandleFunc("GET /v1/sessions/{id}/messages", s.listMessages)
	mux.HandleFunc("GET /v1/sessions/{id}/runs/{runId}", s.getRun)
	mux.HandleFunc("POST /v1/sessions/{id}/runs/{runId}/recover", s.recoverRun)
	return mux
}

func (s *Server) capabilities(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, agentruntime.Capabilities())
}

func (s *Server) createSession(w http.ResponseWriter, r *http.Request) {
	body, err := readObject(r, map[string]struct{}{"slugIntent": {}, "title": {}})
	if err != nil {
		writeContractErr(w, err)
		return
	}
	slugIntent, _ := body["slugIntent"].(string)
	title, _ := body["title"].(string)
	if slugIntent != "" && !slugPattern.MatchString(slugIntent) {
		writeError(w, http.StatusBadRequest, "invalid_slug", "slugIntent", "value does not match required pattern")
		return
	}
	sess, err := s.sessions.Create(r.Context(), slugIntent, title)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "$", "internal error")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"session": sess})
}

func (s *Server) listSessions(w http.ResponseWriter, r *http.Request) {
	list, err := s.sessions.List(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "$", "internal error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"sessions": list})
}

func (s *Server) getSession(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !idPattern.MatchString(id) {
		writeError(w, http.StatusBadRequest, "invalid_id", "id", "value does not match required pattern")
		return
	}
	sess, err := s.sessions.Get(r.Context(), id)
	if err != nil {
		writeSessionErr(w, err)
		return
	}
	resp := map[string]any{"session": sess}
	if sess.PageBound {
		if rec, err := s.pages.GetByID(r.Context(), sess.PageID); err == nil {
			resp["page"] = map[string]any{"page": rec.Page, "revision": rec.Revision}
		}
	}
	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) listMessages(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !idPattern.MatchString(id) {
		writeError(w, http.StatusBadRequest, "invalid_id", "id", "value does not match required pattern")
		return
	}
	msgs, err := s.sessions.ListMessages(r.Context(), id)
	if err != nil {
		writeSessionErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"messages": msgs})
}

func (s *Server) postMessage(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !idPattern.MatchString(id) {
		writeError(w, http.StatusBadRequest, "invalid_id", "id", "value does not match required pattern")
		return
	}
	body, err := readObject(r, map[string]struct{}{"content": {}, "requestId": {}, "tools": {}})
	if err != nil {
		writeContractErr(w, err)
		return
	}
	req, err := parseTurn(body)
	if err != nil {
		writeContractErr(w, err)
		return
	}
	res, err := s.sessions.PostMessage(r.Context(), id, req)
	if err != nil {
		writeSessionErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, turnResponse(res))
}

func (s *Server) getRun(w http.ResponseWriter, r *http.Request) {
	sid := r.PathValue("id")
	rid := r.PathValue("runId")
	if !idPattern.MatchString(sid) || !idPattern.MatchString(rid) {
		writeError(w, http.StatusBadRequest, "invalid_id", "id", "value does not match required pattern")
		return
	}
	run, err := s.sessions.GetRun(r.Context(), sid, rid)
	if err != nil {
		writeSessionErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"run": run})
}

func (s *Server) recoverRun(w http.ResponseWriter, r *http.Request) {
	sid := r.PathValue("id")
	rid := r.PathValue("runId")
	if !idPattern.MatchString(sid) || !idPattern.MatchString(rid) {
		writeError(w, http.StatusBadRequest, "invalid_id", "id", "value does not match required pattern")
		return
	}
	res, err := s.sessions.RecoverRun(r.Context(), sid, rid)
	if err != nil {
		writeSessionErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, turnResponse(res))
}

func turnResponse(res sessionstore.TurnResult) map[string]any {
	out := map[string]any{
		"run":      res.Run,
		"messages": res.Messages,
		"session":  res.Session,
		"page":     nil,
	}
	if res.PageBody != nil {
		out["page"] = res.PageBody
	}
	return out
}

func parseTurn(body map[string]any) (agentruntime.TurnRequest, error) {
	var req agentruntime.TurnRequest
	if v, ok := body["content"]; ok && v != nil {
		s, ok := v.(string)
		if !ok {
			return req, &pagecontract.Error{Code: "invalid_type", Path: "content", Msg: "expected string"}
		}
		req.Content = s
	}
	if v, ok := body["requestId"]; ok && v != nil {
		s, ok := v.(string)
		if !ok {
			return req, &pagecontract.Error{Code: "invalid_type", Path: "requestId", Msg: "expected string"}
		}
		s = strings.TrimSpace(s)
		if s != "" && !idempotencyPattern.MatchString(s) {
			return req, &pagecontract.Error{Code: "invalid_type", Path: "requestId", Msg: "value does not match required pattern"}
		}
		req.RequestID = s
	}
	if v, ok := body["tools"]; ok && v != nil {
		arr, ok := v.([]any)
		if !ok {
			return req, &pagecontract.Error{Code: "invalid_type", Path: "tools", Msg: "expected array"}
		}
		for i, item := range arr {
			obj, ok := item.(map[string]any)
			if !ok {
				return req, &pagecontract.Error{Code: "invalid_type", Path: "tools", Msg: "expected object entries"}
			}
			name, _ := obj["name"].(string)
			var args map[string]any
			if a, ok := obj["arguments"]; ok && a != nil {
				args, ok = a.(map[string]any)
				if !ok {
					return req, &pagecontract.Error{Code: "invalid_type", Path: "tools", Msg: "arguments must be object"}
				}
			}
			_ = i
			req.Tools = append(req.Tools, agentruntime.ToolCall{Name: name, Arguments: args})
		}
	}
	return req, nil
}

func readObject(r *http.Request, allowed map[string]struct{}) (map[string]any, error) {
	r.Body = http.MaxBytesReader(nopWriter{}, r.Body, maxBody)
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		if strings.Contains(err.Error(), "http: request body too large") {
			return nil, &pagecontract.Error{Code: "too_large", Path: "$", Msg: "payload exceeds size limit"}
		}
		return nil, &pagecontract.Error{Code: "invalid_type", Path: "$", Msg: "expected object"}
	}
	if len(raw) == 0 {
		return map[string]any{}, nil
	}
	var generic map[string]any
	dec := json.NewDecoder(strings.NewReader(string(raw)))
	dec.UseNumber()
	if err := dec.Decode(&generic); err != nil {
		return nil, &pagecontract.Error{Code: "invalid_type", Path: "$", Msg: "expected object"}
	}
	for k := range generic {
		if _, ok := allowed[k]; !ok {
			return nil, &pagecontract.Error{Code: "unexpected_key", Path: "$", Msg: `unexpected key "` + k + `"`}
		}
	}
	return generic, nil
}

func writeSessionErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, sessionstore.ErrNotFound):
		writeError(w, http.StatusNotFound, "not_found", "$", "session not found")
	case errors.Is(err, sessionstore.ErrRunNotFound):
		writeError(w, http.StatusNotFound, "not_found", "$", "run not found")
	case errors.Is(err, sessionstore.ErrIdempotencyConflict):
		writeError(w, http.StatusConflict, "idempotency_conflict", "requestId", "request id reused with different payload")
	case errors.Is(err, sessionstore.ErrPageIDMismatch):
		writeError(w, http.StatusBadRequest, "invalid_id", "page.id", "save_page id must match session page id")
	case errors.Is(err, sessionstore.ErrInvalidTool):
		writeError(w, http.StatusBadRequest, "invalid_tool", "tools", err.Error())
	case errors.Is(err, sessionstore.ErrRunNotPending):
		writeError(w, http.StatusConflict, "run_not_pending", "$", "run is not pending")
	case errors.Is(err, pagestore.ErrDuplicateSlug):
		writeError(w, http.StatusConflict, "duplicate_slug", "slug", "slug already exists")
	case errors.Is(err, pagestore.ErrDuplicateID):
		writeError(w, http.StatusConflict, "duplicate_id", "id", "page id already exists")
	case errors.Is(err, pagestore.ErrRevisionConflict):
		writeError(w, http.StatusConflict, "revision_conflict", "revision", "stale revision")
	case errors.Is(err, pagestore.ErrIdempotencyConflict):
		writeError(w, http.StatusConflict, "idempotency_conflict", "requestId", "request id reused with different payload")
	case errors.Is(err, pagestore.ErrNotFound):
		writeError(w, http.StatusNotFound, "not_found", "$", "page not found")
	default:
		writeContractErr(w, err)
	}
}

func writeContractErr(w http.ResponseWriter, err error) {
	var ce *pagecontract.Error
	if errors.As(err, &ce) {
		status := http.StatusBadRequest
		if ce.Code == "too_large" {
			status = http.StatusRequestEntityTooLarge
		}
		writeError(w, status, ce.Code, ce.Path, ce.Msg)
		return
	}
	writeError(w, http.StatusInternalServerError, "internal", "$", "internal error")
}

func writeError(w http.ResponseWriter, status int, code, path, message string) {
	writeJSON(w, status, map[string]any{
		"error": map[string]string{"code": code, "path": path, "message": message},
	})
}

type nopWriter struct{}

func (nopWriter) Header() http.Header         { return make(http.Header) }
func (nopWriter) Write(b []byte) (int, error) { return len(b), nil }
func (nopWriter) WriteHeader(int)             {}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(v)
}
