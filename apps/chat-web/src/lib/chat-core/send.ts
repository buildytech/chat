/** ChatCore send: one user message, one agent turn, the reply committed to the chat. Live Grok uses `/runtime`. */
import { agentToolNames, unknownUsage } from "@buildytech/chat-agent";
import { t } from "../i18n/dictionary";
import { getSelectedModelId } from "../browser/models.svelte";
import { chatModeOf } from "./modes";
import { bumpEpoch, abortInflight, commitSession, createSession, currentEpoch, getSelectedSession, run, startRun } from "./chat.svelte";
import { loadPropsGate } from "./gates";
import { markPendingProposals } from "./proposals";
import { localizedRunError, nowIso, replyMessage, runRecord, runTurn, runtimeNoteFor, sessionUsageFrom, uid } from "./turn";
import type { ChatMessage, ChatSession } from "./types";

async function sendMessageMock(text: string): Promise<ChatSession> {
	const trimmed = text.trim();
	if (!trimmed) {
		const current = getSelectedSession();
		if (current) return current;
		return createSession();
	}
	let session = getSelectedSession();
	if (!session) {
		// A new chat starts blank. Screens and blocks are added from the Blocks tab, not picked here.
		session = await createSession();
	}
	const mode = chatModeOf(session, run.pendingMode);
	const userMsg: ChatMessage = {
		id: uid("msg"),
		role: "user",
		text: trimmed,
		createdAt: nowIso(),
		selectedModelId: getSelectedModelId(),
		mode
	};
	const untitled = session.title === t("thread.untitled") || session.title === "New chat";
	const nextTitle = untitled ? trimmed.slice(0, 48) : session.title;
	const pending: ChatSession = {
		...session,
		title: nextTitle,
		updatedAt: nowIso(),
		scenarioId: session.scenarioId ?? null,
		screenId: session.screenId ?? null,
		messages: [...session.messages, userMsg]
	};
	commitSession(pending);
	abortInflight();
	const ac = new AbortController();
	const release = startRun(ac);
	const token = currentEpoch();
	try {
		await loadPropsGate();
		const out = await runTurn(trimmed, mode, ac.signal);
		if (token !== currentEpoch()) return getSelectedSession() ?? pending;
		const { result, status, modelId, live, usage } = out;
		run.capabilities = {
			runtime: status.runtime || "xai-grok",
			mode: live ? "xai-runtime" : status.ready ? status.code || "xai_runtime_ready" : "unavailable",
			liveModel: Boolean(status.ready),
			live: { requested: true, provider: "xai", model: modelId },
			tools: agentToolNames(mode),
			note: runtimeNoteFor(status)
		};
		run.lastError = result.ok ? null : localizedRunError(result.code, result.message, modelId);
		const reply = replyMessage(out);
		// A new proposal supersedes the pending ones of its own kind: an Ask proposal the Ask ones, a Build proposal the Build ones.
		const prior = reply.proposal ? markPendingProposals(pending.messages, "superseded", "all", (m) => (m.mode === "ask") === (reply.mode === "ask")) : pending.messages;
		const done: ChatSession = {
			...pending,
			updatedAt: nowIso(),
			selectedModelId: modelId,
			messages: [...prior, reply],
			usage: sessionUsageFrom(pending, usage)
		};
		commitSession(done);
		
		return done;
	} catch (err) {
		if ((err as Error).name === "AbortError") {
			run.lastError = t("runtime.cancelled");
			const cancelled = unknownUsage("cancelled", 0);
			const reply: ChatMessage = {
				id: uid("msg"),
				role: "assistant",
				text: t("runtime.cancelled"),
				createdAt: nowIso(),
				run: runRecord({ modelId: getSelectedModelId(), live: false, usage: cancelled })
			};
			const done: ChatSession = {
				...pending,
				updatedAt: nowIso(),
				messages: [...pending.messages, reply],
				usage: sessionUsageFrom(pending, cancelled)
			};
			commitSession(done);
			return done;
		}
		run.lastError = t("runtime.sendFailed");
		throw err;
	} finally {
		release();
	}
}

/** ChatCore send. Ordinary text never auto-saves a page. Live Grok uses `/runtime`. */
export async function sendMessage(text: string, _opts?: { requestId?: string; retry?: boolean }): Promise<ChatSession> {
	return sendMessageMock(text);
}

export async function retryLastFailed(): Promise<ChatSession | null> {
	if (!run.lastFailedText || !run.lastRequestId) return null;
	return sendMessage(run.lastFailedText, { retry: true, requestId: run.lastRequestId });
}
