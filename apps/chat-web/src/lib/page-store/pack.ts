import { blocksOf, parsePage, type CreatorPage } from "./page";
import { latteForBlock, latteFromPage } from "./latte";
import { walkBlocks } from "./tree";
import { COIMPORT_PACK_FILES } from "./codeport-runtime";

export type PackFile = {
	path: string;
	content: string;
};

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
export function buildStoreZip(files: PackFile[]): Uint8Array {
	const encoder = new TextEncoder();
	const locals: Uint8Array[] = [];
	const centrals: Uint8Array[] = [];
	let offset = 0;

	for (const file of files) {
		const name = encoder.encode(file.path.replace(/\\/g, "/"));
		const data = encoder.encode(file.content);
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
		const central = concat([
			u32(0x02014b50),
			u16(20),
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
			u32(0),
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
function sha256Text(s: string): string {
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

function codeportRuntimeFiles(): PackFile[] {
	return COIMPORT_PACK_FILES.map((f) => ({ path: f.path, content: f.content }));
}

export function packFilesFromPage(
	page: CreatorPage,
	selectedId: string | null = null
): PackFile[] {
	const valid = parsePage(page);
	const pageLatte = latteFromPage(valid, selectedId);
	const files: PackFile[] = [{ path: "page.latte", content: pageLatte }];
	for (const block of walkBlocks(blocksOf(valid))) {
		files.push({
			path: `blocks/${block.id}.latte`,
			content: latteForBlock(block, selectedId)
		});
	}
	const runtime = codeportRuntimeFiles();
	files.push(...runtime);
	files.push({
		path: "page.json",
		content: `${JSON.stringify(valid, null, 2)}\n`
	});
	const generator = {
		name: "@buildytech/chat-web/codeport",
		emitter: "latteFromPage",
		packApi: "packFilesFromPage",
		packageVersion: "0.0.0",
		pageLatteSha256: sha256Text(pageLatte),
		runtimeFiles: runtime.map((f) => ({ path: f.path, sha256: sha256Text(f.content) })),
		contract:
			"layout Main/page.latte; $page object with title/id/slug/locale/status/seo and blocks[id] arrays"
	};
	files.push({
		path: "GENERATOR.json",
		content: `${JSON.stringify(generator, null, 2)}\n`
	});
	const paths = files.map((file) => file.path).concat("manifest.json");
	const manifest = {
		id: valid.id,
		slug: valid.slug,
		title: valid.title,
		status: valid.status,
		locale: valid.locale,
		seo: valid.seo,
		files: paths,
		generator: {
			name: generator.name,
			emitter: generator.emitter,
			pageLatteSha256: generator.pageLatteSha256
		}
	};
	files.push({
		path: "manifest.json",
		content: `${JSON.stringify(manifest, null, 2)}\n`
	});
	return files;
}

export function downloadPageZip(page: CreatorPage, selectedId: string | null = null): void {
	if (typeof document === "undefined") return;
	const bytes = buildStoreZip(packFilesFromPage(page, selectedId));
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
