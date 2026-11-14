/**
 * Module checks of the gate (ADR 0041).
 *   node scripts/check-modules.mjs              boundary + message ownership (source text, fast)
 *   node scripts/check-modules.mjs --no-trace   also builds the app with VITE_MODULE_CHAT=0, checks the bundle has no trace of the chat
 *                                               and runs the headless smoke on the chat-off build (and on the chat-on build when there is one)
 * No-trace: the chat module's own strings (its message keys and texts, its string literals and those of the chat-agent
 * package that no core source also uses) are absent from every file of the chat-off build. A control run over the
 * normal build (when one exists) proves the same tokens are found when the chat is on, so the check cannot pass empty.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { headlessSmoke } from "./lib/headless-smoke.mjs";
import { WEB_SRC, boundaryViolations, catalogs, coreFiles, isSource, walk } from "./lib/module-boundary.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "apps/chat-web/build-nochat");

function report(title, problems) {
	if (problems.length) console.error(`${title}: ${problems.length} problem(s)\n  ${problems.join("\n  ")}`);
	else console.log(`${title}: ok`);
	return problems.length === 0;
}

/** Plain words the framework and its dependencies carry in every bundle (the chat's gateway happens to use them too). */
const FRAMEWORK_WORDS = new Set(["production", "development", "cache-control"]);

const strings = (text) => [...text.matchAll(/(["'`])((?:\\.|(?!\1)[^\\\n$])*)\1/g)].map((m) => m[2]).filter((s) => s.length >= 10 && /[A-Za-z]{3}/.test(s));

/** Strings only the chat has: module and chat-agent literals and message texts, minus anything a core source also says. */
export function chatTokens() {
	const { core, modules } = catalogs(root);
	const coreText = [
		...coreFiles(root),
		...walk(join(root, "packages/builder-core/src"), isSource),
		...walk(join(root, "packages/page-contract/src"), isSource),
		...walk(join(root, "packages/page-contract/schema"), (p) => p.endsWith(".json")),
		// The UI kit and compositions the shell is made of (class strings and attribute values they share with the chat UI).
		...walk(join(root, "registry/svelte/src"), isSource)
	].map((p) => readFileSync(p, "utf8")).join("\n");
	const coreValues = new Set([...Object.values(core.en), ...Object.values(core.ru)]);
	const tokens = new Set();
	for (const catalog of Object.values(modules)) {
		for (const lang of ["en", "ru"]) {
			for (const [key, value] of Object.entries(catalog[lang])) {
				tokens.add(key);
				if (value.length >= 12 && !coreValues.has(value)) tokens.add(value);
			}
			// The chat's wording of core keys ("New chat"): the core's own words are neutral, so these must be absent when the chat is off.
			for (const value of Object.values(catalog.overrides[lang])) if (value.length >= 8 && !coreValues.has(value)) tokens.add(value);
		}
	}
	const sources = [...walk(join(root, WEB_SRC, "modules/chat"), isSource), ...walk(join(root, "packages/chat-agent/src"), isSource)].filter((p) => !p.endsWith(".test.ts"));
	for (const path of sources) for (const s of strings(readFileSync(path, "utf8"))) tokens.add(s);
	return [...tokens].filter((token) => !FRAMEWORK_WORDS.has(token) && !coreText.includes(token) && !token.includes("${"));
}

const bundleText = (dir) => walk(dir, (p) => /\.(js|css|html|json|map|txt)$/.test(p)).map((p) => readFileSync(p, "utf8")).join("\n");

async function noTrace() {
	rmSync(out, { recursive: true, force: true });
	const build = spawnSync("npm", ["run", "build", "--workspace=@buildytech/chat-web"], { cwd: root, stdio: "inherit", env: { ...process.env, VITE_MODULE_CHAT: "0", BUILDY_BUILD_DIR: out } });
	if (build.status !== 0) return report("no-trace build", ["the chat-off build failed"]);
	const tokens = chatTokens();
	const off = bundleText(out);
	const found = tokens.filter((token) => off.includes(token));
	let ok = report(`no-trace: ${tokens.length} chat-only strings absent from the chat-off bundle`, found.slice(0, 20).map((token) => `found in the chat-off bundle: ${JSON.stringify(token.slice(0, 80))}`));
	const problems = [];
	for (const needle of ["runtime/v1", "buildy:v1:selectedModelId"]) if (off.includes(needle)) problems.push(`chat-off bundle contains ${needle}`);
	if (!existsSync(join(out, "200.html"))) problems.push("the chat-off build has no 200.html");
	ok = report("no-trace: no chat route or API path", problems) && ok;
	const control = join(root, "apps/chat-web/build");
	if (existsSync(control)) {
		const on = bundleText(control);
		const present = tokens.filter((token) => on.includes(token)).length;
		const share = present / tokens.length;
		ok = report("no-trace control", share >= 0.6 ? [] : [`only ${present}/${tokens.length} chat-only strings are in the chat-on build: the check is not looking at the right files`]) && ok;
		console.log(`control: ${present}/${tokens.length} chat-only strings found in the chat-on build`);
	} else console.log("control: no chat-on build in apps/chat-web/build (run npm run build first for the control)");
	ok = (await headless(out, false)) && ok;
	if (existsSync(control)) ok = (await headless(control, true)) && ok;
	return ok;
}

async function headless(dir, chat) {
	return report(`headless smoke (${chat ? "chat on" : "chat off"})`, await headlessSmoke({ dir, chat }));
}

let ok = report("module boundary", boundaryViolations(root));
const { i18nViolations } = await import("./lib/module-boundary.mjs");
ok = report("message ownership", i18nViolations(root)) && ok;
if (process.argv.includes("--no-trace")) ok = (await noTrace()) && ok;
process.exit(ok ? 0 : 1);
