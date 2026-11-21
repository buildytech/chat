/** The desktop host's local pictures (ADR 0065). Web hosts never advertise files; no arbitrary relative URL is fetched. */
let enabled = false;

/** What the last status read proved. A failed status read clears it too (never trust a value kept in storage). */
export function noteRuntimeFiles(files: boolean): void {
	enabled = files;
}

/** One content-addressed picture in this host's store, only when the host advertises files:true. No query or fragment. */
export function isRuntimePicture(value: unknown): value is string {
	return enabled && typeof value === "string" && /^\/runtime\/v1\/files\/[a-f0-9]{64}\.(?:jpg|png|webp|gif|avif)$/.test(value);
}
