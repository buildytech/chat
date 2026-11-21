/**
 * ZIP export pictures (ADR 0061): every remote picture address is downloaded once per URL into src/assets/images with a
 * stable name, the sections import the files (Vite fingerprints them and resolves them under any base), a failed
 * download stays remote and is reported, and the unzipped project builds with no remote picture address left.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { type PageV2 } from "../../packages/page-contract/src/index.ts";
import { emptyPage, writePage } from "../../packages/builder-core/src/index.ts";
import { imageExtension, imageRefsOf, imagesManifest, localizeImages, planImages, propsWithImports, type ImageEncode, type ImageFetch } from "../../apps/chat-web/src/lib/page-store/pack-images.ts";
import { sveltePackFiles } from "../../apps/chat-web/src/lib/page-store/svelte-code.ts";
import { buildStoreZip, packZipFiles, type PackEntry } from "../../apps/chat-web/src/lib/page-store/pack.ts";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SNAPSHOT = path.join(ROOT, "registry/svelte");
const NOW = "2026-11-21T00:00:00.000Z";
const A = "https://imgen.x.ai/xai-imgen/xai-tmp-imgen-aaaa.jpeg";
const B = "https://imgen.x.ai/xai-imgen/xai-tmp-imgen-bbbb.jpeg";
const C = "https://example.test/broken.png";

const fill = JSON.parse(readFileSync(path.join(ROOT, "scripts/m4-api-tests/fixtures/studio-fill.json"), "utf8")) as PageV2;
// The hero and two team portraits share A (one file), the third portrait is B; a relative path is already local.
const withPictures: PageV2 = {
	...fill,
	blocks: fill.blocks.map((block) => {
		if (block.item === "hero-simple") return { ...block, props: { ...block.props, image: A } };
		const members = (block.props?.members ?? []) as Array<Record<string, unknown>>;
		return { ...block, props: { ...block.props, members: members.map((m, i) => ({ ...m, avatar: [A, B, "/team/mira.jpg"][i] })) } };
	})
};
const written = writePage(emptyPage({ title: fill.title, locale: "en", now: NOW }), { page: withPictures }, { now: NOW });
assert.ok(written.ok, JSON.stringify(!written.ok && written.issues));
const page = written.page;

/** A JPEG-looking payload above Vite's 4 KiB inline limit, so the build emits it as a file. */
const jpeg = (seed: number) => {
	const bytes = new Uint8Array(6000).map((_, i) => (i * 31 + seed) & 0xff);
	bytes.set([0xff, 0xd8, 0xff, 0xe0], 0);
	return bytes;
};
const fakeFetch = (calls: string[]): ImageFetch => async (url) => {
	calls.push(url);
	if (url === A) return { bytes: jpeg(1), type: "image/jpeg" };
	if (url === B) return { bytes: jpeg(2), type: "image/png; charset=binary" };
	throw new Error("HTTP 404");
};

test("refs: image and avatar at any depth, remote only; one planned file per URL with a stable block/pointer name", () => {
	const refs = imageRefsOf(page);
	assert.deepEqual(refs.map((ref) => `${ref.blockId}${ref.pointer}=${ref.url === A ? "A" : "B"}`), ["hero/image=A", "team/members/0/avatar=A", "team/members/1/avatar=B"]);
	const planned = planImages(page);
	assert.deepEqual(planned.map((p) => [p.name, p.refs.length]), [["hero-image", 2], ["team-members-1-avatar", 1]]);
	assert.deepEqual(planImages(page), planned, "deterministic");
	const clash: PageV2 = { ...page, blocks: [...page.blocks, { ...page.blocks[0]!, id: "hero-image", props: { ...page.blocks[0]!.props, image: C } }] };
	assert.equal(planImages(clash).at(-1)!.name, "hero-image-image");
});

test("content type sets the extension; unknown types are not kept", () => {
	assert.equal(imageExtension("image/jpeg"), "jpg");
	assert.equal(imageExtension("IMAGE/PNG; q=1"), "png");
	assert.equal(imageExtension("image/webp"), "webp");
	assert.equal(imageExtension("image/avif"), "avif");
	assert.equal(imageExtension("text/html"), null);
	assert.equal(imageExtension("image/svg+xml"), null);
});

