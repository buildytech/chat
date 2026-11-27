import { parsePage, type CreatorPage } from "./page.ts";
import { registrySkin } from "@buildytech/builder-core";
import chatPackage from "../../../package.json" with { type: "json" };
import { configText, CUSTOM_SKIN_BASE_CSS, renderCustomSkin, type ThemeConfig } from "../theme/custom-skin.ts";
import { CUSTOM_SKIN_CSS, THEME_FILE, scaffold } from "./pack-scaffold.ts";
import { imageFiles, imagesManifest, type LocalImages } from "./pack-images.ts";
import { registryItemsOf, registryLockItemsOf, registryPathsOf, svelteFromPage, sveltePackFiles } from "./svelte-code.ts";

export type PackFile = {
	path: string;
	content: string;
};
/** A binary file of the exported project (a downloaded picture). */
type PackAsset = { path: string; bytes: Uint8Array };
/** A file the project runs (a shell script): unix mode 0755 in the ZIP. Absent: no mode, as every Svelte file. */
type PackExecutable = PackFile & { executable: true };
export type PackEntry = PackFile | PackAsset | PackExecutable;

function crcTable(): Uint32Array {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		table[n] = c >>> 0;
	}
	return table;
}

const CRC_TABLE = crcTable();

function crc32(data: Uint8Array): number {
	let c = 0xffffffff;
	for (let i = 0; i < data.length; i++) {
		c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
	}
	return (c ^ 0xffffffff) >>> 0;
}

function u16(n: number): Uint8Array {
	const out = new Uint8Array(2);
	new DataView(out.buffer).setUint16(0, n, true);
	return out;
}

function u32(n: number): Uint8Array {
	const out = new Uint8Array(4);
	new DataView(out.buffer).setUint32(0, n, true);
	return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
	const total = parts.reduce((sum, part) => sum + part.length, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
}

/** Uncompressed ZIP (STORE). No extra dependency. */
export function buildStoreZip(files: readonly PackEntry[]): Uint8Array {
	const encoder = new TextEncoder();
	const locals: Uint8Array[] = [];
	const centrals: Uint8Array[] = [];
	let offset = 0;

	for (const file of files) {
		const name = encoder.encode(file.path.replace(/\\/g, "/"));
		const data = "bytes" in file ? file.bytes : encoder.encode(file.content);
		const crc = crc32(data);
		const utf8Flag = 0x0800;
		const local = concat([
			u32(0x04034b50),
			u16(20),
			u16(utf8Flag),
			u16(0),
			u16(0),
			u16(0),
			u32(crc),
			u32(data.length),
			u32(data.length),
			u16(name.length),
			u16(0),
			name,
			data
		]);
		const unix = "executable" in file && file.executable === true;
		const central = concat([
			u32(0x02014b50),
			u16(unix ? 0x0314 : 20),
			u16(20),
			u16(utf8Flag),
			u16(0),
			u16(0),
			u16(0),
			u32(crc),
			u32(data.length),
			u32(data.length),
			u16(name.length),
			u16(0),
			u16(0),
			u16(0),
			u16(0),
			u32(unix ? 0o100755 * 0x10000 : 0),
			u32(offset),
			name
		]);
		locals.push(local);
		centrals.push(central);
		offset += local.length;
	}

	const centralDir = concat(centrals);
	const eocd = concat([
		u32(0x06054b50),
		u16(0),
		u16(0),
		u16(files.length),
		u16(files.length),
		u32(centralDir.length),
		u32(offset),
		u16(0)
	]);

	return concat([...locals, centralDir, eocd]);
}

/** Sync SHA-256 (UTF-8) for GENERATOR.json — pure JS, browser + Node. */
export function sha256Text(s: string): string {
	const bytes = new TextEncoder().encode(s);
	return sha256Hex(bytes);
}

function sha256Hex(data: Uint8Array): string {
	const K = new Uint32Array([
		0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
		0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
		0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
		0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
		0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
		0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
		0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
		0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
	]);
	const rr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
	let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
	let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
	const l = data.length;
	const bit = l * 8;
	const withPad = new Uint8Array(((l + 9 + 63) >> 6) << 6);
	withPad.set(data);
	withPad[l] = 0x80;
	new DataView(withPad.buffer).setUint32(withPad.length - 4, bit >>> 0, false);
	const w = new Uint32Array(64);
	for (let i = 0; i < withPad.length; i += 64) {
		for (let j = 0; j < 16; j++) w[j] = new DataView(withPad.buffer).getUint32(i + j * 4, false);
		for (let j = 16; j < 64; j++) {
			const v1 = w[j - 15]!, s0 = rr(v1, 7) ^ rr(v1, 18) ^ (v1 >>> 3);
			const v2 = w[j - 2]!, s1 = rr(v2, 17) ^ rr(v2, 19) ^ (v2 >>> 10);
			w[j] = (w[j - 16]! + s0 + w[j - 7]! + s1) >>> 0;
		}
		let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
		for (let j = 0; j < 64; j++) {
			const S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25);
			const ch = (e & f) ^ (~e & g);
			const t1 = (h + S1 + ch + K[j]! + w[j]!) >>> 0;
			const S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22);
			const maj = (a & b) ^ (a & c) ^ (b & c);
			const t2 = (S0 + maj) >>> 0;
			h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
		}
		h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
		h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
	}
	return [h0, h1, h2, h3, h4, h5, h6, h7].map((x) => x.toString(16).padStart(8, "0")).join("");
}

