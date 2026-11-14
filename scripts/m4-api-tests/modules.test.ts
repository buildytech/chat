/**
 * ADR 0041: the chat is an optional module. The core knows only the BuilderModule port; a module that is off leaves no
 * trace. Pure parts and source rules here; the bundle check (`npm run modules:check -- --no-trace`) builds the app with the chat off.
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { boundaryViolations, i18nViolations } from "../lib/module-boundary.mjs";
import { moduleEnabled } from "../../apps/chat-web/module-flags.ts";
import { docOfProject, projectOfDoc } from "../../apps/chat-web/src/lib/project/doc.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const web = (path: string) => read(`apps/chat-web/src/${path}`);

// This file never registers the chat's project keys: it is the project of a build with the chat off.
const NOW = "2026-11-14T12:00:00.000Z";
const chatDoc = {
	id: "session-a",
	title: "Coffee",
	createdAt: NOW,
	updatedAt: NOW,
	mode: "build",
	selectedModelId: "grok-4",
	pageId: "page-a",
	pageRevision: 1,
	skin: "warm",
	usage: { runs: 1 },
	messages: [{ id: "m1", role: "user", text: "hi", createdAt: NOW }],
	history: [{ revision: 1, at: NOW, cause: "apply" }]
};
const plainDoc = { id: "session-b", title: "Page", updatedAt: NOW, pageId: "page-b", pageRevision: 2, skin: "dark" };

test("flag: VITE_MODULE_CHAT is on by default and off for 0 / false / off / no in any case", () => {
	for (const on of [undefined, "", "1", "true", "on", "yes", "anything"]) assert.equal(moduleEnabled(on), true, String(on));
	for (const off of ["0", "false", "FALSE", " off ", "No"]) assert.equal(moduleEnabled(off), false, off);
	const config = read("apps/chat-web/vite.config.ts");
	assert.match(config, /__MODULE_CHAT__: JSON\.stringify\(chat\)/);
	assert.match(config, /const proxy = chat \?/, "the /runtime proxy exists only with the chat on");
	assert.match(read(".env.example"), /^VITE_MODULE_CHAT=1$/m);
	assert.match(web("modules/index.ts"), /if \(__MODULE_CHAT__\) registerModule\(\(await import\("\.\/chat"\)\)\.chatModule\)/, "the one named import is dynamic and under the build-time flag");
	assert.match(web("hooks.client.ts"), /await loadModules\(\)/);
	assert.ok(existsSync(join(root, "apps/chat-web/src/routes/build/+page.svelte")), "/build is a route of the core, in every build");
	assert.doesNotMatch(web("routes/build/+page.svelte"), /__MODULE_CHAT__|modules\//, "the /build route does not depend on a module");
});

test("the brand is βuildγ in the core and no module re-words it", () => {
	const BRAND = "βuildγ";
	for (const lang of ["en", "ru"]) {
		const core = JSON.parse(web(`lib/i18n/${lang}.json`)).messages as Record<string, string>;
		assert.equal(core["sidebar.brand"], BRAND, lang);
		assert.equal(core["app.documentTitle"], `${BRAND} — BuildYtech`, lang);
		const chat = JSON.parse(web(`modules/chat/i18n/${lang}.json`)) as { messages: Record<string, string>; overrides: Record<string, string> };
		for (const key of ["sidebar.brand", "sidebar.brandMark", "app.documentTitle"]) {
			assert.ok(!(key in chat.overrides) && !(key in chat.messages), `the chat does not re-word ${key} (${lang})`);
		}
		for (const [key, value] of Object.entries(core)) assert.doesNotMatch(value, /SI Builder|SI Chat|SI Конструктор|SI Чат/, `${lang} ${key}`);
	}
});

test("chat off: a stored project keeps its chat keys untouched and a project without a chat gets none", () => {
	const kept = projectOfDoc(chatDoc as never);
	assert.deepEqual(kept.ext, {}, "no module claims the chat keys, so the project has no extension");
	assert.deepEqual(Object.keys(kept.extra ?? {}).sort(), ["messages", "mode", "selectedModelId", "usage"]);
	for (const key of ["messages", "mode", "usage", "selectedModelId"]) assert.equal(key in kept, false, `${key} is not a project field`);
	assert.equal(JSON.stringify(docOfProject(kept)), JSON.stringify(chatDoc), "saved back byte for byte: turning the chat off loses no stored data");
	const plain = projectOfDoc(plainDoc as never);
	assert.equal(plain.extra, undefined);
	const doc = docOfProject(plain);
	assert.equal(JSON.stringify(doc), JSON.stringify(plainDoc));
	for (const key of ["messages", "mode", "usage", "selectedModelId"]) assert.equal(key in doc, false, `${key} is never written for a project made without the chat`);
});

test("boundary: the core imports no module, no module imports another, no message key has two owners", () => {
	assert.deepEqual(boundaryViolations(root), []);
	assert.deepEqual(i18nViolations(root), []);
});

test("boundary rules catch what they are for (fixture tree)", () => {
	const dir = mkdtempSync(join(tmpdir(), "buildy-boundary-"));
	const put = (path: string, text: string) => {
		mkdirSync(dirname(join(dir, path)), { recursive: true });
		writeFileSync(join(dir, path), text);
	};
	const src = "apps/chat-web/src";
	const catalog = (messages: Record<string, string>) => JSON.stringify({ locale: "en", messages });
	put(`${src}/lib/i18n/en.json`, catalog({ "core.a": "A" }));
	put(`${src}/lib/i18n/ru.json`, catalog({ "core.a": "А" }));
	put(`${src}/modules/chat/i18n/en.json`, JSON.stringify({ locale: "en", messages: { "chat.x": "Chat text", "core.a": "dup" }, overrides: { "core.missing": "x" } }));
	put(`${src}/modules/chat/i18n/ru.json`, JSON.stringify({ locale: "ru", messages: { "chat.x": "Чат", "core.a": "дубль" }, overrides: { "core.missing": "x" } }));
	put(`${src}/modules/index.ts`, 'export const load = () => import("./chat");');
	put(`${src}/modules/chat/index.ts`, 'import other from "../other/x";\nimport "$modules/other/y";');
	put(`${src}/modules/other/x.ts`, "export default 1;");
	put(`${src}/app/A.svelte`, '<script>import a from "../modules/chat/index";\nimport b from "$modules/chat";\nimport c from "@buildytech/chat-agent";\nconst k = t("chat.x");</script>');
	put(`${src}/lib/ok.ts`, 'import { x } from "./modules/registry.svelte.ts";');
	const problems = [...boundaryViolations(dir), ...i18nViolations(dir)];
	for (const expected of ["app/A.svelte: core imports a module (../modules/chat/index)", "app/A.svelte: core imports a module ($modules/chat)", "app/A.svelte: core imports the chat agent package (@buildytech/chat-agent)", "modules/chat/index.ts: module chat imports module other (../other/x)", "modules/chat/index.ts: module chat imports module other ($modules/other/y)", "core.a: in the chat catalog and in core", "core.missing: chat overrides a key the core does not have", "app/A.svelte: core code uses the chat key chat.x"]) {
		assert.ok(problems.includes(expected), `${expected}\n${problems.join("\n")}`);
	}
	assert.equal(problems.some((p) => p.startsWith("lib/ok.ts")), false, "the port in lib/modules is not a module");
});
