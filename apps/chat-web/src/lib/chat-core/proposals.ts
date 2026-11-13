import type { ChatMessage, ChatProposalState, ChatSession, ProposalStatus } from "./types";

export type { ProposalStatus };

const STATUSES: readonly ProposalStatus[] = ["pending", "applied", "discarded", "superseded"];

export function proposalStatus(proposal: Pick<ChatProposalState, "applied" | "status">): ProposalStatus {
	if (proposal.status && STATUSES.includes(proposal.status)) return proposal.status;
	return proposal.applied ? "applied" : "pending";
}

/** Legacy blobs only had applied:boolean. Neutral: applied true → applied, else pending. */
export function migrateProposal(proposal: ChatProposalState): ChatProposalState {
	const status = proposalStatus(proposal);
	return { ...proposal, status, applied: status === "applied" };
}

export function migrateSessionProposals(session: ChatSession): ChatSession {
	return {
		...session,
		messages: session.messages.map((message) =>
			message.proposal ? { ...message, proposal: migrateProposal(message.proposal) } : message
		)
	};
}

export function isPendingProposal(proposal: Pick<ChatProposalState, "applied" | "status">): boolean {
	return proposalStatus(proposal) === "pending";
}

export function withProposalStatus(proposal: ChatProposalState, status: ProposalStatus): ChatProposalState {
	return { ...proposal, status, applied: status === "applied" };
}

export function markPendingProposals(
	messages: ChatMessage[],
	status: Exclude<ProposalStatus, "pending">,
	mode: "latest" | "all" = "all",
	only: (message: ChatMessage) => boolean = () => true
): ChatMessage[] {
	if (mode === "latest") {
		let done = false;
		return [...messages].reverse().map((message) => {
			if (done || !message.proposal || !isPendingProposal(message.proposal) || !only(message)) return message;
			done = true;
			return { ...message, proposal: withProposalStatus(message.proposal, status) };
		}).reverse();
	}
	return messages.map((message) =>
		message.proposal && isPendingProposal(message.proposal) && only(message)
			? { ...message, proposal: withProposalStatus(message.proposal, status) }
			: message
	);
}
