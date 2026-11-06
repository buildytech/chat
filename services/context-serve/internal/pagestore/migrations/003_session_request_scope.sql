-- Request-scoped session idempotency: same Idempotency-Key may be reused
-- in a different session. Uniqueness is (session_id, request_id).
DROP INDEX IF EXISTS runs_request_id;
CREATE UNIQUE INDEX runs_session_request_id
	ON runs(session_id, request_id)
	WHERE request_id IS NOT NULL AND request_id != '';
