/**
 * Headless smoke of a built app (ADR 0041, gate): a static server with the SPA fallback (200.html), Chrome through
 * playwright-core. It checks, for a chat-off or a chat-on build, that the builder is the product (brand, left tabs,
 * /build), that a block can be added from the feed, edited in the Inspector, survives a reload and an export/import,
 * and (chat off) that the stored and exported project carry no chat keys and nothing calls /runtime.
 * Browser: BUILDY_CHROME (default /usr/bin/google-chrome). No browser: the check fails unless BUILDY_HEADLESS=skip.
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".txt": "text/plain" };
export const BRAND = "βuildγ";
export const DOCUMENT_TITLE = "βuildγ — BuildYtech";
const CHAT_KEYS = ["messages", "mode", "usage", "selectedModelId", "ext", "extra"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function serve(dir) {
	const root = resolve(dir);
	const server = createServer((req, res) => {
		let file = join(root, decodeURIComponent(req.url.split("?")[0]));
		if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
		if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
		if (!existsSync(file)) file = join(root, "200.html");
		res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
		createReadStream(file).pipe(res);
	});
	return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok({ server, base: `http://127.0.0.1:${server.address().port}/` })));
}

/** @returns {Promise<string[]>} failed check names (empty: all passed) */
export async function headlessSmoke({ dir, chat }) {
	const mode = chat ? "chat on" : "chat off";
	const executablePath = process.env.BUILDY_CHROME || "/usr/bin/google-chrome";
	if (!existsSync(executablePath)) {
		if (process.env.BUILDY_HEADLESS === "skip") { console.log(`headless (${mode}): skipped, no browser at ${executablePath}`); return []; }
		return [`headless (${mode}): no browser at ${executablePath} (set BUILDY_CHROME, or BUILDY_HEADLESS=skip)`];
	}
	const { chromium } = await import("playwright-core");
	const { server, base } = await serve(dir);
	const browser = await chromium.launch({ executablePath });
	const pass = [], fail = [];
	const ok = (name, cond, info) => { (cond ? pass : fail).push(name); if (!cond) console.error(`  FAIL ${mode}: ${name} ${info === undefined ? "" : JSON.stringify(info)}`); };
	try {
		const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
		const pg = await ctx.newPage();
		const errs = [], reqs = [];
		pg.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
		pg.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 160)); });
		pg.on("request", (r) => reqs.push(r.url()));
		await pg.goto(base); await sleep(1500);
		await pg.evaluate(() => localStorage.clear()); await pg.reload(); await sleep(2500);
		const docs = () => pg.evaluate(() => { const k = Object.keys(localStorage).find((x) => /sessions/.test(x) && !/quarantine|migration/.test(x)); return { sessions: k ? JSON.parse(localStorage.getItem(k) || "[]") : [], keys: Object.keys(localStorage) }; });
		const frameOf = async () => { let fr = await (await pg.$("iframe"))?.contentFrame(); for (let i = 0; i < 20 && (!fr || !(await fr.$("[data-block-id]"))); i++) { await sleep(800); fr = await (await pg.$("iframe"))?.contentFrame(); } return fr; };
		// brand: βuildγ in both builds, never a product name of ours that is not the brand
		ok("document title is the brand", (await pg.title()) === DOCUMENT_TITLE, await pg.title());
		const brandWord = await pg.locator('[data-slot="brand-word"]').first().innerText().catch(() => "");
		ok("sidebar brand is the brand", brandWord.trim() === BRAND, brandWord);
		const everyText = await pg.evaluate(() => document.body.innerText + " " + document.title);
		ok("no other product name in the UI", !/SI Builder|SI Chat|SI Конструктор|SI Чат/.test(everyText));
		const tabs = await pg.locator('[role="tablist"][data-slot="left-tabs"] [role="tab"]').allInnerTexts();
		if (chat) ok("left panel has Blocks, Sections and Chat", tabs.length === 3 && tabs.some((t) => /chat/i.test(t)), tabs);
		else {
			ok("left panel has Blocks and Sections only", tabs.length === 2 && !tabs.some((t) => /chat/i.test(t)), tabs);
			const visible = (await pg.evaluate(() => document.body.innerText + " " + [...document.querySelectorAll("[aria-label],[title],[placeholder]")].map((e) => [e.getAttribute("aria-label"), e.getAttribute("title"), e.getAttribute("placeholder")].join(" ")).join(" ") + " " + document.title)).replace(/T3 Chat/g, "");
			ok("no chat word anywhere in the visible UI, labels or title", !/chat|чат/i.test(visible), (visible.match(/.{0,30}(chat|чат).{0,30}/i) || [])[0]);
			ok("no composer or thread in the DOM", (await pg.locator('#composer, textarea[name="message"], [data-role="assistant"]').count()) === 0);
		}
		// 1. add a block from the feed
		const cards = pg.locator('[data-slot="feed-card"]');
		for (let i = 0; i < 10 && !(await cards.count()); i++) await sleep(700);
		ok("feed shows cards", (await cards.count()) > 0, await cards.count());
		await pg.locator('[data-slot="feed-card"] button[aria-label^="Add"]').first().click({ timeout: 5000 }); await sleep(2500);
		let fr = await frameOf();
		ok("block added to the preview", fr ? (await fr.evaluate(() => document.querySelectorAll("[data-block-id]").length)) === 1 : false);
		let d = await docs();
		const s1 = d.sessions[0] || {};
		ok("a project is stored with its page", d.sessions.length === 1 && s1.pageRevision >= 1, Object.keys(s1));
		if (chat) ok("the stored project keeps its chat", Array.isArray(s1.messages), Object.keys(s1));
		else {
			ok("the stored project has no chat keys", !CHAT_KEYS.some((k) => k in s1), Object.keys(s1));
			ok("no chat storage key", !d.keys.some((k) => /selectedModelId/.test(k)), d.keys);
		}
		// 2. edit in the Inspector
		const head = fr.locator("[data-block-id] :is(h1,h2,h3)").filter({ hasText: /\S/ }).first();
		await head.scrollIntoViewIfNeeded().catch(() => {});
		await head.click({ timeout: 5000 }); await sleep(900);
		ok("preview click focuses an inspector field", await pg.evaluate(() => !!document.activeElement?.closest('[data-slot="inspector"]')));
		const NEW = "Headless smoke heading";
		await pg.keyboard.press("Control+A"); await pg.keyboard.type(NEW); await pg.keyboard.press("Tab"); await sleep(1500);
		fr = await frameOf();
		ok("inspector edit shows in the preview", await fr.evaluate((t) => document.body.innerText.includes(t), NEW));
		d = await docs();
		const s2 = d.sessions[0] || {};
		ok("edit made a revision with a history entry", s2.pageRevision >= 2 && (s2.history || []).length >= 2, s2.pageRevision);
		// 3. reload persists
		await pg.reload(); await sleep(3500);
		fr = await frameOf();
		ok("reload keeps the page and the edit", fr ? await fr.evaluate((t) => document.body.innerText.includes(t), NEW) : false);
		d = await docs();
		ok("reload kept the same document", d.sessions.length === 1 && d.sessions[0].pageRevision === s2.pageRevision, d.sessions[0]?.pageRevision);
		// 4. export (file and API), then import into an empty browser
		const exported = await pg.evaluate(() => window.buildy.export());
		ok("export is a session file with the project", exported.format === "buildy:v1" && exported.sessions.length === 1 && !!exported.sessions[0].page);
		if (!chat) ok("exported project has no chat keys", !CHAT_KEYS.some((k) => k in exported.sessions[0]) && !("selectedModelId" in (exported.settings || {})), Object.keys(exported.sessions[0]));
		const dl = pg.waitForEvent("download", { timeout: 8000 });
		await pg.evaluate(() => window.buildy.export({ download: true }));
		ok("export downloads a .json file", /buildy-session-.*\.json$/.test((await dl).suggestedFilename()));
		await pg.evaluate(() => localStorage.clear()); await pg.reload(); await sleep(2500);
		const imp = await pg.evaluate((f) => window.buildy.import(f), exported);
		ok("import of the exported file succeeds", imp.ok === true, imp);
		await sleep(2000);
		fr = await frameOf();
		ok("imported project shows its edited page", fr ? await fr.evaluate((t) => document.body.innerText.includes(t), NEW) : false);
		// 5. /build is the builder in every build; the chat build alone talks to /runtime
		if (!chat) ok("no /runtime call at all", !reqs.some((u) => /\/runtime\//.test(u)), reqs.filter((u) => /\/runtime\//.test(u)));
		await pg.goto(base + "build"); await sleep(2500);
		ok("/build opens the builder", (await pg.locator("#creator-shell").count()) === 1 && (await pg.locator('[data-slot="feed-card"]').count()) > 0);
		ok("/build keeps the brand", (await pg.title()) === DOCUMENT_TITLE, await pg.title());
		await pg.goto(base + "build?collection=abc"); await sleep(2500);
		ok("/build?collection= opens the builder too", (await pg.locator("#creator-shell").count()) === 1);
		ok("no page errors", errs.length === 0, errs);
	} finally {
		await browser.close();
		server.close();
	}
	console.log(`headless (${mode}): ${pass.length} passed, ${fail.length} failed`);
	return fail;
}
