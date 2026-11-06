CREATE TABLE sessions (
	id TEXT PRIMARY KEY NOT NULL,
	page_id TEXT NOT NULL UNIQUE,
	slug_intent TEXT,
	title TEXT NOT NULL DEFAULT '',
	page_revision INTEGER,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	CHECK (page_revision IS NULL OR page_revision >= 1)
);

CREATE TABLE messages (
	id TEXT PRIMARY KEY NOT NULL,
	session_id TEXT NOT NULL,
	seq INTEGER NOT NULL CHECK (seq >= 1),
	role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool', 'system')),
	content TEXT NOT NULL,
	run_id TEXT,
	created_at TEXT NOT NULL,
	UNIQUE (session_id, seq),
	FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE runs (
	id TEXT PRIMARY KEY NOT NULL,
	session_id TEXT NOT NULL,
	request_id TEXT,
	status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
	request_hash TEXT NOT NULL DEFAULT '',
	request_json TEXT NOT NULL,
	result_json TEXT,
	error_code TEXT,
	error_message TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE UNIQUE INDEX runs_request_id
	ON runs(request_id)
	WHERE request_id IS NOT NULL AND request_id != '';

CREATE INDEX messages_session_seq ON messages(session_id, seq);
CREATE INDEX runs_session ON runs(session_id, created_at);
