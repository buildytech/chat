/** ChatCore send: one user message, one agent turn, the reply committed to the chat. Live Grok uses `/runtime`. */
import { agentToolNames, startAttempt, endAttempt, usageOfAttempts } from "@buildytech/chat-agent";
import { t } from "../../../lib/i18n/dictionary";
import { getSelectedModelId } from "../browser/models.svelte.ts";
import { retryMessage } from "./retry-message.ts";
import { chatModeOf } from "./modes";
import { abortInflight, commitSession, createSession, currentEpoch, getSelectedSession, getSession, canRunSession, run, startRun } from "./chat.svelte.ts";
import { loadPropsGate } from "../../../lib/gates";
import { markPendingProposals } from "./proposals";
import { localizedRunError, nowIso, replyMessage, runTurn, runtimeNoteFor, sessionUsageFrom, uid } from "./turn";
import type { ChatMessage, ChatSession } from "./types";

/** The session with the user's message appended (a new chat takes its title from the first line). */
function withUserMessage(session: ChatSession, trimmed: string, mode: ChatMessage["mode"]): ChatSession {
	const userMsg: ChatMessage = {
		id: uid("msg"),
		role: "user",
		text: trimmed,
		createdAt: nowIso(),
		selectedModelId: getSelectedModelId(),
		mode
	};
	const untitled = session.title === t("thread.untitled") || session.title === "New chat";
	return {
		...session,
		title: untitled ? trimmed.slice(0, 48) : session.title,
		updatedAt: nowIso(),
		scenarioId: session.scenarioId ?? null,
		screenId: session.screenId ?? null,
		messages: [...session.messages, userMsg]
	};
}

/** The session after a finished turn; records what the runtime can do and the error, if any. */
function finishedSession(pending: ChatSession, out: Awaited<ReturnType<typeof runTurn>>, mode: NonNullable<ChatMessage["mode"]>): ChatSession {
	const { result, status, modelId, live, usage } = out;
	run.capabilities = {
		runtime: status.runtime || "xai-grok",
		mode: live ? "xai-runtime" : status.ready ? status.code || "xai_runtime_ready" : "unavailable",
		liveModel: Boolean(status.ready),
		live: { requested: true, provider: "xai", model: modelId },
		tools: agentToolNames(mode),
		note: runtimeNoteFor(status)
	};
	run.lastError = result.ok ? null : localizedRunError(result.code, result.message, modelId, "issues" in result ? result.issues : undefined);
	const reply = replyMessage(out);
	// A new proposal supersedes the pending ones of its own kind: an Ask proposal the Ask ones, a Build proposal the Build ones.
	const prior = reply.proposal ? markPendingProposals(pending.messages, "superseded", "all", (m) => (m.mode === "ask") === (reply.mode === "ask")) : pending.messages;
	return { ...pending, ...(out.runTrace ? { runTraces: { ...pending.runTraces, [out.runTrace.runId]: out.runTrace } } : {}), updatedAt: nowIso(), selectedModelId: modelId, messages: [...prior, reply], usage: sessionUsageFrom(pending, usage) };
}

