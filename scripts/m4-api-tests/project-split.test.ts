/**
 * ADR 0040: the session is a project (page, skin, history) plus `ext.chat` (messages, mode, model, usage).
 * Pure parts only (doc, transitions, chat view, normalizer) and the structure rules that keep the split from growing back.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { sessionDefIssues } from "@buildytech/page-contract/session";
import { docOfProject, projectOfDoc } from "../../apps/chat-web/src/lib/project/doc.ts";
import { bySavedAt, draftPageId, newProject, withApplied, withExt, withSkin } from "../../apps/chat-web/src/lib/project/transitions.ts";
import { projectOfView, viewOf } from "../../apps/chat-web/src/modules/chat/core/view.ts";

const NOW = "2026-11-10T12:00:00.000Z";
const lib = (path: string) => fileURLToPath(new URL(`../../apps/chat-web/src/lib/${path}`, import.meta.url));
const chatCore = (path: string) => fileURLToPath(new URL(`../../apps/chat-web/src/modules/chat/core/${path}`, import.meta.url));
/** A buildy:v1 document: the chat keys flat at the top, the Stock scenario and screen. buildy:v2 does not read it. */
const flatDoc = {
	id: "session-a",
	title: "Coffee",
	createdAt: NOW,
	updatedAt: NOW,
	mode: "build",
	scenarioId: null,
	screenId: "landing",
	selectedModelId: "grok-4",
	pageId: "page-a",
	pageBound: true,
	pageRevision: 2,
	skin: "warm",
	usage: { runs: 1 },
	messages: [{ id: "m1", role: "user", text: "hi", createdAt: NOW }],
	history: [{ revision: 1, at: NOW, cause: "apply" }]
};
/** The project as the app writes it (buildy:v2): the chat under `ext.chat`. */
const legacyDoc = {
	id: "session-a",
	title: "Coffee",
	createdAt: NOW,
	updatedAt: NOW,
	pageId: "page-a",
	pageBound: true,
	pageRevision: 2,
	skin: "warm",
	history: [{ revision: 1, at: NOW, cause: "apply" }],
	ext: { chat: { mode: "build", selectedModelId: "grok-4", usage: { runs: 1 }, messages: [{ id: "m1", role: "user", text: "hi", createdAt: NOW }] } }
};
const noChatDoc = { id: "session-b", title: "No chat", updatedAt: NOW, pageId: "page-b", pageRevision: 1, skin: "dark" };
const otherProjectDoc = { id: "session-c", projectId: "project-x", title: "Moved", updatedAt: NOW, ext: { chat: { messages: [] } } };

test("doc: a stored document is a fixed point of project -> doc, byte for byte (legacy, no chat, projectId != id)", () => {
	for (const doc of [legacyDoc, noChatDoc, otherProjectDoc]) {
		assert.equal(JSON.stringify(docOfProject(projectOfDoc(doc as never))), JSON.stringify(doc));
	}
	assert.deepEqual(sessionDefIssues(noChatDoc, "session"), []);
	const withChat = { id: "session-d", title: "Chat", updatedAt: NOW, ext: { chat: legacyDoc.ext.chat } };
	for (const doc of [withChat, otherProjectDoc, legacyDoc]) assert.deepEqual(sessionDefIssues(doc, "session"), [], "ext.chat is schema-valid");
});

test("doc: a buildy:v1 document (flat chat keys, scenario, screen) is not read into ext.chat and fails the session schema", () => {
	const project = projectOfDoc(flatDoc as never);
	assert.deepEqual(project.ext, {}, "no legacy keys are read");
	assert.deepEqual(Object.keys(project.extra ?? {}).sort(), ["messages", "mode", "scenarioId", "screenId", "selectedModelId", "usage"]);
	assert.notDeepEqual(sessionDefIssues(flatDoc, "session"), [], "persist quarantines it at load");
});

test("doc: the project holds no chat field; a document with no messages has no ext.chat and gets none back", () => {
	const project = projectOfDoc(noChatDoc as never);
	assert.deepEqual(project.ext, {});
	assert.equal("messages" in docOfProject(project), false);
	const legacy = projectOfDoc(legacyDoc as never);
	assert.deepEqual(Object.keys(legacy.ext), ["chat"]);
	for (const key of ["messages", "mode", "usage", "selectedModelId"]) assert.equal(key in legacy, false, `${key} is the chat's, not the project's`);
	assert.equal(projectOfDoc(otherProjectDoc as never).projectId, "project-x");
	assert.equal(projectOfDoc(noChatDoc as never).projectId, "session-b");
});

