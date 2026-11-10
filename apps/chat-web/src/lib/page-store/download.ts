/**
 * Browser-only: ZIP download of the exported project. The registry files are read lazily from the pinned snapshot
 * (registry/svelte, raw text, bundled as separate chunks), so the main bundle does not carry them.
 */
import type { CreatorPage } from "./page.ts";
import { buildStoreZip, packZipFiles, type PackOptions, type RegistryReader } from "./pack.ts";

const ROOT = "registry/svelte/";

const readSnapshot: RegistryReader = async (paths) => {
	const modules = import.meta.glob<string>(
		["../../../../../registry/svelte/ui8kit.*.json", "../../../../../registry/svelte/src/**/*"],
		{ query: "?raw", import: "default" }
	);
	const byPath = new Map(Object.entries(modules).map(([key, load]) => [key.slice(key.indexOf(ROOT) + ROOT.length), load]));
	const out: Record<string, string> = {};
	await Promise.all(
		paths.map(async (path) => {
			const load = byPath.get(path);
			if (load) out[path] = await load();
		})
	);
	return out;
};

export async function downloadPageZip(page: CreatorPage, options: PackOptions = {}): Promise<void> {
	if (typeof document === "undefined") return;
	const bytes = buildStoreZip(await packZipFiles(page, readSnapshot, options));
	const buffer = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(buffer).set(bytes);
	const blob = new Blob([buffer], { type: "application/zip" });
	const href = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = href;
	anchor.download = `${page.slug || "page"}-pack.zip`;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(href);
}
