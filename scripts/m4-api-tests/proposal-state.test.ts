import assert from "node:assert/strict";
import { test } from "node:test";
import {
	markPendingProposals,
	migrateProposal,
	proposalStatus,
	isPendingProposal
} from "../../apps/chat-web/src/modules/chat/core/proposals.ts";
import type { ChatMessage, ChatProposalState } from "../../apps/chat-web/src/modules/chat/core/types.ts";

function proposal(partial: Partial<ChatProposalState> = {}): ChatProposalState {
	return {
		applied: false,
		status: "pending",
		source: "xai-runtime",
		liveModel: true,
		warnings: [],
		missing: [],
		title: "Harbor",
		screenId: "screen.site/home",
		...partial
	};
}

function message(id: string, state?: ChatProposalState): ChatMessage {
	return {
		id,
		role: "assistant",
		text: "stale Apply it to replace the blank page",
		createdAt: "2026-11-08T00:00:00.000Z",
		proposal: state
	};
}

test("legacy applied boolean migrates without inventing discarded", () => {
	assert.equal(proposalStatus({ applied: true }), "applied");
	assert.equal(proposalStatus({ applied: false }), "pending");
	const migrated = migrateProposal(proposal({ applied: true, status: undefined }));
	assert.equal(migrated.status, "applied");
	assert.equal(migrated.applied, true);
	const pending = migrateProposal(proposal({ applied: false, status: undefined }));
	assert.equal(pending.status, "pending");
	assert.equal(isPendingProposal(pending), true);
});

test("discard and apply only touch the current pending proposal", () => {
	const messages = [
		message("old", proposal({ status: "applied", applied: true })),
		message("live", proposal({ status: "pending", applied: false }))
	];
	const discarded = markPendingProposals(messages, "discarded", "latest");
	assert.equal(discarded[0]?.proposal?.status, "applied");
	assert.equal(discarded[1]?.proposal?.status, "discarded");
	assert.equal(discarded[1]?.proposal?.applied, false);
	assert.equal(isPendingProposal(discarded[1]!.proposal!), false);

	const json = JSON.stringify(discarded);
	const reloaded = (JSON.parse(json) as ChatMessage[]).map((row) =>
		row.proposal ? { ...row, proposal: migrateProposal(row.proposal) } : row
	);
	assert.equal(reloaded[1]?.proposal?.status, "discarded");
	assert.equal(isPendingProposal(reloaded[1]!.proposal!), false);
});

test("a new proposal supersedes earlier pending ones", () => {
	const messages = [message("first", proposal()), message("second", proposal())];
	const next = markPendingProposals(messages, "superseded", "all");
	assert.equal(next[0]?.proposal?.status, "superseded");
	assert.equal(next[1]?.proposal?.status, "superseded");
});
