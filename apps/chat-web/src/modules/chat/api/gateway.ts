
export type ServerMessage = {
	id: string;
	sessionId: string;
	seq: number;
	role: "user" | "assistant" | "tool" | "system";
	content: string;
	runId?: string;
	createdAt: string;
};

export type ServerCapabilities = {
	runtime: string;
	mode: string;
	liveModel: boolean;
	live?: { requested?: boolean; provider?: string; model?: string };
	tools: string[];
	features?: Record<string, unknown>;
	note?: string;
};

export function newRequestId(): string {
	return `req-${crypto.randomUUID()}`;
}
