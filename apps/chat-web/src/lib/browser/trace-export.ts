/**
 * Export projection only. Never alters the browser's stored traces. Bodies (prompts, tool arguments, results) are
 * dropped from run traces unless asked for, except the arguments of the write_page calls a reader needs to debug a run
 * (t85u): a rejected write, and the accepted write of a proposal that was superseded or discarded (its page is kept
 * nowhere else). They stay as the model sent them (one JSON text); `argsKept` says why.
 */
function record(value: object): value is Record<string, unknown> { return !Array.isArray(value); }
function plain(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value); }

/** The write_page argument nodes to keep in a session file (`sessions[].ext["agent-trace"]`). */
function keptWrites(file: unknown): Set<object> {
	const kept = new Set<object>();
	const sessions = plain(file) && Array.isArray(file.sessions) ? file.sessions : [];
	for (const session of sessions) {
		if (!plain(session) || !plain(session.ext)) continue;
		const chat = session.ext.chat;
		const messages = plain(chat) && Array.isArray(chat.messages) ? chat.messages : [];
		const gone = new Set(messages.flatMap((m) => (plain(m) && plain(m.run) && typeof m.run.runId === "string" && plain(m.proposal) && (m.proposal.status === "superseded" || m.proposal.status === "discarded") ? [m.run.runId] : [])));
		const traces = session.ext["agent-trace"];
		if (!plain(traces)) continue;
		for (const [runId, trace] of Object.entries(traces)) {
			if (!plain(trace) || !Array.isArray(trace.toolResults)) continue;
			for (const result of trace.toolResults) {
				if (!plain(result) || result.name !== "write_page" || !plain(result.args) || !("body" in result.args)) continue;
				const why = result.accepted === false ? "rejected" : gone.has(runId) ? "superseded" : null;
				if (!why) continue;
				result.argsKept = why;
				kept.add(result.args);
			}
		}
	}
	return kept;
}

export function projectTraceBodies<T>(file: T, includeBodies = false): T {
	const copy = structuredClone(file);
	const kept = includeBodies ? new Set<object>() : keptWrites(copy);
	function visit(value: unknown, trace = false): void {
		if (!value || typeof value !== "object") return;
		if (Array.isArray(value)) { for (const item of value) visit(item, trace); return; }
		if (!record(value)) return;
		const node = value;
		const inside = trace || node.format === "run-trace/1";
		if (inside && !includeBodies && !kept.has(node) && typeof node.hash === "string" && typeof node.bytes === "number") delete node.body;
		for (const child of Object.values(node)) visit(child, inside);
	}
	visit(copy);
	return copy;
}
