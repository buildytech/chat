/** Export projection only. Never alters the browser's stored traces. */
function record(value: object): value is Record<string, unknown> { return !Array.isArray(value); }
export function projectTraceBodies<T>(file: T, includeBodies = false): T {
	const copy = structuredClone(file);
	function visit(value: unknown, trace = false): void {
		if (!value || typeof value !== "object") return;
		if (Array.isArray(value)) { for (const item of value) visit(item, trace); return; }
		if (!record(value)) return;
		const node = value;
		const inside = trace || node.format === "run-trace/1";
		if (inside && !includeBodies && typeof node.hash === "string" && typeof node.bytes === "number") delete node.body;
		for (const child of Object.values(node)) visit(child, inside);
	}
	visit(copy);
	return copy;
}
