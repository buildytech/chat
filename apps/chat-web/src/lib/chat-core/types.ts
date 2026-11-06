export type ChatRole = "user" | "assistant";

export type ChatMessage = {
	id: string;
	role: ChatRole;
	text: string;
	createdAt: string;
};

export type ChatSession = {
	id: string;
	title: string;
	updatedAt: string;
	messages: ChatMessage[];
};

export type SessionSummary = Pick<ChatSession, "id" | "title" | "updatedAt">;
