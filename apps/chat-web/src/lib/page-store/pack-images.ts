/**
 * Pictures of the exported project (ADR 0061). Every remote picture address of the page (`image`, `imageDark`, `avatar`
 * at any depth of a block's props: sections, list records, photos, logos) is downloaded once per distinct URL into
 * `src/assets/images/<name>.<ext>`, and the section that shows it imports the file, so Vite fingerprints it, rewrites it
 * under any `base` and fails the build when it is missing. A download that fails keeps the remote address and is listed
 * in the report (manifest.json `images.remote`); it never fails the export. An `encode` step (the chat: WebP sizes from the
 * runtime, ADR 0062) turns a download into sizes `<name>-<width>.webp`; the section then passes the middle size as `image`
 * and, where the block takes it, every size as `imageSrcset`. A failed encode keeps the original file (reported).
 */
import type { BlockV2, PageV2 } from "@buildytech/page-contract";
import { isRuntimePicture } from "../runtime-files.ts";

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
/** One encoded size of a picture (WebP), made from the original. */
type EncodedVariant = { width: number; height: number; bytes: Uint8Array; type: string; quality?: number; sharpen?: number };
type EncodedImage = { original: { width: number; height: number; bytes?: number; type?: string }; variants: EncodedVariant[]; filters?: Record<string, number> };
/**
 * Turns the original into sizes; null or a throw keeps the original (reported as `encodeError`). `url`: hosts the encoder
 * reads itself (the runtime reads xAI pictures, which may be larger than an upload), tried before any download.
 */
export type ImageEncode = { bytes: (image: FetchedImage) => Promise<EncodedImage | null>; url?: { handles: (url: string) => boolean; encode: (url: string) => Promise<EncodedImage | null> } };
type LocalVariant = { path: string; width: number; height: number; bytes: Uint8Array; quality?: number; sharpen?: number };
type LocalImage = {
	url: string;
	/** The file `image` points at: the original, or the size closest to SRC_WIDTH. */
	path: string;
	bytes: Uint8Array;
	type: string;
	refs: ImageRef[];
	original: { bytes: number; type: string; width?: number; height?: number };
	/** The encoded sizes, narrowest first; empty when the original is kept. */
	variants: LocalVariant[];
	filters?: Record<string, number>;
	/** Why the original was kept although an encoder was given. */
	encodeError?: string;
};
type RemoteImage = { url: string; reason: string; refs: ImageRef[] };
export type LocalImages = { local: LocalImage[]; remote: RemoteImage[] };

const isRemoteImage = (value: unknown): value is string => typeof value === "string" && (/^https?:\/\/[^\s]+$/i.test(value.trim()) || isRuntimePicture(value));
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

/** `image` (the fallback for browsers without srcset) points at the widest size up to this width. */
const SRC_WIDTH = 1280;

function withVariants(planned: PlannedImage, image: { bytes: number; type: string }, encoded: EncodedImage): LocalImage | null {
	const sizes = encoded.variants.filter((v) => v.bytes.length > 0 && imageExtension(v.type)).sort((a, b) => a.width - b.width);
	if (!sizes.length) return null;
	const variants = sizes.map((v) => ({ path: `${IMAGES_DIR}/${planned.name}-${v.width}.${imageExtension(v.type)}`, width: v.width, height: v.height, bytes: v.bytes, quality: v.quality, sharpen: v.sharpen }));
	const src = [...variants].reverse().find((v) => v.width <= SRC_WIDTH) ?? variants[0]!;
	const original = { bytes: encoded.original.bytes ?? image.bytes, type: (encoded.original.type ?? image.type).split(";")[0]!.trim().toLowerCase(), width: encoded.original.width, height: encoded.original.height };
	return { url: planned.url, path: src.path, bytes: src.bytes, type: "image/webp", refs: planned.refs, original, variants, ...(encoded.filters ? { filters: encoded.filters } : {}) };
}

const reasonOf = (err: unknown, fallback: string): string => (err instanceof Error && err.message ? err.message.slice(0, 120) : fallback);