export { CUSTOM_SKIN_CSS, PACK_DEPENDENCIES, PACK_DEV_DEPENDENCIES, THEME_FILE } from "./pack-scaffold.ts";

/** CLI files at the project root (exactly as `npx ui8kit init` writes them; the lock lists only this page's items). */
export const CLI_CONFIG = "ui8kit.config.json";
export const CLI_LOCK = "ui8kit.lock.json";

/** Reads registry snapshot files by path relative to registry/svelte (`ui8kit.config.json`, `src/blocks/x.svelte`). */
export type RegistryReader = (paths: string[]) => Promise<Record<string, string>>;

/**
 * Export options: the chat's skin (session `skin`, ADR 0016); null or unknown is the default theme. `theme`: the Custom
 * Skin (ADR 0025), a magazine-theme v2 config; its base skin is the registry skin, the rest goes on <html> and in theme.json.
 */
export type PackOptions = { skin?: string | null; theme?: ThemeConfig | null; images?: LocalImages | null; contract?: Record<string, unknown> | null };

/** `vite/client` types for the picture imports of the sections (only when the export carries pictures). */
const VITE_ENV = { path: "src/vite-env.d.ts", content: '/// <reference types="vite/client" />\n' };

/** The pack format of manifest.json and GENERATOR.json (both exports; `framework` names which one). */
export const PACK_FORMAT = { format: "buildy.pack.v1", schemaVersion: 1 } as const;

function generatorOf(page: CreatorPage, skin: string | null) {
	return {
		...PACK_FORMAT,
		framework: "svelte",
		name: "@buildytech/chat-web/svelte-pack",
		emitter: "svelteFromPage",
		packApi: "packFilesFromPage",
		packageVersion: chatPackage.version,
		appSvelteSha256: sha256Text(svelteFromPage(page)),
		registryItems: registryItemsOf(page, skin),
		contract:
			"Vite + Svelte 5 project as `npx ui8kit init --yes --framework svelte` + `npx ui8kit add <registryItems>` writes it (install root src); src/App.svelte composes src/sections/*.svelte, each a registry block or the not-in-registry stub"
	};
}

/**
 * Everything of the exported project the chat writes itself (scaffold, App.svelte, sections, page.json, GENERATOR.json,
 * manifest.json). The registry files, ui8kit.config.json and ui8kit.lock.json are listed in the manifest and added by
 * packZipFiles from the pinned snapshot.
 */
