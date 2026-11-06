import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = (file: string) => readFileSync(new URL(`../../apps/chat-web/src/lib/screens/${file}.svelte`, import.meta.url), "utf8");

test("WP desktop panes never combine global hidden with responsive flex", () => {
 for (const name of ["Workspace", "ChatColumn", "ChatDrawer"]) {
  const s = source(name);
  assert.doesNotMatch(s, /: "hidden"/);
  assert.match(s, /max-lg:hidden/);
 }
});

test("Composer cannot pretend to switch models; server capability is displayed", () => {
 const s = source("ChatComposer");
 assert.doesNotMatch(s, /pickModel|menuitemradio|ModelId/);
 assert.match(s, /capabilities\?\.live\?\.model/);
 assert.match(s, /composer.modelServerConfigured/);
 assert.match(s, /onSend\(text\)/);
});

test("Preview and Code consume the same page and saved revision store", () => {
 for (const name of ["PreviewPane", "CodePane"]) {
  const s = source(name);
  assert.match(s, /getCurrentPage\(\)/);
  assert.match(s, /getPageRevision\(\)/);
  assert.match(s, /data-page-revision/);
 }
});
