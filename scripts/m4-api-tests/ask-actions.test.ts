import assert from "node:assert/strict";
import { test } from "node:test";
import { askAnswerActions, askClaimsApplied, askOffersDesign } from "../../apps/chat-web/src/modules/chat/core/ask-actions.ts";

test("a false 'applied' in Russian or English is caught; advice to use Build is not", () => {
	assert.equal(askClaimsApplied("Изменения применены."), true);
	assert.equal(askClaimsApplied("Я применил тему к странице."), true);
	assert.equal(askClaimsApplied("The theme has been applied."), true);
	assert.equal(askClaimsApplied("I've applied the palette you asked for."), true);
	assert.equal(askClaimsApplied("When you want a change, Build makes it. The author applies a proposal."), false);
	assert.equal(askClaimsApplied("Опишите стиль и переключитесь в Design, он применит Brand Skin."), false);
	assert.equal(askClaimsApplied(""), false);
});

test("a style or palette brief offers Apply in Design", () => {
	assert.equal(askOffersDesign("A warm rye palette: #3b2a1a and cream, Source Serif for headings."), true);
	assert.equal(askOffersDesign("Палитра тёплая, шрифт Source Serif, оформление как у пекарни."), true);
	assert.equal(askOffersDesign("The heading on the hero is too long; shorten it."), false);
	const claimed = askAnswerActions("Изменения применены. Палитра и шрифты как у пекарни.");
	assert.deepEqual(claimed, { claimsApplied: true, offersDesign: true });
});