test("localize: each URL fetched once, failures stay remote with a reason", async () => {
	const calls: string[] = [];
	const broken: PageV2 = { ...page, blocks: page.blocks.map((b) => (b.id === "hero" ? { ...b, props: { ...b.props, imageDark: C } } : b)) };
	const images = await localizeImages(broken, fakeFetch(calls));
	assert.deepEqual(calls.sort(), [A, B, C].sort(), "deduped");
	assert.deepEqual(images.local.map((i) => i.path), ["src/assets/images/hero-image.jpg", "src/assets/images/team-members-1-avatar.png"]);
	assert.deepEqual(images.remote.map((i) => [i.url, i.reason]), [[C, "HTTP 404"]]);
	const manifest = imagesManifest(images)!;
	assert.deepEqual((manifest.remote as Array<{ usedBy: string[] }>)[0]!.usedBy, ["hero/imageDark"]);
});

/** Stand-in for the runtime encoder: sizes 960 and 1152 (the original is 1152 wide), each a fifth of the original. */
const sizes = (bytes: Uint8Array) => {
	const size = (width: number) => ({ width, height: Math.round(width * 0.75), bytes: bytes.slice(0, 1200), type: "image/webp", quality: width === 960 ? 72 : 78 });
	return { original: { width: 1152, height: 864 }, variants: [size(1152), size(960)], filters: { contrast: -0.06, cool: 0.03 } };
};
const fakeEncode = (fail: string[] = []): ImageEncode => ({
	bytes: async (image) => {
		if (fail.includes(String(image.bytes[4]))) throw new Error("encode_failed");
		return sizes(image.bytes);
	}
});

test("encode by address: hosts the encoder reads itself are not downloaded first; a failure there keeps the downloaded original", async () => {
	const calls: string[] = [];
	const encode: ImageEncode = {
		bytes: async () => assert.fail("bytes path not used for a host the encoder reads"),
		url: { handles: (url) => url.startsWith("https://imgen.x.ai/"), encode: async (url) => { if (url === B) throw new Error("asset_too_large"); return { ...sizes(jpeg(1)), original: { width: 2368, height: 1776, bytes: 6_906_491, type: "image/png" } }; } }
	};
	const images = await localizeImages(page, fakeFetch(calls), encode);
	assert.deepEqual(calls, [B], "A was encoded by address, only B (failed there) was downloaded");
	const a = images.local.find((i) => i.url === A)!;
	assert.deepEqual(a.original, { bytes: 6_906_491, type: "image/png", width: 2368, height: 1776 });
	assert.equal(images.local.find((i) => i.url === B)!.encodeError, "asset_too_large");
});

test("encode: sizes <name>-<width>.webp narrowest first, image points at the widest up to 1280; a failed encode keeps the original", async () => {
	const images = await localizeImages(page, fakeFetch([]), fakeEncode([String(jpeg(2)[4])]));
	const hero = images.local.find((i) => i.url === A)!;
	assert.deepEqual(hero.variants.map((v) => v.path), ["src/assets/images/hero-image-960.webp", "src/assets/images/hero-image-1152.webp"]);
	assert.equal(hero.path, "src/assets/images/hero-image-1152.webp");
	const kept = images.local.find((i) => i.url === B)!;
	assert.equal(kept.path, "src/assets/images/team-members-1-avatar.png");
	assert.equal(kept.encodeError, "encode_failed");
	const manifest = imagesManifest(images) as { totals: Record<string, number>; filters: Record<string, number>; local: Array<Record<string, unknown>> };
	assert.deepEqual(manifest.filters, { contrast: -0.06, cool: 0.03 });
	assert.deepEqual(manifest.totals, { pictures: 2, originalBytes: 12000, writtenBytes: 2400 + 6000, savedBytes: 3600, savedPercent: 30 });
	assert.deepEqual((manifest.local[0]!.variants as Array<Record<string, number>>).map((v) => [v.width, v.bytes, v.quality]), [[960, 1200, 72], [1152, 1200, 78]]);
	assert.equal(manifest.local[1]!.kept, "original");
});

