package pagehttp

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"regexp"
	"strings"

	"github.com/buildytech/chat/services/context-serve/internal/pagecontract"
	"github.com/buildytech/chat/services/context-serve/internal/pagestore"
)

const maxBody = 72 * 1024

var (
	idPattern          = regexp.MustCompile(`^[a-z][a-z0-9-]{0,62}$`)
	slugPattern        = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)
	idempotencyPattern = regexp.MustCompile(`^[a-zA-Z0-9._:-]{1,128}$`)
	envelopeCreateKeys = map[string]struct{}{"page": {}, "idempotencyKey": {}}
	envelopeUpdateKeys = map[string]struct{}{"page": {}, "revision": {}, "idempotencyKey": {}}
)

type Server struct {
	store *pagestore.Store
}

func NewMux(store *pagestore.Store) http.Handler {
	s := &Server{store: store}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.healthz)
	mux.HandleFunc("POST /v1/pages", s.create)
	mux.HandleFunc("GET /v1/pages/{id}", s.getByID)
	mux.HandleFunc("PUT /v1/pages/{id}", s.update)
	mux.HandleFunc("GET /v1/slugs/{slug}", s.getBySlug)
	return mux
}

type envelope struct {
	Page           any    `json:"page"`
	Revision       *int64 `json:"revision"`
	IdempotencyKey string `json:"idempotencyKey"`
}

type recordBody struct {
	Page     pagecontract.Page `json:"page"`
	Revision int64             `json:"revision"`
}

func (s *Server) healthz(w http.ResponseWriter, r *http.Request) {
	if err := s.store.Ping(r.Context()); err != nil {
		writeError(w, http.StatusServiceUnavailable, "store_unavailable", "$", "page store is not ready")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "pageStore": true, "cr": false})
}

func (s *Server) create(w http.ResponseWriter, r *http.Request) {
	env, err := decodeEnvelope(r, envelopeCreateKeys)
	if err != nil {
		writeContractErr(w, err)
		return
	}
	key, err := idempotency(r, env.IdempotencyKey)
	if err != nil {
		writeContractErr(w, err)
		return
	}
	rec, err := s.store.CreateDraft(r.Context(), env.Page, key)
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, recordBody{Page: rec.Page, Revision: rec.Revision})
}

func (s *Server) update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !idPattern.MatchString(id) {
		writeError(w, http.StatusBadRequest, "invalid_id", "id", "value does not match required pattern")
		return
	}
	env, err := decodeEnvelope(r, envelopeUpdateKeys)
	if err != nil {
		writeContractErr(w, err)
		return
	}
	rev, err := revisionOf(r, env)
	if err != nil {
		writeContractErr(w, err)
		return
	}
	key, err := idempotency(r, env.IdempotencyKey)
	if err != nil {
		writeContractErr(w, err)
		return
	}
	rec, err := s.store.UpdateDraft(r.Context(), id, rev, env.Page, key)
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, recordBody{Page: rec.Page, Revision: rec.Revision})
}

func (s *Server) getByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !idPattern.MatchString(id) {
		writeError(w, http.StatusBadRequest, "invalid_id", "id", "value does not match required pattern")
		return
	}
	rec, err := s.store.GetByID(r.Context(), id)
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, recordBody{Page: rec.Page, Revision: rec.Revision})
}

func (s *Server) getBySlug(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	if !slugPattern.MatchString(slug) {
		writeError(w, http.StatusBadRequest, "invalid_slug", "slug", "value does not match required pattern")
		return
	}
	rec, err := s.store.GetBySlug(r.Context(), slug)
	if err != nil {
		writeStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, recordBody{Page: rec.Page, Revision: rec.Revision})
}

