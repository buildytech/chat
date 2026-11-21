/**
 * Pictures of the exported project (ADR 0061). Every remote picture address of the page (`image`, `imageDark`, `avatar`
 * at any depth of a block's props: sections, list records, photos, logos) is downloaded once per distinct URL into
 * `src/assets/images/<name>.<ext>`, and the section that shows it imports the file, so Vite fingerprints it, rewrites it
 * under any `base` and fails the build when it is missing. A download that fails keeps the remote address and is listed
 * in the report (manifest.json `images.remote`); it never fails the export. A conversion step (compression, WebP) plugs in
 * as `transform` between the download and the file.
 */
import type { BlockV2, PageV2 } from "@buildytech/page-contract";

/** Props that carry a picture address, wherever they sit in a block's props. */
const IMAGE_KEYS = new Set(["image", "imageDark", "avatar"]);
export const IMAGES_DIR = "src/assets/images";
/** Picture types the export keeps, by extension. */
const EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" };

type ImageRef = { blockId: string; pointer: string; url: string };
/** One distinct URL: the file name every reference shares (from the first reference, deterministic) and the references. */
type PlannedImage = { url: string; name: string; refs: ImageRef[] };
type FetchedImage = { bytes: Uint8Array; type: string };
/** Reads one picture; null or a throw is a failed download. */
export type ImageFetch = (url: string) => Promise<FetchedImage | null>;
/** Optional conversion between the download and the file (compression, WebP); its `type` sets the extension. */
type ImageTransform = (image: FetchedImage, planned: PlannedImage) => Promise<FetchedImage>;
type LocalImage = { url: string; path: string; bytes: Uint8Array; type: string; refs: ImageRef[] };
type RemoteImage = { url: string; reason: string; refs: ImageRef[] };
export type LocalImages = { local: LocalImage[]; remote: RemoteImage[] };

const isRemoteImage = (value: unknown): value is string => typeof value === "string" && /^https?:\/\/[^\s]+$/i.test(value.trim());
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const escapePointer = (key: string): string => key.replace(/~/g, "~0").replace(/\//g, "~1");

function walk(value: unknown, pointer: string, visit: (pointer: string, key: string, value: unknown) => void): void {
	if (Array.isArray(value)) value.forEach((entry, index) => walk(entry, `${pointer}/${index}`, visit));
	else if (isRecord(value))
		for (const [key, entry] of Object.entries(value)) {
			visit(`${pointer}/${escapePointer(key)}`, key, entry);
			walk(entry, `${pointer}/${escapePointer(key)}`, visit);
		}
}

function blockRefs(block: BlockV2): ImageRef[] {
	const refs: ImageRef[] = [];
	walk(block.props ?? {}, "", (pointer, key, value) => {
		if (IMAGE_KEYS.has(key) && isRemoteImage(value)) refs.push({ blockId: block.id, pointer, url: value.trim() });
	});
	return refs;
}

/** Every remote picture reference of the page, in page order (block order, then props order). */
export function imageRefsOf(page: PageV2): ImageRef[] {
	return page.blocks.flatMap(blockRefs);
}

const slug = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "image";

/** Distinct URLs with stable names: `<block id>-<pointer>` of the first reference; a clash gets `-2`, `-3`. */
export function planImages(page: PageV2): PlannedImage[] {
	const byUrl = new Map<string, PlannedImage>();
	const taken = new Set<string>();
	for (const ref of imageRefsOf(page)) {
		const known = byUrl.get(ref.url);
		if (known) {
			known.refs.push(ref);
			continue;
		}
		const base = slug(`${ref.blockId}${ref.pointer.replace(/\//g, "-")}`);
		let name = base;
		for (let n = 2; taken.has(name); n++) name = `${base}-${n}`;
		taken.add(name);
		byUrl.set(ref.url, { url: ref.url, name, refs: [ref] });
	}
	return [...byUrl.values()];
}

/** File extension of a picture type (parameters ignored); null when the export does not keep that type. */
export function imageExtension(type: string): string | null {
	return EXTENSIONS[type.split(";")[0]!.trim().toLowerCase()] ?? null;
}

async function localize(planned: PlannedImage, fetchImage: ImageFetch, transform?: ImageTransform): Promise<LocalImage | RemoteImage> {
	let image: FetchedImage | null;
	try {
		image = await fetchImage(planned.url);
	} catch (err) {
		return { url: planned.url, reason: err instanceof Error && err.message ? err.message.slice(0, 120) : "download failed", refs: planned.refs };
	}
	if (!image || image.bytes.length === 0) return { url: planned.url, reason: "download failed", refs: planned.refs };
	if (transform) image = await transform(image, planned);
	const ext = imageExtension(image.type);
	if (!ext) return { url: planned.url, reason: `unsupported type ${image.type.slice(0, 40) || "unknown"}`, refs: planned.refs };
	return { url: planned.url, path: `${IMAGES_DIR}/${planned.name}.${ext}`, bytes: image.bytes, type: image.type.split(";")[0]!.trim().toLowerCase(), refs: planned.refs };
}

/** Downloads every distinct remote picture of the page (in parallel); failures stay remote and are reported. */
export async function localizeImages(page: PageV2, fetchImage: ImageFetch, transform?: ImageTransform): Promise<LocalImages> {
	const results = await Promise.all(planImages(page).map((planned) => localize(planned, fetchImage, transform)));
	return { local: results.filter((r): r is LocalImage => "path" in r), remote: results.filter((r): r is RemoteImage => !("path" in r)) };
}

/** Import name of a local picture in a section (`img_<file name>`). */
const importNameOf = (path: string): string => `img_${path.slice(path.lastIndexOf("/") + 1).replace(/\.[a-z0-9]+$/, "").replace(/[^a-zA-Z0-9]+/g, "_")}`;

/**
 * A block's props with each local picture swapped for a marker string, and the marker -> import name map: the section
 * emitter prints the props as JSON, replaces each quoted marker with the bare import name and imports the file.
 */
export function propsWithImports(props: Record<string, unknown>, images: LocalImages | null): { props: Record<string, unknown>; imports: Map<string, { name: string; path: string }> } {
	const imports = new Map<string, { name: string; path: string }>();
	if (!images?.local.length) return { props, imports };
	const byUrl = new Map(images.local.map((image) => [image.url, image]));
	const swap = (value: unknown, key: string): unknown => {
		if (Array.isArray(value)) return value.map((entry) => swap(entry, ""));
		if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, swap(v, k)]));
		if (!IMAGE_KEYS.has(key) || !isRemoteImage(value)) return value;
		const local = byUrl.get(value.trim());
		if (!local) return value;
		const marker = `__ui8kit_image__${importNameOf(local.path)}__`;
		imports.set(marker, { name: importNameOf(local.path), path: local.path });
		return marker;
	};
	return { props: Object.fromEntries(Object.entries(props).map(([k, v]) => [k, swap(v, k)])), imports };
}

/** The `images` entry of manifest.json: where each picture went, and which stayed remote and why. */
export function imagesManifest(images: LocalImages | null): Record<string, unknown> | null {
	if (!images || (!images.local.length && !images.remote.length)) return null;
	const where = (refs: ImageRef[]) => refs.map((ref) => `${ref.blockId}${ref.pointer}`);
	return {
		dir: IMAGES_DIR,
		local: images.local.map((image) => ({ path: image.path, type: image.type, bytes: image.bytes.length, source: image.url, usedBy: where(image.refs) })),
		remote: images.remote.map((image) => ({ source: image.url, reason: image.reason, usedBy: where(image.refs) }))
	};
}
