/**
 * The chat view of a project (pure: no storage, no runes). The project keeps the chat as `ext.chat` (messages, mode,
 * selected model, usage); the chat code works with a `ChatSession` that has `messages` always. `viewOf` and
 * `projectOfView` are inverse for the chat's fields, and a project with no chat stays a project with no chat until the
 * chat writes something.
 */
import type { AgentMode } from "@buildytech/chat-agent";
import type { Project } from "../../../lib/project/types.ts";
import type { ChatMessage, ChatSession } from "./types.ts";

/** The flat session keys of documents before session 1.10.0 that are the chat's; read into `ext.chat`, never written. */
export const CHAT_LEGACY_KEYS = ["mode", "selectedModelId", "usage", "messages"] as const;
export type ChatPayload = { messages?: ChatMessage[]; mode?: AgentMode; selectedModelId?: string; usage?: ChatSession["usage"] };
export const chatOf = (project: Project): ChatPayload | undefined => project.ext.chat as ChatPayload | undefined;
const views = new WeakMap<Project, ChatSession>();


/** A project as a chat session: the project fields with `messages` (empty without a chat) and the chat's own fields. Memoized per project object. */
export function viewOf(project: Project): ChatSession {
	let view = views.get(project);
	if (view) return view;
	const { ext: _ext, ...fields } = project;
	const chat = chatOf(project);
	view = { ...fields, messages: chat?.messages ?? [], ...(chat?.mode ? { mode: chat.mode } : {}), ...(chat?.selectedModelId ? { selectedModelId: chat.selectedModelId } : {}), ...(chat?.usage ? { usage: chat.usage } : {}) } as ChatSession;
	views.set(project, view);
	return view;
}

/** The project a chat view stands for: its project fields, and `ext.chat` when the view or the project before it has a chat. */
export function projectOfView(view: ChatSession, prev: Project | null): Project {
	const { messages, mode, selectedModelId, usage, projectId, ...fields } = view;
	const kept = { ...(prev?.ext ?? {}) };
	delete kept.chat;
	const hasChat = Boolean(prev?.ext.chat) || messages.length > 0 || mode !== undefined || selectedModelId !== undefined || usage !== undefined;
	const chat = { ...(mode ? { mode } : {}), ...(selectedModelId ? { selectedModelId } : {}), ...(usage ? { usage } : {}), messages };
	return { ...fields, projectId: prev?.projectId ?? projectId ?? view.id, ext: hasChat ? { ...kept, chat } : kept } as Project;
}
