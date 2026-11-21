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
import { imageExtension, imageRefsOf, imagesManifest, localizeImages, planImages, type ImageFetch } from "../../apps/chat-web/src/lib/page-store/pack-images.ts";
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

test("localize: each URL fetched once, failures stay remote with a reason, a transform hook runs before the file", async () => {
	const calls: string[] = [];
	const broken: PageV2 = { ...page, blocks: page.blocks.map((b) => (b.id === "hero" ? { ...b, props: { ...b.props, imageDark: C } } : b)) };
	const images = await localizeImages(broken, fakeFetch(calls));
	assert.deepEqual(calls.sort(), [A, B, C].sort(), "deduped");
	assert.deepEqual(images.local.map((i) => i.path), ["src/assets/images/hero-image.jpg", "src/assets/images/team-members-1-avatar.png"]);
	assert.deepEqual(images.remote.map((i) => [i.url, i.reason]), [[C, "HTTP 404"]]);
	const manifest = imagesManifest(images)!;
	assert.deepEqual((manifest.remote as Array<{ usedBy: string[] }>)[0]!.usedBy, ["hero/imageDark"]);
	const converted = await localizeImages(page, fakeFetch([]), async (image) => ({ ...image, type: "image/webp" }));
	assert.deepEqual(converted.local.map((i) => i.path), ["src/assets/images/hero-image.webp", "src/assets/images/team-members-1-avatar.webp"]);
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
