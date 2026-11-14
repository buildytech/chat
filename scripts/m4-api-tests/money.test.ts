/**
 * Money props (owner: dish-showcase showed "RUB 6.50" for price 650). Codex v0.4: money is an integer in minor units
 * (fmtMoney divides by 10 ** digits). Decision t196u: the document stores minor units, but the model never sees them: what it
 * reads (page, get_block sample) is shown in major units and what it writes (page, patch values) is converted back before the
 * gate, by one pure pair (toMajor / toMinor with the digits of the currency); the Inspector shows and takes major units too. The
 * names come from the registry's own sources. The symbol ("RUB 650" instead of "650 ₽") is the upstream formatter's, not ours.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { addScreen, emptyPage, renderBlock, inspectorModel, inspectorShown, inspectorValue, installRenderProbe, pageForModel, sampleProps, toMajor, toMinor, writePage, type InspectorField } from "../../packages/builder-core/src/index.ts";
import { deriveMoneyNames } from "../lib/registry-derive.mjs";
import { propsOutline, readBlock, runWriteTool, type TurnContext } from "../../packages/chat-agent/src/index.ts";
import { runXaiCatalogTurn } from "../../apps/xai-runtime/src/chat-tools.ts";
import { MODEL, signal, withProvider } from "./agent-replay.ts";
import { fmtMoney } from "../../registry/svelte/src/utils/format.ts";
import type { PageV2 } from "../../packages/page-contract/src/index.ts";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const BUNDLE = join(ROOT, "api", "runtime", "_render", "blocks.mjs");
let html: (item: string, props: Record<string, unknown>) => string;
/** Intl puts a no-break space between the code and the amount: "RUB\u00a0650". */
const plain = (text: string) => text.replaceAll("\u00a0", " ");

before(async () => {
	if (!existsSync(BUNDLE)) spawnSync(process.execPath, [join(ROOT, "scripts/build-render-bundle.mjs")], { cwd: ROOT, stdio: "pipe" });
	const mod = (await import(pathToFileURL(BUNDLE).href)) as { blocks: Record<string, unknown>; render: (c: unknown, o: { props: Record<string, unknown> }) => { body: string } };
	const organismHtml = (organism: string, props: Record<string, unknown>) => mod.render(mod.blocks[organism], { props }).body;
	html = (item, props) => {
		const rendered = renderBlock({ item, props: props as never })!;
		return plain(organismHtml(rendered.organism, rendered.props));
	};
	installRenderProbe((organism, props) => ({ ok: true, html: organismHtml(organism, props) }), { required: true });
});
after(() => installRenderProbe(null));

const NOW = "2026-11-14T12:00:00.000Z";
const blank = (): PageV2 => {
	const start = addScreen(emptyPage({ title: "x", locale: "ru", now: NOW }), "screen.theme-marketing-landing/home");
	assert.ok(start.ok);
	return { ...start.page, blocks: [] };
};
const dish = (price: number, currency = "RUB", id = "d1") => ({ id, name: "Lamb", summary: "Charcoal", price, currency, weight: "300 g", tag: "hit", items: ["lamb"], minutes: 25 });
const showcase = (...prices: number[]): PageV2 =>
	({ ...blank(), blocks: [{ id: "dishes", item: "dish-showcase", variant: "grid4", props: { title: "Menu", dishes: prices.map((price, i) => dish(price, "RUB", `d${i}`)) } }] }) as PageV2;
const ctx = (page: PageV2): TurnContext => ({ brief: "x", mode: "build", page, expectedRevision: 1 });
const priceOf = (page: PageV2, row = 0) => (page.blocks[0]!.props as { dishes: Array<{ price: number }> }).dishes[row]!.price;
const printedPage = (): PageV2 => {
	const session = JSON.parse(readFileSync(join(ROOT, "scripts/m4-api-tests/fixtures/shashlyk-printed-5c155d3.json"), "utf8")) as { sessions: Array<{ ext: { chat: { messages: Array<{ text: string }> } } }> };
	return JSON.parse(/```json\n([\s\S]*?)\n```/.exec(session.sessions[0]!.ext.chat.messages[1]!.text)![1]!) as PageV2;
};

test("the money names are read from the registry sources, not listed by hand (and stay in step with the committed file)", () => {
	const names = deriveMoneyNames(ROOT);
	for (const name of ["price", "compareAt", "freeFrom", "minOrder", "total", "amount", "rate", "yearly"]) assert.ok(names.includes(name), name);
	for (const name of ["qty", "minutes", "seats", "credits", "rating"]) assert.ok(!names.includes(name), `${name} is not money`);
	assert.deepEqual(JSON.parse(readFileSync(join(ROOT, "packages/builder-core/src/catalog/money.json"), "utf8")).names, names);
});

test("minor and major units follow the digits of the currency (JPY and KRW have none)", () => {
	assert.equal(toMajor(65000, "RUB"), 650);
	assert.equal(toMajor(1250, "USD"), 12.5);
	assert.equal(toMajor(500, "JPY"), 500);
	assert.equal(toMinor(650, "RUB"), 65000);
	assert.equal(toMinor(12.5, "USD"), 1250);
	assert.equal(toMinor(19.99, "EUR"), 1999);
	assert.equal(toMinor(500, "KRW"), 500);
});

