package pagestore

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/buildytech/chat/services/context-serve/internal/pagecontract"
	_ "github.com/mattn/go-sqlite3"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

const currentMigration = 3

var (
	ErrNotFound            = errors.New("page not found")
	ErrDuplicateSlug       = errors.New("duplicate slug")
	ErrDuplicateID         = errors.New("duplicate page id")
	ErrRevisionConflict    = errors.New("revision conflict")
	ErrIDMismatch          = errors.New("page id does not match")
	ErrIdempotencyConflict = errors.New("idempotency key reused with different payload")
)

type Record struct {
	Page     pagecontract.Page
	Revision int64
}

type Store struct {
	db *sql.DB
	// AfterPageInsert runs inside the create transaction after the pages row.
	// Production leaves it nil. Tests use it to force a rollback.
	AfterPageInsert func(ctx context.Context, tx *sql.Tx) error
}

func Open(path string) (*Store, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil && filepath.Dir(path) != "." && filepath.Dir(path) != "" {
		return nil, err
	}
	dsn := fmt.Sprintf("file:%s?_foreign_keys=on&_busy_timeout=5000&_journal_mode=WAL&_txlock=immediate", filepath.ToSlash(path))
	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(4)
	if _, err := db.Exec(`PRAGMA foreign_keys = ON;`); err != nil {
		_ = db.Close()
		return nil, err
	}
	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		_ = db.Close()
		return nil, err
	}
	return s, nil
}

func (s *Store) Close() error {
	if s == nil || s.db == nil {
		return nil
	}
	return s.db.Close()
}

// DB exposes the underlying handle for sessionstore co-location on the same SQLite file.
func (s *Store) DB() *sql.DB {
	return s.db
}

func (s *Store) BeginTx(ctx context.Context, opts *sql.TxOptions) (*sql.Tx, error) {
	return s.db.BeginTx(ctx, opts)
}

func (s *Store) Ping(ctx context.Context) error {
	return s.db.PingContext(ctx)
}