func decodeEnvelope(r *http.Request, allowed map[string]struct{}) (envelope, error) {
	r.Body = http.MaxBytesReader(nopWriter{}, r.Body, maxBody)
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		if strings.Contains(err.Error(), "http: request body too large") {
			return envelope{}, &pagecontract.Error{Code: "too_large", Path: "$", Msg: "payload exceeds size limit"}
		}
		return envelope{}, &pagecontract.Error{Code: "invalid_type", Path: "$", Msg: "expected object"}
	}
	if int64(len(raw)) >= maxBody {
		return envelope{}, &pagecontract.Error{Code: "too_large", Path: "$", Msg: "payload exceeds size limit"}
	}
	var generic map[string]any
	dec := json.NewDecoder(strings.NewReader(string(raw)))
	dec.UseNumber()
	if err := dec.Decode(&generic); err != nil {
		return envelope{}, &pagecontract.Error{Code: "invalid_type", Path: "$", Msg: "expected object"}
	}
	for k := range generic {
		if _, ok := allowed[k]; !ok {
			return envelope{}, &pagecontract.Error{Code: "unexpected_key", Path: "$", Msg: `unexpected key "` + k + `"`}
		}
	}
	page, ok := generic["page"]
	if !ok {
		return envelope{}, &pagecontract.Error{Code: "missing_field", Path: "$", Msg: `missing "page"`}
	}
	env := envelope{Page: page}
	if v, ok := generic["idempotencyKey"]; ok {
		s, ok := v.(string)
		if !ok {
			return envelope{}, &pagecontract.Error{Code: "invalid_type", Path: "idempotencyKey", Msg: "expected string"}
		}
		env.IdempotencyKey = s
	}
	if v, ok := generic["revision"]; ok {
		n, err := jsonNumberInt(v)
		if err != nil {
			return envelope{}, &pagecontract.Error{Code: "invalid_type", Path: "revision", Msg: "expected integer"}
		}
		env.Revision = &n
	}
	return env, nil
}

func jsonNumberInt(v any) (int64, error) {
	switch n := v.(type) {
	case json.Number:
		return n.Int64()
	case float64:
		return int64(n), nil
	default:
		return 0, errors.New("not int")
	}
}

func revisionOf(r *http.Request, env envelope) (int64, error) {
	header := strings.Trim(r.Header.Get("If-Match"), `"`)
	if header != "" {
		var n int64
		if _, err := parseInt64(header, &n); err != nil {
			return 0, &pagecontract.Error{Code: "invalid_type", Path: "revision", Msg: "expected integer"}
		}
		if env.Revision != nil && *env.Revision != n {
			return 0, &pagecontract.Error{Code: "invalid_type", Path: "revision", Msg: "If-Match does not match body revision"}
		}
		return n, nil
	}
	if env.Revision == nil {
		return 0, &pagecontract.Error{Code: "missing_field", Path: "revision", Msg: `missing "revision"`}
	}
	return *env.Revision, nil
}

func parseInt64(s string, out *int64) (int, error) {
	n := int64(0)
	if s == "" {
		return 0, errors.New("empty")
	}
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0, errors.New("not int")
		}
		n = n*10 + int64(c-'0')
	}
	*out = n
	return 0, nil
}

func idempotency(r *http.Request, body string) (string, error) {
	header := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
	body = strings.TrimSpace(body)
	if header != "" && body != "" && header != body {
		return "", &pagecontract.Error{Code: "invalid_type", Path: "idempotencyKey", Msg: "header and body keys differ"}
	}
	key := header
	if key == "" {
		key = body
	}
	if key == "" {
		return "", nil
	}
	if !idempotencyPattern.MatchString(key) {
		return "", &pagecontract.Error{Code: "invalid_type", Path: "idempotencyKey", Msg: "value does not match required pattern"}
	}
	return key, nil
}

func writeStoreErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, pagestore.ErrNotFound):
		writeError(w, http.StatusNotFound, "not_found", "$", "page not found")
	case errors.Is(err, pagestore.ErrDuplicateSlug):
		writeError(w, http.StatusConflict, "duplicate_slug", "slug", "slug already exists")
	case errors.Is(err, pagestore.ErrDuplicateID):
		writeError(w, http.StatusConflict, "duplicate_id", "id", "page id already exists")
	case errors.Is(err, pagestore.ErrRevisionConflict):
		writeError(w, http.StatusConflict, "revision_conflict", "revision", "stale revision")
	case errors.Is(err, pagestore.ErrIDMismatch):
		writeError(w, http.StatusBadRequest, "invalid_id", "id", "page id does not match path")
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
