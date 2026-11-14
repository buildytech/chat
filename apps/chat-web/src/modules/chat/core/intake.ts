/** Open a Stock collection (link or file) as a new Build chat: the collection is a project record, the chat is its first message surface. */
import { decodeCollectionParam, parseCollection, type CollectionParse } from "@buildytech/page-contract/collection";
import { setPendingSkin } from "../../../lib/project/store.svelte.ts";
import { collectionErrorText, collectionScreenId, chatCollectionFrom } from "./collection";
import { commitSession, createSession, run } from "./chat.svelte.ts";
import { nowIso } from "./turn";
import type { ChatSession } from "./types";
import { hydrateSessionContext } from "../browser/onboarding.svelte.ts";

export type CollectionIntake = { ok: true; sessionId: string; items: number; missing: number } | { ok: false; code: string; message: string };

/**
 * Open a checked collection in a new Build chat (contract docs/collection-intake.md section 3): titled with the
 * collection, its skin, its first Stock screen, the present items as chips and the missing ones in the note.
 */
async function openCollection(parsed: CollectionParse): Promise<CollectionIntake> {
	if (!parsed.ok) {
		const message = collectionErrorText(parsed.code, parsed.issues[0]?.path);
		run.lastError = message;
		return { ok: false, code: parsed.code, message };
	}
	const collection = chatCollectionFrom(parsed.doc, nowIso());
	run.pendingMode = "build";
	setPendingSkin(parsed.doc.skin ?? null);
	const created = await createSession();
	const screenId = collectionScreenId(collection);
	const session: ChatSession = { ...created, title: collection.title.slice(0, 120), mode: "build", collection, ...(screenId ? { screenId } : {}) };
	commitSession(session);
	hydrateSessionContext({ scenarioId: null, screenId });
	run.lastError = null;
	return { ok: true, sessionId: session.id, items: collection.items.length, missing: collection.missing?.length ?? 0 };
}

/** `?collection=<base64url>` of an Open in BuildY link (read once by the caller, then removed from the URL). */
export function openCollectionParam(payload: string): Promise<CollectionIntake> {
	return openCollection(decodeCollectionParam(payload));
}

/** A `<title>.buildy-collection.json` file (Settings import, `buildy.import(json)`): same checks as the link. */
export function openCollectionFile(json: unknown): Promise<CollectionIntake> {
	return openCollection(parseCollection(json));
}
