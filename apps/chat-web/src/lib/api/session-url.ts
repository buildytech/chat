/**
 * Session deep-link helpers. Explicit ?session= wins over persisted selection.
 * Preserves other query flags (e.g. ?live=1). Browser-only writes are no-ops on SSR.
 */

export type SessionSelection =
	| { kind: "ok"; id: string; source: "url" | "persisted" | "first" }
	| { kind: "missing"; requested: string }
	| { kind: "none" };

export function readSessionQuery(search: string = ""): string | null {
	try {
		const raw = search || (typeof window !== "undefined" ? window.location.search : "");
		const v = new URLSearchParams(raw.startsWith("?") || raw === "" ? raw : `?${raw}`)
			.get("session")
			?.trim();
		return v ? v : null;
	} catch {
		return null;
	}
}

/**
 * Priority: explicit URL session > persisted id > first listed id.
 * An explicit URL that is absent from the known set is "missing" — never silently
 * fall back to another session.
 */
export function resolveSessionSelection(input: {
	urlSession: string | null;
	persistedId: string | null;
	sessionIds: readonly string[];
}): SessionSelection {
	const ids = new Set(input.sessionIds);
	if (input.urlSession) {
		if (ids.has(input.urlSession)) {
			return { kind: "ok", id: input.urlSession, source: "url" };
		}
		return { kind: "missing", requested: input.urlSession };
	}
	if (input.persistedId && ids.has(input.persistedId)) {
		return { kind: "ok", id: input.persistedId, source: "persisted" };
	}
	const first = input.sessionIds[0];
	if (first) return { kind: "ok", id: first, source: "first" };
	return { kind: "none" };
}

export type SyncSessionQueryOpts = {
	/** replaceState (hydrate) vs pushState (user navigation for back/forward) */
	mode?: "replace" | "push";
	/** Absolute or relative href to mutate; defaults to window.location.href */
	href?: string;
};

/** Returns the next path+search+hash; applies history write when window is available. */
export function syncSessionQuery(
	sessionId: string | null,
	opts: SyncSessionQueryOpts = {}
): string {
	const mode = opts.mode ?? "replace";
	const base =
		opts.href ??
		(typeof window !== "undefined" ? window.location.href : "http://local/");
	const url = new URL(base, "http://local/");
	if (sessionId) url.searchParams.set("session", sessionId);
	else url.searchParams.delete("session");
	const next = `${url.pathname}${url.search}${url.hash}`;
	if (typeof window !== "undefined" && typeof history !== "undefined") {
		if (mode === "push") history.pushState(history.state, "", next);
		else history.replaceState(history.state, "", next);
	}
	return next;
}