/** A small deterministic generator (the property tests are reproducible). */
function rng(seed: number) {
	let x = seed;
	return () => {
		x = (x * 1664525 + 1013904223) % 4294967296;
		return x / 4294967296;
	};
}

test("property: toMinor(toMajor(x)) = x for every whole minor amount, in currencies with and without minor digits", () => {
	const next = rng(7);
	for (const currency of ["RUB", "USD", "EUR", "JPY", "KRW"]) {
		for (let i = 0; i < 2000; i += 1) {
			const minor = Math.floor(next() * 10 ** (1 + Math.floor(next() * 8)));
			assert.equal(toMinor(toMajor(minor, currency), currency), minor, `${minor} ${currency}`);
		}
	}
});

test("property: the model view of a page, written back unchanged, is the same view (model-view -> write -> model-view identity)", () => {
	const next = rng(11);
	const currencies = ["RUB", "USD", "JPY", "KRW", "EUR"];
	for (let n = 0; n < 40; n += 1) {
		const stored = {
			...blank(),
			blocks: [
				{
					id: "dishes",
					item: "dish-showcase",
					variant: "grid4",
					props: { title: "Menu", dishes: Array.from({ length: 1 + Math.floor(next() * 3) }, (_, i) => dish(Math.floor(next() * 10 ** (2 + Math.floor(next() * 6))), currencies[Math.floor(next() * currencies.length)]!, `d${i}`)) }
				}
			]
		} as PageV2;
		const view = pageForModel(stored);
		const written = runWriteTool(ctx(stored), stored, { page: view });
		assert.ok(written.ok, JSON.stringify(written.ok ? "" : written.issues));
		if (!written.ok) return;
		assert.deepEqual(pageForModel(written.page), view);
		assert.deepEqual(written.page.blocks[0]!.props, stored.blocks[0]!.props, "and the stored document is unchanged");
	}
});

test("the model reads major units: the page, get_block's sample; the outline and the prompt say nothing about minor units", () => {
	const stored = showcase(65000);
	assert.equal(priceOf(pageForModel(stored)), 650);
	assert.equal(priceOf(stored), 65000, "the stored page is not touched");
	const read = readBlock("dish-showcase");
	assert.ok(read.ok);
	if (read.ok) {
		assert.equal((read.sample as { dishes: Array<{ price: number }> }).dishes[0]!.price, 10);
		assert.ok(!("money" in read));
	}
	const outline = (propsOutline("dish-showcase") ?? []).join("\n");
	assert.match(outline, /price:number/);
	assert.doesNotMatch(JSON.stringify(read) + outline, /minor/i);
});

test("write_page: a whole page and every kind of patch value are converted from major to stored units, other numbers are not", () => {
	const base = showcase(65000);
	const stored = (ops: unknown[]) => {
		const out = runWriteTool(ctx(base), base, { patch: ops });
		assert.ok(out.ok, JSON.stringify(out.ok ? "" : out.issues));
		return out.ok ? out.page : base;
	};
	const whole = runWriteTool(ctx(base), base, { page: showcase(890) });
	assert.ok(whole.ok);
	if (whole.ok) assert.equal(priceOf(whole.page), 89000);
	// a lone money prop: the currency sits beside it
	assert.equal(priceOf(stored([{ op: "replace", path: "/blocks/0/props/dishes/0/price", value: 690 }])), 69000);
	assert.equal(priceOf(stored([{ op: "replace", path: "/blocks/0/props/dishes/0/price", value: 12.5 }])), 1250);
	// minutes is not money
	const minutes = stored([{ op: "replace", path: "/blocks/0/props/dishes/0/minutes", value: 30 }]).blocks[0]!.props as { dishes: Array<{ minutes: number }> };
	assert.equal(minutes.dishes[0]!.minutes, 30);
	// a whole row, the whole list, the whole props, a whole block
	const row = stored([{ op: "add", path: "/blocks/0/props/dishes/-", value: dish(590, "RUB", "d9") }]);
	assert.equal(priceOf(row, 1), 59000);
	assert.equal(priceOf(stored([{ op: "replace", path: "/blocks/0/props/dishes", value: [dish(390, "RUB", "a"), dish(490, "RUB", "b")] }]), 1), 49000);
	assert.equal(priceOf(stored([{ op: "replace", path: "/blocks/0/props", value: { title: "Menu", dishes: [dish(250)] } }])), 25000);
	const added = stored([{ op: "add", path: "/blocks/-", value: { item: "dish-showcase", variant: "grid4", props: { title: "More", dishes: [dish(300, "RUB", "m")] } } }]);
	assert.equal((added.blocks[1]!.props as { dishes: Array<{ price: number }> }).dishes[0]!.price, 30000);
	// an index after an add finds its block
	const later = stored([
		{ op: "add", path: "/blocks/0", value: { item: "dish-showcase", variant: "grid4", props: { title: "First", dishes: [dish(100, "RUB", "f")] } } },
		{ op: "replace", path: "/blocks/1/props/dishes/0/price", value: 700 }
	]);
	assert.equal((later.blocks[0]!.props as { dishes: Array<{ price: number }> }).dishes[0]!.price, 10000);
	assert.equal(priceOf({ ...later, blocks: [later.blocks[1]!] } as PageV2), 70000);
	// a currency without minor digits is not scaled
	const yen = { ...base, blocks: [{ ...base.blocks[0]!, props: { title: "Menu", dishes: [dish(500, "JPY")] } }] } as PageV2;
	const yenOut = runWriteTool(ctx(yen), yen, { patch: [{ op: "replace", path: "/blocks/0/props/dishes/0/price", value: 800 }] });
	assert.ok(yenOut.ok);
	if (yenOut.ok) assert.equal(priceOf(yenOut.page), 800);
	// `ops` object form
	const objectForm = runWriteTool(ctx(base), base, { patch: { ops: [{ op: "replace", path: "/blocks/0/props/dishes/0/price", value: 123 }] } });
	assert.ok(objectForm.ok);
	if (objectForm.ok) assert.equal(priceOf(objectForm.page), 12300);
});