async function localize(planned: PlannedImage, fetchImage: ImageFetch, encode?: ImageEncode): Promise<LocalImage | RemoteImage> {
	let encodeError: string | undefined;
	const byUrl = encode?.url?.handles(planned.url) ? encode.url : undefined;
	if (byUrl) {
		try {
			const encoded = await byUrl.encode(planned.url);
			const local = encoded ? withVariants(planned, { bytes: 0, type: "" }, encoded) : null;
			if (local) return local;
			encodeError = "no size came back";
		} catch (err) {
			encodeError = reasonOf(err, "encode failed");
		}
	}
	let image: FetchedImage | null;
	try {
		image = await fetchImage(planned.url);
	} catch (err) {
		return { url: planned.url, reason: `${reasonOf(err, "download failed")}${encodeError ? `; encode: ${encodeError}` : ""}`, refs: planned.refs };
	}
	if (!image || image.bytes.length === 0) return { url: planned.url, reason: "download failed", refs: planned.refs };
	const ext = imageExtension(image.type);
	if (!ext) return { url: planned.url, reason: `unsupported type ${image.type.slice(0, 40) || "unknown"}`, refs: planned.refs };
	if (encode && !byUrl) {
		try {
			const encoded = await encode.bytes(image);
			const local = encoded ? withVariants(planned, { bytes: image.bytes.length, type: image.type }, encoded) : null;
			if (local) return local;
			encodeError = "no size came back";
		} catch (err) {
			encodeError = reasonOf(err, "encode failed");
		}
	}
	const type = image.type.split(";")[0]!.trim().toLowerCase();
	return { url: planned.url, path: `${IMAGES_DIR}/${planned.name}.${ext}`, bytes: image.bytes, type, refs: planned.refs, original: { bytes: image.bytes.length, type }, variants: [], ...(encodeError ? { encodeError } : {}) };
}

/** Downloads (and encodes) every distinct remote picture of the page, at most 4 at a time; failures stay remote and are reported. */
export async function localizeImages(page: PageV2, fetchImage: ImageFetch, encode?: ImageEncode): Promise<LocalImages> {
	const planned = planImages(page);
	const results: Array<LocalImage | RemoteImage> = new Array(planned.length);
	let next = 0;
	const worker = async () => {
		while (next < planned.length) {
			const index = next++;
			results[index] = await localize(planned[index]!, fetchImage, encode);
		}
	};
	await Promise.all(Array.from({ length: Math.min(4, planned.length) }, worker));
	return { local: results.filter((r): r is LocalImage => "path" in r), remote: results.filter((r): r is RemoteImage => !("path" in r)) };
}

/** Every file a local picture writes into the project: its sizes, or the original. */
export const imageFiles = (image: LocalImage): Array<{ path: string; bytes: Uint8Array }> => (image.variants.length ? image.variants : [image]);

/** Import name of a local picture in a section (`img_<file name>`). */
const importNameOf = (path: string): string => `img_${path.slice(path.lastIndexOf("/") + 1).replace(/\.[a-z0-9]+$/, "").replace(/[^a-zA-Z0-9]+/g, "_")}`;

/** Where a srcset of a picture prop goes, when the block takes one: `image` -> `imageSrcset` (null: the block does not). */
export type SrcsetKeyOf = (pointer: string, key: string) => string | null;
type SectionImport = { name: string; path: string };

/**
 * A block's props with each local picture swapped for a marker string, the marker -> code map and the files to import: the
 * section emitter prints the props as JSON, replaces each quoted marker with its code (an import name, or a template of
 * the size imports for a srcset) and imports the files.
 */
export function propsWithImports(props: Record<string, unknown>, images: LocalImages | null, srcsetKeyOf: SrcsetKeyOf = () => null): { props: Record<string, unknown>; code: Map<string, string>; imports: SectionImport[] } {
	const code = new Map<string, string>();
	const imports = new Map<string, SectionImport>();
	if (!images?.local.length) return { props, code, imports: [] };
	const byUrl = new Map(images.local.map((image) => [image.url, image]));
	const use = (path: string): string => {
		const name = importNameOf(path);
		imports.set(name, { name, path });
		return name;
	};
	const swapRecord = (record: Record<string, unknown>, pointer: string): Record<string, unknown> => {
		const out: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(record)) {
			const at = `${pointer}/${escapePointer(key)}`;
			const local = IMAGE_KEYS.has(key) && isRemoteImage(value) ? byUrl.get(value.trim()) : undefined;
			if (!local) {
				out[key] = swap(value, at);
				continue;
			}
			const marker = `__ui8kit_image__${importNameOf(local.path)}__`;
			code.set(marker, use(local.path));
			out[key] = marker;
			const srcsetKey = local.variants.length > 1 ? srcsetKeyOf(pointer, key) : null;
			if (srcsetKey && !(srcsetKey in record)) {
				const srcsetMarker = `__ui8kit_srcset__${importNameOf(local.path)}__`;
				code.set(srcsetMarker, `\`${local.variants.map((v) => `\${${use(v.path)}} ${v.width}w`).join(", ")}\``);
				out[srcsetKey] = srcsetMarker;
			}
		}
		return out;
	};
	const swap = (value: unknown, pointer: string): unknown => {
		if (Array.isArray(value)) return value.map((entry, index) => swap(entry, `${pointer}/${index}`));
		return isRecord(value) ? swapRecord(value, pointer) : value;
	};
	return { props: swapRecord(props, ""), code, imports: [...imports.values()] };
}

