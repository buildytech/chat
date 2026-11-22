/**
 * Browser-only: ZIP download of the exported project. The registry files are read lazily from the pinned snapshot
 * (registry/svelte, raw text, bundled as separate chunks), so the main bundle does not carry them. Remote pictures are
 * downloaded into the project (ADR 0061): straight from the browser when the host allows it (CORS), else through the
 * sources a module offers (the chat proxies its own image hosts through its runtime). A module may save the archive
 * itself (the desktop host's save dialog, ADR 0065); when it cannot, the browser downloads it.
 */
import type { CreatorPage } from "./page.ts";
import { buildStoreZip, packZipFiles, type PackOptions, type RegistryReader } from "./pack.ts";
import { imageExtension, localizeImages, type ImageEncode, type ImageFetch, type LocalImages } from "./pack-images.ts";

/** Largest picture the export keeps (bytes); a larger one stays remote. */
const MAX_IMAGE_BYTES = 8_000_000;

async function fetchDirect(url: string): Promise<{ bytes: Uint8Array; type: string } | null> {
	try {
		const res = await fetch(url, { mode: "cors", credentials: "omit", redirect: "follow", signal: AbortSignal.timeout(20_000) });
		const type = res.headers.get("content-type") ?? "";
		if (!res.ok || !imageExtension(type)) return null;
		const bytes = new Uint8Array(await res.arrayBuffer());
		return bytes.length > 0 && bytes.length <= MAX_IMAGE_BYTES ? { bytes, type } : null;
	} catch {
		return null;
	}
}

/** A module's way to read pictures of hosts it knows (the chat's runtime proxy for its image hosts). */
export type ImageSource = { handles: (url: string) => boolean; fetch: ImageFetch };

/** The sources that know the host first (no doomed cross-origin attempt), then the browser directly. */
function chain(sources: readonly ImageSource[]): ImageFetch {
	return async (url) => {
		for (const source of sources.filter((s) => s.handles(url))) {
			const image = await source.fetch(url).catch(() => null);
			if (image && image.bytes.length > 0 && image.bytes.length <= MAX_IMAGE_BYTES) return image;
		}
		const direct = await fetchDirect(url);
		if (direct) return direct;
		throw new Error("not reachable from the browser (CORS or network)");
	};
}

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

/** A module's save of the archive: `saved`, `cancelled` by the person (nothing else happens), or a throw (the browser downloads it). */
export type ZipSaver = { available: (size: number) => boolean; save: (bytes: Uint8Array, name: string) => Promise<"saved" | "cancelled"> };

/** Builds and saves the ZIP (pictures encoded by `encode` when a module offers one, ADR 0062; saved by `saver` when it can); answers the pictures report, or null outside a browser. */
export async function downloadPageZip(page: CreatorPage, options: PackOptions = {}, imageSources: readonly ImageSource[] = [], encode?: ImageEncode, saver?: ZipSaver): Promise<LocalImages | null> {
	if (typeof document === "undefined") return null;
	const images = await localizeImages(page, chain(imageSources), encode);
	const bytes = buildStoreZip(await packZipFiles(page, readSnapshot, { ...options, images }));
	const name = `${page.slug || "page"}-pack.zip`;
	if (saver?.available(bytes.byteLength)) {
		const outcome = await saver.save(bytes, name).catch(() => null);
		if (outcome) return images;
	}
	const buffer = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(buffer).set(bytes);
	const blob = new Blob([buffer], { type: "application/zip" });
	const href = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = href;
	anchor.download = name;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(href);
	return images;
}