func (s *Store) migrate() error {
	if _, err := s.db.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
		version INTEGER PRIMARY KEY NOT NULL,
		applied_at TEXT NOT NULL
	);`); err != nil {
		return err
	}
	var version int
	err := s.db.QueryRow(`SELECT COALESCE(MAX(version), 0) FROM schema_migrations`).Scan(&version)
	if err != nil {
		return err
	}
	if version > currentMigration {
		return fmt.Errorf("sqlite schema version %d is newer than supported %d", version, currentMigration)
	}
	for next := version + 1; next <= currentMigration; next++ {
		file := fmt.Sprintf("migrations/%03d_%s.sql", next, migrationName(next))
		body, err := migrationFS.ReadFile(file)
		if err != nil {
			return fmt.Errorf("migration %d: %w", next, err)
		}
		tx, err := s.db.Begin()
		if err != nil {
			return err
		}
		if err := execScript(tx, string(body)); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("migration %d apply: %w", next, err)
		}
		if _, err := tx.Exec(`INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)`, next, time.Now().UTC().Format(time.RFC3339Nano)); err != nil {
			_ = tx.Rollback()
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
	}
	return nil
}

func migrationName(version int) string {
	switch version {
	case 1:
		return "init"
	case 2:
		return "sessions"
	case 3:
		return "session_request_scope"
	default:
		return "unknown"
	}
}

func (s *Store) GetByID(ctx context.Context, id string) (Record, error) {
	return s.get(ctx, nil, `SELECT dto_json, revision FROM pages WHERE id = ?`, id)
}

func (s *Store) GetByIDTx(ctx context.Context, tx *sql.Tx, id string) (Record, error) {
	if tx == nil {
		return Record{}, errors.New("tx required")
	}
	return s.get(ctx, tx, `SELECT dto_json, revision FROM pages WHERE id = ?`, id)
}

func (s *Store) GetBySlug(ctx context.Context, slug string) (Record, error) {
	return s.get(ctx, nil, `SELECT dto_json, revision FROM pages WHERE slug = ?`, slug)
}

func (s *Store) get(ctx context.Context, tx *sql.Tx, q, arg string) (Record, error) {
	var raw string
	var rev int64
	var err error
	if tx != nil {
		err = tx.QueryRowContext(ctx, q, arg).Scan(&raw, &rev)
	} else {
		err = s.db.QueryRowContext(ctx, q, arg).Scan(&raw, &rev)
	}
	if errors.Is(err, sql.ErrNoRows) {
		return Record{}, ErrNotFound
	}
	if err != nil {
		return Record{}, err
	}
	page, err := pagecontract.ParseJSON([]byte(raw), false)
	if err != nil {
		return Record{}, err
	}
	return Record{Page: page, Revision: rev}, nil
}

func (s *Store) CreateDraft(ctx context.Context, input any, idempotencyKey string) (Record, error) {
	tx, err := s.db.BeginTx(ctx, &sql.TxOptions{})
	if err != nil {
		return Record{}, err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.ExecContext(ctx, `PRAGMA foreign_keys = ON;`); err != nil {
		return Record{}, err
	}
	rec, err := s.CreateDraftTx(ctx, tx, input, idempotencyKey)
	if err != nil {
		return Record{}, err
	}
	if err := tx.Commit(); err != nil {
		return Record{}, err
	}
	return rec, nil
}

// CreateDraftTx writes a draft inside an open transaction (session persist boundary).
func (s *Store) CreateDraftTx(ctx context.Context, tx *sql.Tx, input any, idempotencyKey string) (Record, error) {
	page, err := pagecontract.ParseDraftPage(input)
	if err != nil {
		return Record{}, err
	}
	raw, err := pagecontract.MarshalPage(page)
	if err != nil {
		return Record{}, err
	}
	key := normalizeIdempotency(idempotencyKey)

	if key != "" {
		if rec, ok, err := s.lookupIdempotency(ctx, tx, key); err != nil {
			return Record{}, err
		} else if ok {
			existing, _ := pagecontract.MarshalPage(rec.Page)
			if string(existing) != string(raw) {
				return Record{}, ErrIdempotencyConflict
			}
			return rec, nil
		}
	}

	if _, err := tx.ExecContext(ctx, `INSERT INTO pages (id, slug, revision, dto_json, updated_at) VALUES (?, ?, 1, ?, ?)`,
		page.ID, page.Slug, string(raw), page.UpdatedAt); err != nil {
		return Record{}, mapConstraint(err)
	}
	if s.AfterPageInsert != nil {
		if err := s.AfterPageInsert(ctx, tx); err != nil {
			return Record{}, err
		}
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO revisions (page_id, revision, dto_json, created_at, idempotency_key) VALUES (?, 1, ?, ?, ?)`,
		page.ID, string(raw), page.UpdatedAt, nullIfEmpty(key)); err != nil {
		if key != "" && isUnique(err) && strings.Contains(err.Error(), "idempotency") {
			if rec, ok, lookErr := s.lookupIdempotency(ctx, tx, key); lookErr != nil {
				return Record{}, lookErr
			} else if ok {
				existing, _ := pagecontract.MarshalPage(rec.Page)
				if string(existing) != string(raw) {
					return Record{}, ErrIdempotencyConflict
				}
				return rec, nil
			}
		}
		return Record{}, mapConstraint(err)
	}
	return Record{Page: page, Revision: 1}, nil
}