async function sendMessageText(text: string, retryOf?: string): Promise<ChatSession> {
 const trimmed = text.trim();
 if (!trimmed) return getSelectedSession() ?? createSession();
 const session = getSelectedSession() ?? (await createSession());
 if (!canRunSession(session.id)) { run.lastError = t("runtime.sendFailed"); return session; }
 const original = retryMessage(session, retryOf);
 if (retryOf && !original) return session;
 const requestText = original?.text ?? trimmed;
 const mode = original?.mode ?? chatModeOf(session, run.pendingMode);
 abortInflight();
 const pending = original ? { ...session } : withUserMessage(session, trimmed, mode);
 const attemptId = uid("attempt");
 const startedAt = nowIso();
 const attempts = Object.fromEntries(Object.entries(pending.runAttempts ?? {}).map(([id, attempt]) => [id, attempt.status === "running" ? endAttempt(attempt, "superseded", startedAt) : attempt]));
 attempts[attemptId] = { ...startAttempt(attemptId, original?.id ?? pending.messages.at(-1)!.id, getSelectedModelId(), startedAt), ...(retryOf && attempts[retryOf] ? { retryOf } : {}) };
 run.lastRequestId = attemptId;
 run.lastFailedText = null;
 pending.runAttempts = attempts;
 pending.usage = usageOfAttempts(attempts, pending.messages);
 if (!commitSession(pending)) {
  pending.runAttempts[attemptId] = endAttempt(attempts[attemptId]!, "error", nowIso(), { code: "storage_unavailable" });
  pending.usage = usageOfAttempts(pending.runAttempts, pending.messages);
  commitSession(pending);
  return pending;
 }
 const ac = new AbortController();
 const release = startRun(ac);
 const token = currentEpoch();
 try {
  await loadPropsGate();
  const out = await runTurn(requestText, mode, ac.signal, { modelId: attempts[attemptId]!.modelId, userMessageId: attempts[attemptId]!.userMessageId });
  const current = getSession(pending.id);
  if (!current) return getSelectedSession() ?? pending;
  const attempt = current.runAttempts?.[attemptId];
  if (!attempt) return current;
  const active = token === currentEpoch() && attempt.status === "running" && !ac.signal.aborted;
  const done = active ? finishedSession(current, out, mode) : current;
  const status = attempt.status !== "running" ? attempt.status : !active || (!out.result.ok && out.result.code === "aborted") ? "aborted" : out.result.ok ? "completed" : "error";
  if (active) run.lastFailedText = out.result.ok ? null : requestText;
  const trace = out.runTrace;
  const runAttempts = { ...done.runAttempts, [attemptId]: endAttempt(attempt, status, nowIso(), { usage: out.usage, runId: out.runId, ...(active ? { assistantMessageId: done.messages.at(-1)?.id } : {}), traceState: trace ? "received" : "not_received", ...(trace?.scenario ? { scenario: trace.scenario } : {}), ...(trace?.provider && trace.provider !== "unknown" ? { provider: trace.provider } : {}), ...(!out.result.ok ? { code: out.result.code } : {}) }) };
  const final = { ...done, runAttempts, ...(trace ? { runTraces: { ...done.runTraces, [trace.runId]: trace } } : {}), usage: usageOfAttempts(runAttempts, done.messages) };
  commitSession(final);
  return final;
 } catch (error) {
  const current = getSession(pending.id);
  if (!current) return getSelectedSession() ?? pending;
  const attempt = current.runAttempts?.[attemptId];
  if (!attempt) return current;
  const aborted = ac.signal.aborted || (error instanceof Error && error.name === "AbortError");
  const status = attempt.status !== "running" ? attempt.status : aborted ? "aborted" : "error";
  const runAttempts = { ...current.runAttempts, [attemptId]: endAttempt(attempt, status, nowIso(), { code: aborted ? "aborted" : "host_error" }) };
  const final = { ...current, runAttempts, usage: usageOfAttempts(runAttempts, current.messages) };
  commitSession(final);
  if (token === currentEpoch() && attempt.status === "running") { run.lastError = t(aborted ? "runtime.cancelled" : "runtime.sendFailed"); run.lastFailedText = requestText; }
  return final;
 } finally { release(); }
}

/** ChatCore send. Ordinary text never auto-saves a page. Live Grok uses `/runtime`. */
export async function sendMessage(text: string, _opts?: { requestId?: string; retry?: boolean }): Promise<ChatSession> {
	return sendMessageText(text, _opts?.retry ? _opts.requestId : undefined);
}

export async function retryLastFailed(): Promise<ChatSession | null> {
	if (!run.lastFailedText || !run.lastRequestId) return null;
	return sendMessage(run.lastFailedText, { retry: true, requestId: run.lastRequestId });
}
