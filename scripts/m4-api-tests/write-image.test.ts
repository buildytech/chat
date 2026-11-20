/**
 * Pictures (ADR 0049): an optional `image` (https URL or relative path) and `imageAlt` on a block, `image` on a list record.
 * Without one the registry placeholder shows; a value that is not an https URL or a relative path is dropped from the write
 * with a note, like an unknown icon. The Inspector edits the field as plain text through the same write; the export of a page
 * with pictures is the registry's own files (compared with the CLI in export-cli.test.ts).
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { applyOp, catalogBlocks, emptyPage, inspectorModel, propsFieldTree, renderBlock, writePage } from "../../packages/builder-core/src/index.ts";
import { isImageName, isImageUrl } from "../../packages/builder-core/src/catalog/image-url.ts";
import type { PageV2 } from "../../packages/page-contract/src/index.ts";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const NOW = "2026-11-15T12:00:00.000Z";
const URL_A = "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=1200&q=80";
const base = () => emptyPage({ title: "t", now: NOW });
const imgs = (html: string) => [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
const attr = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

async function html(page: PageV2, index = 0): Promise<string> {
	const bundlePath = join(ROOT, "api", "runtime", "_render", "blocks.mjs");
	if (!existsSync(bundlePath)) spawnSync(process.execPath, [join(ROOT, "scripts/build-render-bundle.mjs")], { cwd: ROOT, stdio: "pipe" });
	const mod = (await import(pathToFileURL(bundlePath).href)) as { blocks: Record<string, unknown>; render: (c: unknown, o: { props: Record<string, unknown> }) => { body: string } };
	const rendered = renderBlock(page.blocks[index]!)!;
	return mod.render(mod.blocks[`blocks/${rendered.item}.svelte`], { props: rendered.props as Record<string, unknown> }).body;
}

const block = (props: Record<string, unknown>, item = "hero-simple") => ({ ...base(), blocks: [{ item, props }] });

test("isImageUrl: https URLs and relative paths pass; other schemes, protocol-relative, spaces and markup do not", () => {
	for (const ok of ["", URL_A, "https://cdn.example.com/a.jpg", "/photos/a.jpg", "./a.jpg", "../a.jpg", "photos/a.jpg"]) assert.ok(isImageUrl(ok), ok);
	for (const bad of ["http://example.com/a.jpg", "data:image/svg+xml;base64,PHN2Zz4=", "javascript:alert(1)", "//example.com/a.jpg", "a photo of a cake", "https://example/a.jpg", "https://x.com/a b.jpg", 'https://x.com/"><script>', "ftp://x.com/a.jpg", `https://x.com/${"a".repeat(2100)}`]) assert.ok(!isImageUrl(bad), bad);
});

test("the registry exposes image and imageAlt as plain text on the section blocks and image on the records", () => {
	const tree = propsFieldTree("hero-simple")!;
	const image = tree.find((n) => n.name === "image")!;
	assert.equal(image.kind, "text");
	assert.equal(image.required, false);
	assert.equal(image.image, true);
	const alt = tree.find((n) => n.name === "imageAlt")!;
	assert.equal(alt.kind, "text");
	assert.ok(!alt.image, "imageAlt is not an address");
	const members = propsFieldTree("team-simple")!.find((n) => n.name === "members")!;
	assert.ok(members.fields!.find((f) => f.name === "avatar")?.image, "a member's portrait is an address");
	assert.ok(tree.find((n) => n.name === "imageDark")?.image, "the dark picture is an address");
	// every media place of the block contracts is an address the write checks (imageAlt is its text; logos-simple: the logo's
	// title is its alt text, /logos/*/title)
	const media = catalogBlocks().flatMap((block) => block.contract.places.filter((place) => place.kind === "media").flatMap((place) => place.fields));
	assert.ok(media.length >= 4);
	for (const field of media.filter((f) => !f.endsWith("Alt") && !f.endsWith("/title"))) assert.ok(isImageName(field.split("/").at(-1)!), field);
});

test("write_page without an image: the block shows the decorative placeholder", async () => {
	const written = writePage(base(), { page: block({ title: "Birthday" }) });
	assert.ok(written.ok, JSON.stringify(!written.ok && written.issues));
	if (!written.ok) return;
	assert.ok(!("image" in (written.page.blocks[0]!.props as Record<string, unknown>)));
	const tags = imgs(await html(written.page));
	assert.ok(tags.length > 0);
	assert.ok(tags.every((t) => attr(t, "src")!.startsWith("data:image/svg+xml") && attr(t, "alt") === ""), tags.join("\n"));
});

