export type ChatRole = "user" | "assistant";

export type ChatArtifact = {
	kind: "saved_page";
	pageId: string;
	slug: string;
	revision: number;
	files: string[];
};

export type ChatMessage = {
	id: string;
	role: ChatRole;
	text: string;
	createdAt: string;
	artifacts?: ChatArtifact[];
};

export type ChatSession = {
	id: string;
	title: string;
	updatedAt: string;
	messages: ChatMessage[];
	pageId?: string;
	pageBound?: boolean;
	pageRevision?: number | null;
};

export type SessionSummary = Pick<ChatSession, "id" | "title" | "updatedAt">;