export function packFilesFromPage(page: CreatorPage, options: PackOptions = {}): PackFile[] {
	const valid = parsePage(page);
	const custom = options.theme ? renderCustomSkin(options.theme) : null;
	const theme = registrySkin(custom ? custom.skin : options.skin);
	const skin = theme?.id ?? null;
	const images = options.images ?? null;
	const files: PackFile[] = [...scaffold(valid.slug || "page", valid.title, theme, custom, images), ...sveltePackFiles(valid, images)];
	if (images?.local.length) files.push(VITE_ENV);
	files.push({ path: "page.json", content: `${JSON.stringify(valid, null, 2)}\n` });
	if (options.theme) {
		files.push({ path: THEME_FILE, content: `${configText(options.theme)}\n` });
		files.push({ path: CUSTOM_SKIN_CSS, content: CUSTOM_SKIN_BASE_CSS });
	}
	if (options.contract) files.push({ path: "brand.contract.json", content: `${JSON.stringify(options.contract, null, 2)}\n` });
	const generator = generatorOf(valid, skin);
	files.push({ path: "GENERATOR.json", content: `${JSON.stringify(generator, null, 2)}\n` });
	const paths = [...files.map((file) => file.path), ...(images?.local ?? []).flatMap((image) => imageFiles(image).map((file) => file.path)), CLI_CONFIG, CLI_LOCK, ...registryPathsOf(valid, skin), "manifest.json"];
	const pictures = imagesManifest(images);
	const manifest = {
		...PACK_FORMAT,
		framework: "svelte",
		id: valid.id,
		slug: valid.slug,
		title: valid.title,
		status: valid.status,
		locale: valid.locale,
		seo: valid.seo,
		skin,
		...(options.theme ? { customSkin: { file: THEME_FILE, format: options.theme.format, version: options.theme.version } } : {}),
		files: paths,
		...(pictures ? { images: pictures } : {}),
		generator: { name: generator.name, emitter: generator.emitter, appSvelteSha256: generator.appSvelteSha256 }
	};
	files.push({ path: "manifest.json", content: `${JSON.stringify(manifest, null, 2)}\n` });
	return files;
}

/** ui8kit.lock.json of `init` + `add <items>`: the snapshot lock restricted to those items (same format and order). */
function lockFor(fullLock: string, items: readonly string[]): string {
	const lock = JSON.parse(fullLock) as { items: Record<string, { name: string }> } & Record<string, unknown>;
	const keep = new Set(items);
	const picked = Object.fromEntries(Object.entries(lock.items).filter(([, item]) => keep.has(item.name)));
	return `${JSON.stringify({ ...lock, items: picked }, null, 2)}\n`;
}

/**
 * The whole exported project: packFilesFromPage plus the registry files of the page, read from the pinned snapshot, and
 * the downloaded pictures (`options.images`, from localizeImages) as binary entries.
 */
export async function packZipFiles(page: CreatorPage, read: RegistryReader, options: PackOptions = {}): Promise<PackEntry[]> {
	const valid = parsePage(page);
	const skin = registrySkin(options.theme ? renderCustomSkin(options.theme).skin : options.skin)?.id ?? null;
	const own = packFilesFromPage(valid, { skin, theme: options.theme ?? null, images: options.images ?? null });
	const registryPaths = registryPathsOf(valid, skin);
	const registry = await read([CLI_CONFIG, CLI_LOCK, ...registryPaths]);
	for (const path of [CLI_CONFIG, CLI_LOCK, ...registryPaths]) {
		if (registry[path] === undefined) throw new Error(`registry snapshot has no ${path}`);
	}
	const manifest = own.pop()!;
	return [
		...own,
		...(options.images?.local ?? []).flatMap((image) => imageFiles(image).map((file) => ({ path: file.path, bytes: file.bytes }))),
		{ path: CLI_CONFIG, content: registry[CLI_CONFIG]! },
		{ path: CLI_LOCK, content: lockFor(registry[CLI_LOCK]!, registryLockItemsOf(valid, skin)) },
		...registryPaths.map((path) => ({ path, content: registry[path]! })),
		manifest
	];
}

