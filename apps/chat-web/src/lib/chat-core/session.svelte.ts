/**
 * The chat session API: one import point for the chat modules (ADR 0040; before it this file held all of them).
 * chat.svelte (view, mode, selection), turn / send (a turn), proposal-flow (Apply, Discard, host proposals),
 * intake (collections), transfer (session file), gates (write gates).
 */
export { abortInflightRun, applySessionFromUrl, createSession, createdInThisTab, deleteAllSessions, deleteSession, getChatMode, getRuntimeStatus, getSelectedSession, hydrateSessions, listSessions, selectSession, setChatMode } from "./chat.svelte";
export { loadPropsGate } from "./gates";
export { retryLastFailed, sendMessage } from "./send";
export { applyAskProposal, applyProposal, applyVariantFromAsk, discardProposal, startEmptyPageInChat, startPageFromScreen, type AskApplyResult } from "./proposal-flow";
export { openCollectionFile, openCollectionParam, type CollectionIntake } from "./intake";
export { exportSessions, importSessions, type ImportResult } from "./transfer";
export { getChatCollection } from "./collection-view";
export { removeCollectionItem } from "../project/store.svelte.ts";