test("chat view: a project with no chat shows no messages and stays without a chat until the chat writes", () => {
	const project = projectOfDoc(noChatDoc as never);
	const view = viewOf(project);
	assert.deepEqual(view.messages, []);
	assert.equal(viewOf(project), view, "memoized per project object");
	assert.deepEqual(projectOfView(view, project).ext, {}, "reading the view does not invent a chat");
	const written = projectOfView({ ...view, messages: [{ id: "m", role: "user", text: "x", createdAt: NOW }] }, project);
	assert.equal(written.ext.chat?.messages instanceof Array, true);
	assert.equal(written.projectId, "session-b");
});

test("chat view: project -> view -> project keeps the chat, the page fields and other extensions", () => {
	const base = withExt(projectOfDoc(legacyDoc as never), "lab", { note: "kept" });
	const back = projectOfView(viewOf(base), base);
	assert.deepEqual(docOfProject(back), { ...legacyDoc, ext: { ...legacyDoc.ext, lab: { note: "kept" } } });
	assert.deepEqual(back.ext.lab, { note: "kept" });
	const moved = projectOfDoc(otherProjectDoc as never);
	assert.equal(projectOfView(viewOf(moved), moved).projectId, "project-x", "the page key is the project's, not the view's");
});

test("transitions: pure, each returns a new project and leaves the old one alone", () => {
	const project = newProject({ id: "session-n", title: "N", now: NOW, skin: "warm" });
	assert.deepEqual(project, { id: "session-n", projectId: "session-n", title: "N", updatedAt: NOW, skin: "warm", ext: {} });
	assert.equal("skin" in withSkin(project, null), false);
	assert.equal(withSkin(project, "warm"), project);
	assert.equal(withSkin(project, "dark").skin, "dark");
	const applied = withApplied(project, { pageId: "page-n", revision: 1, now: "2026-11-11T00:00:00.000Z" });
	assert.equal(applied.pageRevision, 1);
	assert.equal(project.pageRevision, undefined);
	assert.equal(withExt(withExt(project, "x", { a: 1 }), "x", null).ext.x, undefined);
	assert.equal(draftPageId({ projectId: "session-123" }), "page-123");
	assert.equal(draftPageId({ projectId: "project-123" }), "page-123");
	assert.equal(draftPageId(null), "page-draft");
	assert.ok([applied, project].sort(bySavedAt)[0] === applied, "newest first");
});

const sources = (dir: string) => {
	const path = dir === "chat-core" ? chatCore : lib;
	return readdirSync(path(dir === "chat-core" ? "" : dir)).filter((f) => /\.ts$/.test(f)).map((f) => ({ dir, f, text: readFileSync(path(dir === "chat-core" ? f : `${dir}/${f}`), "utf8") }));
};

test("structure: the project module imports no chat code", () => {
	for (const { f, text } of sources("project")) {
		assert.doesNotMatch(text, /from\s+["'][^"']*chat-core/, `project/${f} imports chat-core`);
		assert.doesNotMatch(text, /from\s+["'][^"']*\/(proposals|conversation|xai-client)/, `project/${f} imports chat code`);
	}
});

test("structure: no file of the chat or project modules grows past 300 lines; session.svelte.ts stays a facade", () => {
	for (const { dir, f, text } of [...sources("chat-core"), ...sources("project")]) {
		assert.ok(text.split("\n").length <= 300, `${dir}/${f} is ${text.split("\n").length} lines`);
	}
	const facade = readFileSync(chatCore("session.svelte.ts"), "utf8");
	assert.ok(facade.split("\n").length < 40);
	assert.doesNotMatch(facade, /\$state|function /);
});

test("structure: the page store is keyed by project, not by chat session (A-02)", () => {
	const all = [...sources("page-store"), ...sources("browser"), ...sources("inspector")].map((s) => s.text).join("\n");
	assert.doesNotMatch(all, /bindPageSession|getBoundPageSessionId|readSessionPages|writeSessionPages|deleteSessionPages|boundSessionId/);
});
