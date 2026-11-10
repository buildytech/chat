/**
 * Stock collection of a chat (session 1.3.0 `collection`; ui8kit/contract docs/collection-intake.md): the items of a
 * buildy-collection:v1 document split against the pinned catalog snapshot. Present items bound Build (sent with
 * every Build turn); missing items are named in one note, never replaced. Pure: no storage, no DOM.
 */
import { snapshotDigest, splitCollection } from "@buildytech/builder-core";
import type { CollectionDoc, CollectionItem } from "@buildytech/page-contract/collection";
import { t } from "../i18n/dictionary";

export type ChatCollection = {
	id: string;
	title: string;
	importedAt?: string;
	assetsDigest?: string;
	items: CollectionItem[];
	missing?: CollectionItem[];
};

/** The chat record of a checked collection document: present items in collection order, missing ones kept apart. */
export function chatCollectionFrom(doc: CollectionDoc, importedAt: string): ChatCollection {
	const { present, missing } = splitCollection(doc.items);
	return {
		id: doc.id,
		title: doc.title,
		importedAt,
		assetsDigest: doc.pins.stock.assetsDigest,
		items: present,
		...(missing.length ? { missing } : {})
	};
}

/** First Stock screen of the collection the snapshot has (the chat's screen), else null. */
export function collectionScreenId(collection: ChatCollection): string | null {
	return collection.items.find((item) => item.kind === "screen")?.id ?? null;
}

/** Name of an item for chips and notes: its title, else its asset id. */
export function collectionItemName(item: CollectionItem): string {
	if (item.title) return item.title;
	return item.kind === "block" && item.variant ? `${item.id}/${item.variant}` : item.id;
}

/** Second line of a chip: kind and, for blocks, the variant (or any variant). */
export function collectionItemDetail(item: CollectionItem): string {
	if (item.kind === "screen") return t("collection.kind.screen");
	return `${t("collection.kind.block")} \u00b7 ${item.variant ?? t("collection.anyVariant")}`;
}

/** The one note under the chips: skipped items (and another Stock version), or that nothing was found. */
export function collectionNote(collection: ChatCollection): string {
	const missing = collection.missing ?? [];
	const parts: string[] = [];
	if (missing.length && !collection.items.length) parts.push(t("collection.allMissing"));
	else if (missing.length) {
		parts.push(t("collection.missing").replace("{count}", String(missing.length)).replace("{list}", missing.map(collectionItemName).join(", ")));
	}
	if (missing.length && collection.assetsDigest && collection.assetsDigest !== snapshotDigest()) parts.push(t("collection.otherVersion"));
	return parts.join(" ");
}

/** What a Build turn sends (the runtime re-checks every item against its own snapshot). */
export function collectionRequest(collection: ChatCollection | null | undefined): { id: string; title: string; items: CollectionItem[] } | null {
	if (!collection || !collection.items.length) return null;
	return { id: collection.id, title: collection.title, items: collection.items };
}

/** The chat collection without one item (a removed chip); the item is not added to `missing`. */
export function withoutItem(collection: ChatCollection, index: number): ChatCollection {
	return { ...collection, items: collection.items.filter((_, i) => i !== index) };
}

/** Readable reason of a failed intake: the code and the first schema path. */
export function collectionErrorText(code: string, path: string | undefined): string {
	return t("collection.error").replace("{code}", code).replace("{path}", path ?? "$");
}