test("srcset: where the block takes imageSrcset, the section passes every size as a template of the size imports", async () => {
	const images = await localizeImages(page, fakeFetch([]), fakeEncode());
	const hero = page.blocks.find((b) => b.id === "hero")!;
	const out = propsWithImports(hero.props as Record<string, unknown>, images, (pointer, key) => (pointer === "" && key === "image" ? "imageSrcset" : null));
	assert.equal(out.props.image, "__ui8kit_image__img_hero_image_1152__");
	assert.equal(out.code.get(out.props.imageSrcset as string), "`${img_hero_image_960} 960w, ${img_hero_image_1152} 1152w`");
	assert.deepEqual(out.imports.map((i) => i.path), ["src/assets/images/hero-image-1152.webp", "src/assets/images/hero-image-960.webp"]);
	const none = propsWithImports(hero.props as Record<string, unknown>, images);
	assert.ok(!("imageSrcset" in none.props), "no srcset prop where the block has none");
});

test("srcset with the pinned schema: hero-simple takes imageSrcset (registry 65277dd), a team avatar takes none", async () => {
	const images = await localizeImages(page, fakeFetch([]), fakeEncode());
	const files = sveltePackFiles(page, images);
	const hero = files.find((f) => f.path === "src/sections/hero.svelte")!.content;
	assert.match(hero, /"image": img_hero_image_1152,/);
	assert.match(hero, /"imageSrcset": `\$\{img_hero_image_960\} 960w, \$\{img_hero_image_1152\} 1152w`,/);
	const team = files.find((f) => f.path.startsWith("src/sections/") && f.content.includes('"avatar"'))!.content;
	assert.ok(!team.includes("Srcset"), "no srcset key next to an avatar");
	const frame = readFileSync(path.join(SNAPSHOT, "src/components/media-frame.svelte"), "utf8");
	assert.match(frame, /srcset=\{srcsetOf\(lightSet\)\}/, "the pinned MediaFrame passes the srcset to the picture");
});

test("sections import their local pictures and keep remote or relative addresses as they are", async () => {
	const images = await localizeImages(page, fakeFetch([]));
	const files = sveltePackFiles(page, images);
	const hero = files.find((f) => f.path === "src/sections/hero.svelte")!.content;
	assert.match(hero, /import img_hero_image from "\.\.\/assets\/images\/hero-image\.jpg";/);
	assert.match(hero, /"image": img_hero_image,/);
	assert.ok(!hero.includes(A));
	const team = files.find((f) => f.path === "src/sections/team.svelte")!.content;
	assert.equal(team.match(/import img_hero_image /g)?.length, 1, "one import per file even when used twice");
	assert.match(team, /"avatar": img_hero_image/);
	assert.match(team, /"avatar": img_team_members_1_avatar/);
	assert.match(team, /"avatar": "\/team\/mira\.jpg"/);
	assert.deepEqual(sveltePackFiles(page), sveltePackFiles(page, null), "without pictures the sections are unchanged");
	assert.ok(sveltePackFiles(page)[1]!.content.includes(A), "no download: the remote address stays");
});

function unzipEntries(bytes: Uint8Array): PackEntry[] {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const out: PackEntry[] = [];
	let offset = 0;
	while (view.getUint32(offset, true) === 0x04034b50) {
		const size = view.getUint32(offset + 18, true);
		const nameStart = offset + 30;
		const dataStart = nameStart + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
		out.push({ path: new TextDecoder().decode(bytes.subarray(nameStart, dataStart)), bytes: bytes.slice(dataStart, dataStart + size) });
		offset = dataStart + size;
	}
	return out;
}

