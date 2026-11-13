/**
 * 1.x -> 2.0 migration of what a browser holds (ADR 0034): a stored page record and a session file with page-spec/v1 pages
 * come out as page-spec/v2, validate against the session schema, and render the same props for every block (preview, code
 * pane and ZIP call renderBlock). The owner's fitness and food sessions are the fixtures.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { healV1Props, organismFor, renderBlock, checkPageDoc } from "../../packages/builder-core/src/index.ts";
import { pageV2Issues, type PageV2 } from "../../packages/page-contract/src/index.ts";
import { sessionFileIssues } from "../../packages/page-contract/src/session.ts";
import { PAGES_KEY, clearPersistError, loadPagesBlob, migrateStoredPageRecord, useStorageForTests } from "../../apps/chat-web/src/lib/browser/persist.ts";
import { parseSessionFile, splitSessionFile } from "../../apps/chat-web/src/lib/browser/session-file.ts";

const fixture = (name: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8"));
const SESSIONS = { fitness: fixture("fitness-session-3933dbf.json"), food: fixture("food-session-3933dbf.json") };

class MemoryStorage {
	map = new Map<string, string>();
	getItem(key: string): string | null {
		return this.map.has(key) ? this.map.get(key)! : null;
	}
	setItem(key: string, value: string): void {
		this.map.set(key, String(value));
	}
	removeItem(key: string): void {
		this.map.delete(key);
	}
}
const store = new MemoryStorage();
useStorageForTests(store);
afterEach(() => {
	store.map.clear();
	clearPersistError();
	useStorageForTests(store);
});

for (const [name, file] of Object.entries(SESSIONS)) {
	test(`${name}: a 1.x session file imports as 2.0; every block renders the props it rendered (fill-ins cleared); the file validates`, () => {
		const parsed = parseSessionFile(JSON.stringify(file));
		assert.ok(parsed.ok, JSON.stringify(!parsed.ok && parsed.issues?.slice(0, 3)));
		if (!parsed.ok) return;
		assert.deepEqual(sessionFileIssues(parsed.file), []);
		const chat = file.sessions[0];
		const record = parsed.file.sessions[0]!.page!;
		for (const slot of ["applied", "candidate", "lastProposed"] as const) {
			const v1 = chat.page[slot];
			const v2 = (record as unknown as Record<string, PageV2 | null>)[slot];
			if (!v1) {
				assert.equal(v2 ?? null, null, slot);
				continue;
			}
			assert.ok(v2, slot);
			assert.deepEqual(pageV2Issues(v2), [], slot);
			assert.ok(checkPageDoc(v2).ok, slot);
			assert.equal(v2.blocks.length, v1.layout.blocks.length, slot);
			v1.layout.blocks.forEach((block: never, index: number) => {
				const was = organismFor(block)!;
				const now = renderBlock(v2.blocks[index]!)!;
				assert.equal(now.item, was.item);
				assert.equal(now.variant, was.variant);
				assert.deepEqual(now.props, healV1Props(was.item, was.props), `${slot} block ${index}`);
			});
		}
		// splitting the file back gives the same v2 record the chat keeps
		const split = splitSessionFile(parsed.file);
		assert.equal(Object.keys(split.pages).length, file.sessions.length);
	});
}

test("a stored 1.x page record migrates once: selected block, revision and pins stay; a v2 record is untouched", () => {
	const chat = SESSIONS.fitness.sessions[0];
	const migrated = migrateStoredPageRecord(chat.page);
	const applied = migrated.applied as unknown as PageV2;
	assert.equal(applied.version, 2);
	assert.equal(migrated.revision, chat.page.revision);
	assert.equal(migrated.selectedBlockId, chat.page.selectedBlockId);
	assert.equal(migrateStoredPageRecord(migrated).applied, migrated.applied, "idempotent: a v2 record is kept as it is");
	// the page blob in the browser's storage: v1 records load as v2
	store.setItem(PAGES_KEY, JSON.stringify({ version: 1, pages: { "session-a": chat.page } }));
	const blob = loadPagesBlob();
	assert.equal((blob.pages["session-a"]!.applied as unknown as PageV2).version, 2);
});

test("food: the migrated page has the owner's 10 blocks, the stats keep their figures, no humanized fill-in is left", () => {
	const parsed = parseSessionFile(JSON.stringify(SESSIONS.food));
	assert.ok(parsed.ok);
	if (!parsed.ok) return;
	const page = parsed.file.sessions[0]!.page!.applied as unknown as PageV2;
	assert.equal(page.blocks.length, 10);
	const stats = renderBlock(page.blocks.find((block) => block.item === "stats-band")!)!.props as { stats: Array<{ value: string }> };
	assert.ok(stats.stats.length >= 3 && stats.stats.every((row) => row.value !== ""));
	assert.doesNotMatch(JSON.stringify(page), /"(?:Value|By line|Role|Company|Handle|Time)"|Closing band|Contact facts are not invented/);
});
