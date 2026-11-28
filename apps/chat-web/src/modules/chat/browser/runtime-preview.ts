/**
 * The desktop host opens the standalone preview window (ADR 0073, `POST /runtime/v1/preview-window`): a webview cannot
 * window.open it. Registered with the core's openPreviewWindow while the status says the host is a desktop host; the
 * headless build answers 501 and the browser opens the address.
 */
import { setPreviewHostOpener } from "../../../lib/browser/preview-window.ts";

const ENDPOINT = "/runtime/v1/preview-window";

type Send = typeof fetch;

/** True when the host opened the window. Anything else (501, an error, no network) leaves it to the browser. */
export async function hostOpensPreview(url: string, send: Send = fetch): Promise<boolean> {
	const res = await send(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: url }), credentials: "same-origin" });
	const answer: unknown = await res.json().catch(() => null);
	return res.ok && !!answer && typeof answer === "object" && Reflect.get(answer, "ok") === true;
}

/** From the status `host`: a desktop host opens the preview window; otherwise the browser does. */
export function noteRuntimePreview(host: unknown): void {
	const desktop = !!host && typeof host === "object" && Reflect.get(host, "kind") === "desktop";
	setPreviewHostOpener(desktop ? (url) => hostOpensPreview(url) : null);
}