test("the unzipped project builds with the pictures as fingerprinted assets under its base, no downloaded address left", async () => {
	const images = await localizeImages(page, fakeFetch([]));
	const read = async (paths: string[]) => Object.fromEntries(paths.map((file) => [file, readFileSync(path.join(SNAPSHOT, file), "utf8")]));
	const entries = unzipEntries(buildStoreZip(await packZipFiles(page, read, { images })));
	const byPath = new Map(entries.map((e) => [e.path, e]));
	assert.deepEqual(byPath.get("src/assets/images/hero-image.jpg") && "bytes" in byPath.get("src/assets/images/hero-image.jpg")! ? [...byPath.get("src/assets/images/hero-image.jpg")!.bytes.slice(0, 4)] : null, [0xff, 0xd8, 0xff, 0xe0], "binary kept byte for byte");
	assert.ok(byPath.has("src/vite-env.d.ts"));
	const manifest = JSON.parse(new TextDecoder().decode((byPath.get("manifest.json") as { bytes: Uint8Array }).bytes)) as { files: string[]; images: { local: Array<{ path: string }> } };
	assert.ok(manifest.files.includes("src/assets/images/hero-image.jpg"));
	assert.equal(manifest.images.local.length, 2);
	const dir = mkdtempSync(path.join(tmpdir(), "buildy-pictures-"));
	try {
		for (const entry of entries) {
			const target = path.join(dir, entry.path);
			mkdirSync(path.dirname(target), { recursive: true });
			writeFileSync(target, "bytes" in entry ? entry.bytes : entry.content);
		}
		symlinkSync(path.join(ROOT, "node_modules"), path.join(dir, "node_modules"), process.platform === "win32" ? "junction" : "dir");
		const run = spawnSync(process.execPath, [path.join(ROOT, "node_modules/vite/bin/vite.js"), "build", "--base", "/shop/", "--logLevel", "warn"], { cwd: dir, encoding: "utf8", timeout: 180_000 });
		assert.equal(run.status, 0, `vite build failed:\n${run.stdout}\n${run.stderr}`);
		const assets = readdirSync(path.join(dir, "dist/assets"));
		const heroFile = assets.find((f) => /^hero-image-[\w-]+\.jpg$/.test(f));
		assert.ok(heroFile && assets.some((f) => /^team-members-1-avatar-[\w-]+\.png$/.test(f)), assets.join(", "));
		const js = assets.filter((f) => f.endsWith(".js")).map((f) => readFileSync(path.join(dir, "dist/assets", f), "utf8")).join("\n");
		assert.ok(!js.includes("imgen.x.ai"), "no downloaded address in the build");
		assert.ok(js.includes(`/shop/assets/${heroFile}`), "the picture resolves under the base");
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("ADR 0065: desktop pictures enter the ZIP plan only when the host advertises files:true", async () => {
	const { noteRuntimeFiles, isRuntimePicture } = await import("../../apps/chat-web/src/lib/runtime-files.ts");
	const local = `/runtime/v1/files/${"a".repeat(64)}.jpg`;
	const page = emptyPage({ title: "Desktop pictures" });
	page.blocks = [{ id: "hero", item: "hero-simple", variant: "mediaStart", props: { image: local } }];
	try {
		noteRuntimeFiles(false);
		assert.deepEqual(planImages(page), []);
		noteRuntimeFiles(true);
		assert.equal(planImages(page)[0]?.url, local);
		for (const bad of ["/photo.jpg", "/runtime/v1/files/../private.jpg", `${local}?x=1`, `${local}#x`, `https://elsewhere.test${local}`, `/runtime/v1/files/${"b".repeat(63)}.png`]) assert.equal(isRuntimePicture(bad), false);
		const { runtimeImageSource, runtimeImageEncoder } = await import("../../apps/chat-web/src/modules/chat/media/client.ts");
		assert.equal(runtimeImageSource.handles(local), true);
		assert.equal(runtimeImageEncoder.url.handles(local), true);
		noteRuntimeFiles(false);
		assert.equal(runtimeImageSource.handles(local), false);
		assert.equal(runtimeImageSource.handles("https://imgen.x.ai/a.jpg"), true, "web path unchanged");
	} finally {
		noteRuntimeFiles(false);
	}
});