func (s *Store) UpdateDraft(ctx context.Context, id string, expectedRev int64, input any, idempotencyKey string) (Record, error) {
	tx, err := s.db.BeginTx(ctx, &sql.TxOptions{})
	if err != nil {
		return Record{}, err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.ExecContext(ctx, `PRAGMA foreign_keys = ON;`); err != nil {
		return Record{}, err
	}
	rec, err := s.UpdateDraftTx(ctx, tx, id, expectedRev, input, idempotencyKey)
	if err != nil {
		return Record{}, err
	}
	if err := tx.Commit(); err != nil {
		return Record{}, err
	}
	return rec, nil
}

// UpdateDraftTx updates a draft inside an open transaction.
func (s *Store) UpdateDraftTx(ctx context.Context, tx *sql.Tx, id string, expectedRev int64, input any, idempotencyKey string) (Record, error) {
	if expectedRev < 1 {
		return Record{}, ErrRevisionConflict
	}
	page, err := pagecontract.ParseDraftPage(input)
	if err != nil {
		return Record{}, err
	}
	if page.ID != id {
		return Record{}, ErrIDMismatch
	}
	raw, err := pagecontract.MarshalPage(page)
	if err != nil {
		return Record{}, err
	}
	key := normalizeIdempotency(idempotencyKey)
	next := expectedRev + 1

	if key != "" {
		if rec, ok, err := s.lookupIdempotency(ctx, tx, key); err != nil {
			return Record{}, err
		} else if ok {
			existing, _ := pagecontract.MarshalPage(rec.Page)
			if string(existing) != string(raw) {
				return Record{}, ErrIdempotencyConflict
			}
			return rec, nil
		}
	}

	res, err := tx.ExecContext(ctx, `UPDATE pages SET slug = ?, revision = ?, dto_json = ?, updated_at = ? WHERE id = ? AND revision = ?`,
		page.Slug, next, string(raw), page.UpdatedAt, id, expectedRev)
	if err != nil {
		return Record{}, mapConstraint(err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return Record{}, err
	}
	if n == 0 {
		var exists int
		qerr := tx.QueryRowContext(ctx, `SELECT COUNT(1) FROM pages WHERE id = ?`, id).Scan(&exists)
		if qerr != nil {
			return Record{}, qerr
		}
		if exists == 0 {
			return Record{}, ErrNotFound
		}
		return Record{}, ErrRevisionConflict
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO revisions (page_id, revision, dto_json, created_at, idempotency_key) VALUES (?, ?, ?, ?, ?)`,
		id, next, string(raw), page.UpdatedAt, nullIfEmpty(key)); err != nil {
		if key != "" && isUnique(err) && strings.Contains(err.Error(), "idempotency") {
			if rec, ok, lookErr := s.lookupIdempotency(ctx, tx, key); lookErr != nil {
				return Record{}, lookErr
			} else if ok {
				existing, _ := pagecontract.MarshalPage(rec.Page)
				if string(existing) != string(raw) {
					return Record{}, ErrIdempotencyConflict
				}
				return rec, nil
			}
		}
		return Record{}, mapConstraint(err)
	}
	return Record{Page: page, Revision: next}, nil
}

func (s *Store) lookupIdempotency(ctx context.Context, tx *sql.Tx, key string) (Record, bool, error) {
	var pageID string
	var rev int64
	var raw string
	err := tx.QueryRowContext(ctx, `SELECT page_id, revision, dto_json FROM revisions WHERE idempotency_key = ?`, key).Scan(&pageID, &rev, &raw)
	if errors.Is(err, sql.ErrNoRows) {
		return Record{}, false, nil
	}
	if err != nil {
		return Record{}, false, err
	}
	page, err := pagecontract.ParseJSON([]byte(raw), false)
	if err != nil {
		return Record{}, false, err
	}
	return Record{Page: page, Revision: rev}, true, nil
}

func (s *Store) Counts(ctx context.Context) (pages, revisions int, err error) {
	err = s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM pages`).Scan(&pages)
	if err != nil {
		return 0, 0, err
	}
	err = s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM revisions`).Scan(&revisions)
	return pages, revisions, err
}

func execScript(tx *sql.Tx, script string) error {
	for _, stmt := range strings.Split(script, ";") {
		stmt = strings.TrimSpace(stmt)
		if stmt == "" {
			continue
		}
		if _, err := tx.Exec(stmt); err != nil {
			return err
		}
	}
	return nil
}

func mapConstraint(err error) error {
	if err == nil {
		return nil
	}
	msg := err.Error()
	if strings.Contains(msg, "UNIQUE constraint failed: pages.slug") {
		return ErrDuplicateSlug
	}
	if strings.Contains(msg, "UNIQUE constraint failed: pages.id") {
		return ErrDuplicateID
	}
	if strings.Contains(msg, "UNIQUE constraint failed") && strings.Contains(msg, "slug") {
		return ErrDuplicateSlug
	}
	if strings.Contains(msg, "UNIQUE constraint failed") && strings.Contains(msg, "pages.id") {
		return ErrDuplicateID
	}
	return err
}

func isUnique(err error) bool {
	return err != nil && strings.Contains(err.Error(), "UNIQUE constraint failed")
}

func normalizeIdempotency(key string) string {
	return strings.TrimSpace(key)
}

func nullIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}
