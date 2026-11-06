import { blocksOf, type CreatorPage } from "./page";
import { latteForBlock, latteFromPage } from "./latte";
import { walkBlocks } from "./tree";

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

export function packFilesFromPage(
	page: CreatorPage,
	selectedId: string | null = null
): PackFile[] {
	const files: PackFile[] = [{ path: "page.latte", content: latteFromPage(page, selectedId) }];
	for (const block of walkBlocks(blocksOf(page))) {
		files.push({
			path: `blocks/${block.id}.latte`,
			content: latteForBlock(block, selectedId)
		});
	}
	const manifest = {
		id: page.id,
		slug: page.slug,
		title: page.title,
		status: page.status,
		locale: page.locale,
		seo: page.seo,
		files: files.map((file) => file.path).concat("manifest.json")
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
