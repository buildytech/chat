import {
	PAGE_BLOCK_KINDS,
	PAGE_COPY_KEYS,
	type PageBlockKind,
	type PageCopyKey
} from "@buildytech/page-contract";

export type LayoutCopyEdit = {
	kind: PageBlockKind;
	field: PageCopyKey;
	value: string;
};

const KIND_SET = new Set<string>(PAGE_BLOCK_KINDS);
const FIELD_SET = new Set<string>(PAGE_COPY_KEYS);

const KIND_ALIASES: Record<string, PageBlockKind> = {
	navigation: "nav",
	header: "hero",
	heading: "hero",
	calltoaction: "cta",
	"call-to-action": "cta"
};

const FIELD_ALIASES: Record<string, PageCopyKey> = {
	title: "headline",
	subtitle: "lede",
	description: "lede",
	body: "lede",
	cta: "action",
	button: "action",
	label: "action"
};

function normalizeKind(raw: string): PageBlockKind | null {
	const key = raw.trim().toLowerCase();
	if (KIND_SET.has(key)) return key as PageBlockKind;
	return KIND_ALIASES[key] ?? null;
}

function normalizeField(raw: string): PageCopyKey | null {
	const key = raw.trim().toLowerCase();
	if (FIELD_SET.has(key)) return key as PageCopyKey;
	const aliased = FIELD_ALIASES[key];
	return aliased && FIELD_SET.has(aliased) ? aliased : null;
}

function parseCopyPath(path: string): { kind: PageBlockKind; field: PageCopyKey } | null {
	const parts = path
		.split(".")
		.map((part) => part.trim().toLowerCase())
		.filter(Boolean);
	const kind = parts.map(normalizeKind).find((item): item is PageBlockKind => Boolean(item));
	const field = [...parts].reverse().map(normalizeField).find((item): item is PageCopyKey => Boolean(item));
	if (!kind || !field) return null;
	return { kind, field };
}

function looksLikeRawInstruction(value: string): boolean {
	const words = value.trim().split(/\s+/);
	if (/^(?:change|keep|create|update|edit|replace|apply)\b/i.test(value) && words.length > 6) return true;
	if (/\bkeep all other\b/i.test(value)) return true;
	return false;
}

function cleanExtractedValue(raw: string): string {
	let value = raw.trim().replace(/^["'«]+|[»"']+$/g, "").trim();
	value = value.replace(/\s+keep\s+all\s+other[\s\S]*$/i, "").trim();
	if (!value || looksLikeRawInstruction(value)) return "";
	if (value.length > 80) return "";
	return value.slice(0, 80);
}

/** Structured copy patches from propose_layout.edits. Drops raw prompt text. */
export function parseLayoutCopyEdits(raw: unknown): LayoutCopyEdit[] {
	if (!Array.isArray(raw)) return [];
	const out: LayoutCopyEdit[] = [];
	for (const item of raw) {
		if (!item || typeof item !== "object") continue;
		const rec = item as Record<string, unknown>;
		const fromPath = typeof rec.path === "string" ? parseCopyPath(rec.path) : null;
		const kind = normalizeKind(String(rec.kind ?? rec.blockKind ?? rec.slot ?? rec.block ?? fromPath?.kind ?? ""));
		const field = normalizeField(String(rec.field ?? rec.copyKey ?? rec.key ?? fromPath?.field ?? ""));
		const value = cleanExtractedValue(String(rec.value ?? ""));
		if (!kind || !field || !value) continue;
		out.push({ kind, field, value });
	}
	return out;
}
