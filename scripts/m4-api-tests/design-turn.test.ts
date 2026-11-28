/**
 * Design turn loop (ADR 0070): a fake completer, no provider keys. On a rejected proposal the host sends issues back
 * for a retry; after a valid reply it returns the proposal and writes nothing itself.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { importThemeConfig } from "../../apps/chat-web/src/lib/theme/custom-skin.ts";
import { DESIGN_MAX_ATTEMPTS, designSystemPrompt, runDesignTurn, type DesignChatMessage } from "../../apps/chat-web/src/lib/theme/design-turn.ts";

const STOCK = readFileSync(new URL("./fixtures/stock-theme-export.json", import.meta.url), "utf8");

function theme() {
	const r = importThemeConfig(STOCK);
	assert.ok(r.ok);
	return r.config;
}

function proposal(over: Record<string, unknown> = {}) {
	return {
		brief: {
			name: "Rye & Coal",
			thesis: {
				summary: "A neighbourhood bakery that treats fire and grain as craft.",
				positioning: "Serious bread for everyday tables, not a cafe lifestyle brand.",
				antiPersonality: ["precious", "industrial-bland"]
			},
			grammar: {
				shapeLanguage: { core: "soft rectangles" },
				imageTreatment: { avoid: ["stock smiles"] }
			}
		},
		theme: theme(),
		...over
	};
}

test("the Design system prompt names the font, radius and skin allowlists and does not mention keys", () => {
	const prompt = designSystemPrompt();
	assert.match(prompt, /THEME_FONT_IDS|font/i);
	assert.match(prompt, /Radius/);
	assert.match(prompt, /magazine-theme/);
	assert.doesNotMatch(prompt, /XAI_API_KEY|api[_-]?key|Bearer /i);
});

test("runDesignTurn retries after issues and accepts a valid proposal on the second attempt", async () => {
	const calls: DesignChatMessage[][] = [];
	const result = await runDesignTurn("A bakery brand, warm and exact.", async (messages) => {
		calls.push([...messages]);
		if (calls.length === 1) return JSON.stringify(proposal({ brief: { name: "Rye", thesis: { summary: "Only a summary." } } }));
		return JSON.stringify(proposal());
	});
	assert.equal(calls.length, 2);
	assert.ok(result.ok, JSON.stringify(result));
	assert.equal(result.attempts, 2);
	assert.equal(result.proposal.brief.name, "Rye & Coal");
	assert.match(calls[1]!.at(-1)!.content, /missing-positioning|antiPersonality|issue/i);
	assert.equal(calls[0]![0]!.role, "system");
});

test("runDesignTurn stops after DESIGN_MAX_ATTEMPTS and yields issues, not a proposal", async () => {
	const result = await runDesignTurn("A bakery brand.", async () => JSON.stringify({ brief: { name: "Nope" }, theme: { format: "other", version: 2 } }));
	assert.equal(result.ok, false);
	if (result.ok) return;
	assert.equal(result.attempts, DESIGN_MAX_ATTEMPTS);
	assert.ok(result.issues.length);
	assert.equal("proposal" in result, false);
	assert.equal(result.code, "invalid_proposal");
});

test("an empty request does not call the completer", async () => {
	let called = 0;
	const result = await runDesignTurn("   ", async () => {
		called += 1;
		return "{}";
	});
	assert.equal(called, 0);
	assert.equal(result.ok, false);
	if (!result.ok) assert.equal(result.attempts, 0);
});

test("a thrown host error keeps its code and message (not a generic design_failed)", async () => {
	const result = await runDesignTurn("A bakery brand.", async () => {
		throw Object.assign(new Error("This key does not list that chat model. No chat request was sent."), { code: "model_not_listed" });
	});
	assert.equal(result.ok, false);
	if (result.ok) return;
	assert.equal(result.attempts, 1);
	assert.equal(result.code, "model_not_listed");
	assert.match(result.message ?? "", /does not list that chat model/);
});