test("write_page with an image: kept, the block shows it with its alt text, lazy", async () => {
	const written = writePage(base(), { page: block({ title: "Birthday", image: URL_A, imageAlt: "A birthday cake" }) });
	assert.ok(written.ok, JSON.stringify(!written.ok && written.issues));
	if (!written.ok) return;
	const props = written.page.blocks[0]!.props as Record<string, unknown>;
	assert.equal(props.image, URL_A);
	assert.equal(written.warnings.filter((w) => w.includes("image")).length, 0);
	const shown = imgs(await html(written.page)).filter((t) => attr(t, "src") === URL_A.replaceAll("&", "&amp;") || attr(t, "src") === URL_A);
	assert.ok(shown.length > 0, "the picture is rendered");
	for (const t of shown) {
		assert.equal(attr(t, "alt"), "A birthday cake");
		assert.equal(attr(t, "loading"), "lazy");
	}
	// no imageAlt: the title is the alt text
	const noAlt = writePage(base(), { page: block({ title: "Birthday", image: "/photos/cake.jpg" }) });
	assert.ok(noAlt.ok);
	if (!noAlt.ok) return;
	const picture = imgs(await html(noAlt.page)).filter((t) => attr(t, "src") === "/photos/cake.jpg");
	assert.ok(picture.length > 0 && picture.every((t) => attr(t, "alt") === "Birthday"), picture.join("\n"));
});

test("a bad address is dropped with a note, the page is still written (section and record)", () => {
	for (const bad of ["http://example.com/a.jpg", "javascript:alert(1)", "a photo of a cake", "data:image/png;base64,AAAA"]) {
		const written = writePage(base(), { page: block({ title: "Birthday", image: bad }) });
		assert.ok(written.ok, `${bad}: ${JSON.stringify(!written.ok && written.issues)}`);
		if (!written.ok) continue;
		assert.ok(!("image" in (written.page.blocks[0]!.props as Record<string, unknown>)), bad);
		assert.ok(written.warnings.some((w) => w.startsWith("/blocks/0/props/image: image ") && w.includes("not an https URL or a relative path; dropped")), JSON.stringify(written.warnings));
	}
	const team = writePage(base(), { page: { ...base(), blocks: [{ item: "team-simple", props: { title: "Team", members: [{ id: "a", title: "Anna", description: "Design", avatar: URL_A }, { id: "b", title: "Ilya", description: "Plans", avatar: "ftp://x/a.jpg" }] } }] } });
	assert.ok(team.ok, JSON.stringify(!team.ok && team.issues));
	if (!team.ok) return;
	const members = (team.page.blocks[0]!.props as { members: Array<Record<string, unknown>> }).members;
	assert.equal(members[0]!.avatar, URL_A);
	assert.ok(!("avatar" in members[1]!));
	assert.ok(team.warnings.some((w) => w.startsWith("/blocks/0/props/members/1/avatar: image ")), JSON.stringify(team.warnings));
});

test("the Inspector: image is a text field; a set writes it, a bad address is dropped with a note", () => {
	const added = writePage(base(), { patch: [{ op: "add", path: "/blocks/-", value: { item: "hero-simple" } }] }, { now: NOW });
	assert.ok(added.ok);
	if (!added.ok) return;
	const model = inspectorModel(added.page.blocks[0]!);
	assert.ok(model.ok);
	for (const name of ["image", "imageAlt"]) {
		const field = model.fields.find((f) => f.name === name);
		assert.ok(field, `${name} is an Inspector field`);
		assert.equal(field.widget, "text");
	}
	const id = added.page.blocks[0]!.id;
	const set = applyOp(added.page, { op: "set", blockId: id, pointer: "/image", value: URL_A });
	assert.ok(set.ok, JSON.stringify(set));
	if (!set.ok) return;
	assert.equal(set.page.blocks[0]!.props?.image, URL_A);
	const bad = applyOp(added.page, { op: "set", blockId: id, pointer: "/image", value: "not a url" });
	assert.ok(bad.ok, JSON.stringify(bad));
	if (!bad.ok) return;
	assert.ok(!("image" in (bad.page.blocks[0]!.props ?? {})));
	assert.ok(bad.warnings.some((w) => /image "not a url" is not an https URL/.test(w)), JSON.stringify(bad.warnings));
});
