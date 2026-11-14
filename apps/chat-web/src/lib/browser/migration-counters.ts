/**
 * Hit counters of the old-data paths (refactor plan item 4: remove a migration only when no browser reaches it any more).
 * Browser data is local, so the server cannot see it: each path that rewrites old data counts a hit in the migration
 * marker `buildy:v1:migration` (`counters`, `countersSince`, `lastAt`), and `window.buildy.migrationReport()` prints them.
 * Pure over a Storage-like object; never throws (a counter is informational and must not block a load).
 */
/** The marker key (MIGRATION_KEY of storage-v1.ts re-uses it). */
export const MIGRATION_KEY = "buildy:v1:migration";
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * pageV1: a page-spec/v1 page record read and migrated to v2. feedScreen: a proposal with the retired `feed-screen`
 * origin repaired. legacyKeys: a pre-buildy:v1 localStorage key moved. proposalApplied: a proposal with only
 * `applied` (no `status`).
 */
export const MIGRATION_PATHS = ["pageV1", "feedScreen", "legacyKeys", "proposalApplied"] as const;
export type MigrationPath = (typeof MIGRATION_PATHS)[number];
export type MigrationCounters = Record<MigrationPath, number>;
export type MigrationHits = { since: string | null; lastAt: string | null; counters: MigrationCounters; total: number };

const zero = (): MigrationCounters => Object.fromEntries(MIGRATION_PATHS.map((path) => [path, 0])) as MigrationCounters;

export function readMarker(store: StorageLike): Record<string, unknown> {
	try {
		const raw = store.getItem(MIGRATION_KEY);
		const parsed: unknown = raw == null ? null : JSON.parse(raw);
		return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
	} catch {
		return {};
	}
}

/** What the marker says now (zero for a path that never hit). */
export function migrationReport(store: StorageLike): MigrationHits {
	const marker = readMarker(store);
	const stored = marker.counters && typeof marker.counters === "object" ? (marker.counters as Record<string, unknown>) : {};
	const counters = zero();
	for (const path of MIGRATION_PATHS) if (typeof stored[path] === "number" && stored[path] > 0) counters[path] = stored[path] as number;
	return {
		since: typeof marker.countersSince === "string" ? marker.countersSince : null,
		lastAt: typeof marker.lastAt === "string" ? marker.lastAt : null,
		counters,
		total: MIGRATION_PATHS.reduce((sum, path) => sum + counters[path], 0)
	};
}

/** Start counting (first load of this build): records `countersSince` once; the marker's other fields are kept. */
export function startMigrationCounters(store: StorageLike, now: () => string = () => new Date().toISOString()): void {
	try {
		const marker = readMarker(store);
		if (typeof marker.countersSince === "string") return;
		store.setItem(MIGRATION_KEY, JSON.stringify({ ...marker, countersSince: now(), counters: marker.counters ?? zero() }));
	} catch {
		/* informational only */
	}
}

/** Count `n` hits on one path (nothing is written for n <= 0). */
export function noteMigrationHit(store: StorageLike, path: MigrationPath, n = 1, now: () => string = () => new Date().toISOString()): void {
	if (!(n > 0)) return;
	try {
		const marker = readMarker(store);
		const hits = migrationReport(store);
		const at = now();
		store.setItem(
			MIGRATION_KEY,
			JSON.stringify({ ...marker, countersSince: hits.since ?? at, counters: { ...hits.counters, [path]: hits.counters[path] + n }, lastAt: at })
		);
	} catch {
		/* informational only */
	}
}
