/**
 * Stock collection of a project (session 1.3.0 `collection`; ui8kit/contract docs/collection-intake.md): the items of a
 * buildy-collection:v1 document split against the pinned catalog snapshot. Present items bound Build (the chat sends them
 * with every Build turn); missing items are kept apart and named in one note, never replaced. Pure: no storage, no DOM,
 * no chat.
 */
import { splitCollection } from "@buildytech/builder-core";
import type { CollectionDoc, CollectionItem } from "@buildytech/page-contract/collection";

export type ProjectCollection = {
	id: string;
	title: string;
	importedAt?: string;
	assetsDigest?: string;
	items: CollectionItem[];
	missing?: CollectionItem[];
};

/** The record of a checked collection document: present items in collection order, missing ones kept apart. */
export function projectCollectionFrom(doc: CollectionDoc, importedAt: string): ProjectCollection {
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

/** First Stock screen of the collection the snapshot has (the project's screen), else null. */
export function collectionScreenId(collection: ProjectCollection): string | null {
	return collection.items.find((item) => item.kind === "screen")?.id ?? null;
}

/** The collection without one item (a removed chip); the item is not added to `missing`. */
export function withoutItem(collection: ProjectCollection, index: number): ProjectCollection {
	return { ...collection, items: collection.items.filter((_, i) => i !== index) };
}