test("the Inspector shows major units and stores minor ones", () => {
	const model = inspectorModel({ id: "dishes", item: "dish-showcase", variant: "grid4", props: { title: "Menu", dishes: [dish(65000)] } });
	assert.ok(model.ok);
	if (!model.ok) return;
	const rows = model.fields.find((field) => field.name === "dishes")!.rows!;
	const price = rows[0]!.fields.find((field) => field.name === "price") as InspectorField;
	const minutes = rows[0]!.fields.find((field) => field.name === "minutes") as InspectorField;
	assert.deepEqual(price.money, { currency: "RUB" });
	assert.equal(minutes.money, undefined);
	assert.equal(price.value, 65000);
	assert.equal(inspectorShown(price), "650");
	assert.equal(inspectorValue(price, "650"), 65000);
	assert.equal(inspectorValue(price, "12.5"), 1250);
	assert.equal(inspectorValue(price, ""), 0);
	assert.equal(inspectorValue(minutes, "25"), 25);
	const yen = { ...price, money: { currency: "JPY" }, value: 500 };
	assert.equal(inspectorShown(yen), "500");
	assert.equal(inspectorValue(yen, "500"), 500);
});

test("samples start in minor units (stored), never 0", () => {
	const sample = sampleProps("dish-showcase", "grid4", "b1") as { dishes: Array<{ price: number; minutes: number }> };
	assert.ok(sample.dishes.length >= 2);
	for (const row of sample.dishes) {
		assert.equal(row.price, 1000);
		assert.equal(row.minutes, 0, "not money: untouched");
	}
	assert.match(html("dish-showcase", sample), /\$10\b/);
});

test("Shashlyk replay (session 5c155d3): the model writes 890 -> stored 89000 -> renders \"RUB 890\"; the next turn shows it as 890 again", async () => {
	const printed = printedPage();
	const base = blank();
	const out = runWriteTool(ctx(base), base, { page: printed });
	assert.ok(out.ok, JSON.stringify(out.ok ? "" : out.issues));
	if (!out.ok) return;
	assert.deepEqual(out.proposal.warnings.filter((w) => /major|minor/i.test(w)), [], "no warning about units");
	const block = out.page.blocks.find((b) => b.item === "dish-showcase")!;
	const rows = (block.props as { dishes: Array<{ price: number; currency: string }> }).dishes;
	assert.deepEqual(rows.map((r) => r.price), [89000, 69000, 59000, 39000]);
	assert.ok(html("dish-showcase", block.props as Record<string, unknown>).includes("RUB 890"));
	assert.equal(plain(fmtMoney(rows[0]!.price, "RUB")), "RUB 890");
	assert.equal(plain(fmtMoney(890, "RUB")), "RUB 8.90", "what the card showed before the conversion");
	// the whole chain through a turn: the model's write_page, then the next turn reads the page in major units
	const turn = await withProvider([{ calls: [{ name: "write_page", arguments: { page: printed } }] }], async (seen) => ({ out: await runXaiCatalogTurn("k", MODEL, ctx(base), signal()), seen }));
	assert.ok(turn.out.result.ok && turn.out.result.proposal);
	if (!turn.out.result.ok || !turn.out.result.proposal) return;
	assert.equal((turn.out.result.proposal.page.blocks[2]!.props as { dishes: Array<{ price: number }> }).dishes[0]!.price, 89000);
	const next = await withProvider([{ content: "ok" }], async (seen) => ({ out: await runXaiCatalogTurn("k", MODEL, ctx(turn.out.result.ok ? turn.out.result.proposal!.page : base), signal()), seen }));
	const prompt = JSON.parse(String((next.seen.requests[0]!.messages as Array<{ content: string }>)[1]!.content)) as { page: PageV2 };
	assert.equal((prompt.page.blocks[2]!.props as { dishes: Array<{ price: number }> }).dishes[0]!.price, 890);
});
