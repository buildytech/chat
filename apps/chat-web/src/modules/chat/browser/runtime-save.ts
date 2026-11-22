/**
 * The desktop host's native save of the ZIP export (ADR 0065, capabilities.saveFile, contract cases/export.json): the
 * archive goes to `POST /runtime/v1/export?name=<file>` and the host asks where to keep it (a save dialog; the headless
 * build writes to its configured folder). A web host never advertises it; the browser download stays the default.
 */
/** Largest archive the host accepts (bytes); a larger one is downloaded by the browser. */
export const EXPORT_MAX_BYTES = 64_000_000;
/** A file name the host accepts: one plain segment ending in .zip. */
export const EXPORT_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.zip$/;

let enabled = false;

export function noteRuntimeSave(saveFile: boolean): void {
	enabled = saveFile;
}

/** The name the host gets: the suggested one when it is plain, else page-pack.zip. */
export function exportName(name: string): string {
	return EXPORT_NAME.test(name) ? name : "page-pack.zip";
}

async function saveViaRuntime(bytes: Uint8Array, name: string): Promise<"saved" | "cancelled"> {
	const body = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(body).set(bytes);
	const res = await fetch(`/runtime/v1/export?name=${encodeURIComponent(exportName(name))}`, { method: "POST", headers: { "content-type": "application/zip" }, body, credentials: "same-origin" });
	const answer: unknown = await res.json().catch(() => null);
	const field = (key: string): unknown => (answer && typeof answer === "object" ? Reflect.get(answer, key) : undefined);
	if (res.ok && field("ok") === true && field("saved") === true) return "saved";
	if (res.ok && field("ok") === true && field("code") === "cancelled") return "cancelled";
	throw new Error(`the host did not save the archive (${String(field("code") ?? res.status)})`);
}

/** The ZIP export's saver: only while the host advertises saveFile, and only for an archive it accepts. */
export const runtimeZipSaver = {
	available: (size: number) => enabled && size > 0 && size <= EXPORT_MAX_BYTES,
	save: saveViaRuntime
};
