-- Per-WP-site namespace. Empty site_id means legacy global rows (preserved demo).
-- Slug stays globally unique. WP adapter prefixes slugs with site id for niches.
-- Row filters use site_id on every read so chats never mix across sites.

ALTER TABLE pages ADD COLUMN site_id TEXT NOT NULL DEFAULT '';
ALTER TABLE sessions ADD COLUMN site_id TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS pages_site ON pages(site_id);
CREATE INDEX IF NOT EXISTS sessions_site ON sessions(site_id);
