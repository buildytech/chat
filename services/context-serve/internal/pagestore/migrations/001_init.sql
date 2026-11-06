CREATE TABLE pages (
	id TEXT PRIMARY KEY NOT NULL,
	slug TEXT NOT NULL UNIQUE,
	revision INTEGER NOT NULL CHECK (revision >= 1),
	dto_json TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE revisions (
	page_id TEXT NOT NULL,
	revision INTEGER NOT NULL CHECK (revision >= 1),
	dto_json TEXT NOT NULL,
	created_at TEXT NOT NULL,
	idempotency_key TEXT,
	PRIMARY KEY (page_id, revision),
	FOREIGN KEY (page_id) REFERENCES pages(id)
);

CREATE UNIQUE INDEX revisions_idempotency
	ON revisions(idempotency_key)
	WHERE idempotency_key IS NOT NULL;