/**
 * A block's props for a server-rendered export (Go templ): each local picture becomes `urlOf(path)` (with the sizes as a
 * srcset where the block takes one) and a picture that stayed remote becomes "" (the block draws its placeholder: the
 * site's CSP serves pictures from itself only; manifest.json `images.remote` lists them).
 */
export function propsWithUrls(props: Record<string, unknown>, images: LocalImages | null, urlOf: (path: string) => string, srcsetKeyOf: SrcsetKeyOf = () => null): Record<string, unknown> {
	const byUrl = new Map((images?.local ?? []).map((image) => [image.url, image]));
	const swapRecord = (record: Record<string, unknown>, pointer: string): Record<string, unknown> => {
		const out: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(record)) {
			const at = `${pointer}/${escapePointer(key)}`;
			if (!IMAGE_KEYS.has(key) || !isRemoteImage(value)) {
				out[key] = swap(value, at);
				continue;
			}
			const local = byUrl.get(value.trim());
			out[key] = local ? urlOf(local.path) : "";
			const srcsetKey = local && local.variants.length > 1 ? srcsetKeyOf(pointer, key) : null;
			if (local && srcsetKey && !(srcsetKey in record)) out[srcsetKey] = local.variants.map((v) => `${urlOf(v.path)} ${v.width}w`).join(", ");
		}
		return out;
	};
	const swap = (value: unknown, pointer: string): unknown => {
		if (Array.isArray(value)) return value.map((entry, index) => swap(entry, `${pointer}/${index}`));
		return isRecord(value) ? swapRecord(value, pointer) : value;
	};
	return swapRecord(props, "");
}

/** The `images` entry of manifest.json: where each picture went (original and sizes in bytes), what stayed remote and why, the savings. */
export function imagesManifest(images: LocalImages | null, pathOf: (path: string) => string = (path) => path, dir = IMAGES_DIR): Record<string, unknown> | null {
	if (!images || (!images.local.length && !images.remote.length)) return null;
	const where = (refs: ImageRef[]) => refs.map((ref) => `${ref.blockId}${ref.pointer}`);
	const originalBytes = images.local.reduce((sum, image) => sum + image.original.bytes, 0);
	const writtenBytes = images.local.reduce((sum, image) => sum + imageFiles(image).reduce((n, file) => n + file.bytes.length, 0), 0);
	const filters = images.local.find((image) => image.filters)?.filters;
	return {
		dir,
		...(filters ? { filters } : {}),
		totals: { pictures: images.local.length, originalBytes, writtenBytes, savedBytes: originalBytes - writtenBytes, savedPercent: originalBytes ? Math.round((1 - writtenBytes / originalBytes) * 1000) / 10 : 0 },
		local: images.local.map((image) => ({
			path: pathOf(image.path),
			source: image.url,
			usedBy: where(image.refs),
			original: image.original,
			...(image.variants.length
				? { variants: image.variants.map((v) => ({ path: pathOf(v.path), width: v.width, height: v.height, bytes: v.bytes.length, ...(v.quality ? { quality: v.quality } : {}), ...(v.sharpen ? { sharpen: v.sharpen } : {}) })) }
				: { kept: "original", ...(image.encodeError ? { encodeError: image.encodeError } : {}) })
		})),
		remote: images.remote.map((image) => ({ source: image.url, reason: image.reason, usedBy: where(image.refs) }))
	};
}
