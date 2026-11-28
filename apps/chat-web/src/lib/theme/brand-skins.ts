/**
 * Per-project Brand Skins (ADR 0070): magazine-theme v2 configs with an optional brief, stored in `ext.design`.
 * Pure: no DOM, no storage. The selector lists these beside registry skins; each project keeps its own list.
 */
import { CUSTOM_SKIN_ID, type ThemeConfig } from "./custom-skin.ts";
import type { BrandBrief } from "./brand-brief.ts";
import type { Project } from "../project/types.ts";

export const IMPORTED_BRAND_SKIN_ID = CUSTOM_SKIN_ID;
const BRAND_PREFIX = "brand-";
const MAX_SKINS = 32;

type BrandSkinSource = "design" | "import";

export type BrandSkinRecord = {
	id: string;
	name: string;
	createdAt: string;
	source: BrandSkinSource;
	brief: BrandBrief;
	theme: ThemeConfig;
	contract?: Record<string, unknown>;
	/** 1 when created; +1 each time Design edits the skin (same id). Absent on older records: read as 1. */
	revision?: number;
	updatedAt?: string;
};

export type DesignMessage = {
	id: string;
	role: "user" | "assistant";
	text: string;
	createdAt: string;
	skinId?: string;
	revision?: number;
	issues?: Array<{ code: string; path: string; message: string }>;
};

export type DesignExt = {
	active?: boolean;
	skins?: Record<string, BrandSkinRecord>;
	messages?: DesignMessage[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

function parseDesignMessage(value: unknown): DesignMessage | null {
	if (!isRecord(value) || typeof value.id !== "string" || typeof value.text !== "string" || typeof value.createdAt !== "string") return null;
	if (value.role !== "user" && value.role !== "assistant") return null;
	const issues = Array.isArray(value.issues)
		? value.issues.flatMap((item) => {
				if (!isRecord(item) || typeof item.code !== "string" || typeof item.path !== "string" || typeof item.message !== "string") return [];
				return [{ code: item.code, path: item.path, message: item.message }];
			})
		: undefined;
	return {
		id: value.id,
		role: value.role,
		text: value.text,
		createdAt: value.createdAt,
		...(typeof value.skinId === "string" ? { skinId: value.skinId } : {}),
		...(typeof value.revision === "number" && Number.isInteger(value.revision) && value.revision > 0 ? { revision: value.revision } : {}),
		...(issues?.length ? { issues } : {})
	};
}

function extValue(design: DesignExt): Readonly<Record<string, unknown>> {
	const value: Record<string, unknown> = {};
	if (design.active !== undefined) value.active = design.active;
	if (design.skins) value.skins = design.skins;
	if (design.messages) value.messages = design.messages;
	return value;
}

export function designExtOf(project: { ext?: Record<string, unknown> } | null | undefined): DesignExt {
	const raw = project?.ext?.design;
	if (!isRecord(raw)) return {};
	const skins: Record<string, BrandSkinRecord> = {};
	if (isRecord(raw.skins)) {
		for (const [id, value] of Object.entries(raw.skins)) {
			const record = parseBrandSkinRecord(value);
			if (record) skins[id] = record;
		}
	}
	const messages = Array.isArray(raw.messages) ? raw.messages.flatMap((item) => { const message = parseDesignMessage(item); return message ? [message] : []; }) : undefined;
	return {
		...(typeof raw.active === "boolean" ? { active: raw.active } : {}),
		...(Object.keys(skins).length ? { skins } : {}),
		...(messages?.length ? { messages } : {})
	};
}

function isThemeConfig(value: unknown): value is ThemeConfig {
	return isRecord(value) && value.format === "magazine-theme" && value.version === 2;
}

function isBrief(value: unknown): value is BrandBrief {
	if (!isRecord(value) || typeof value.name !== "string" || !isRecord(value.thesis)) return false;
	const thesis = value.thesis;
	return typeof thesis.summary === "string" && typeof thesis.positioning === "string" && Array.isArray(thesis.antiPersonality);
}

function parseBrandSkinRecord(value: unknown): BrandSkinRecord | null {
	if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") return null;
	if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(value.id)) return null;
	if (value.source !== "design" && value.source !== "import") return null;
	if (typeof value.createdAt !== "string" || !isThemeConfig(value.theme) || !isBrief(value.brief)) return null;
	return {
		id: value.id,
		name: value.name,
		createdAt: value.createdAt,
		source: value.source,
		brief: value.brief,
		theme: value.theme,
		...(isRecord(value.contract) ? { contract: value.contract } : {}),
		...(typeof value.revision === "number" && Number.isInteger(value.revision) && value.revision > 0 ? { revision: value.revision } : {}),
		...(typeof value.updatedAt === "string" ? { updatedAt: value.updatedAt } : {})
	};
}

/** The revision of a record (older records have none: 1). */
export const revisionOf = (record: BrandSkinRecord): number => record.revision ?? 1;

/**
 * Edit a Brand Skin in place (ADR 0072): same id, name and createdAt follow the new brief, revision + 1. The caller
 * passes the validated proposal; nothing here validates.
 */
export function editedBrandSkin(base: BrandSkinRecord, next: { brief: BrandBrief; theme: ThemeConfig; contract: Record<string, unknown> }, now = new Date().toISOString()): BrandSkinRecord {
	return {
		id: base.id,
		name: next.brief.name,
		createdAt: base.createdAt,
		source: base.source === "import" ? "design" : base.source,
		brief: next.brief,
		theme: next.theme,
		contract: next.contract,
		revision: revisionOf(base) + 1,
		updatedAt: now
	};
}

/** Whether a proposal changes anything of the skin (brief and theme): an identical answer is no edit. */
export function sameBrandSkinContent(base: BrandSkinRecord, next: { brief: BrandBrief; theme: ThemeConfig }): boolean {
	return JSON.stringify([base.brief, base.theme]) === JSON.stringify([next.brief, next.theme]);
}

export function brandSkinsOf(project: { ext?: Record<string, unknown> } | null | undefined): BrandSkinRecord[] {
	const skins = designExtOf(project).skins ?? {};
	const list: BrandSkinRecord[] = [];
	for (const value of Object.values(skins)) {
		const record = parseBrandSkinRecord(value);
		if (record) list.push(record);
	}
	return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name));
}

export function brandSkinOf(project: { ext?: Record<string, unknown> } | null | undefined, id: string | null | undefined): BrandSkinRecord | null {
	if (!id) return null;
	return brandSkinsOf(project).find((item) => item.id === id) ?? null;
}

/** Theme of the project's chosen skin when that id is a Brand Skin; otherwise null (a registry skin or default). */
export function themeOfProjectSkin(project: { ext?: Record<string, unknown> } | null | undefined, skin: string | null | undefined): ThemeConfig | null {
	return brandSkinOf(project, skin)?.theme ?? null;
}

export function packSkinOptionsFor(
	skin: string | null,
	project: { ext?: Record<string, unknown> } | null | undefined
): { skin: string | null; theme?: ThemeConfig; contract?: Record<string, unknown> } {
	const record = brandSkinOf(project, skin);
	if (!record) return { skin };
	return { skin: record.theme.skin, theme: record.theme, ...(record.contract ? { contract: record.contract } : {}) };
}

export function importedThemeBrief(name = "Imported theme"): BrandBrief {
	return {
		name,
		thesis: {
			summary: "Imported magazine-theme v2 config.",
			positioning: "Imported in Settings.",
			antiPersonality: ["unspecified"]
		}
	};
}

function slugPart(name: string): string {
	return (
		name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 24) || "skin"
	);
}

/** A new Brand Skin id (`brand-<slug>` plus a suffix on collision), valid for the session `skin` pattern. */
export function newBrandSkinId(name: string, used: ReadonlySet<string>): string {
	const base = `${BRAND_PREFIX}${slugPart(name)}`;
	if (!used.has(base)) return base;
	for (let n = 2; n < 1000; n += 1) {
		const id = `${base}-${n}`;
		if (!used.has(id)) return id;
	}
	return `${base}-${Date.now().toString(36).slice(-6)}`;
}

export function withDesignExt(project: Project, change: (prev: DesignExt) => DesignExt): Project {
	const next = change(designExtOf(project));
	const skins = next.skins ?? {};
	if (!Object.keys(skins).length && !next.messages?.length && !next.active) {
		const rest: Record<string, Readonly<Record<string, unknown>>> = {};
		for (const [key, value] of Object.entries(project.ext)) {
			if (key !== "design") rest[key] = value;
		}
		return { ...project, ext: rest };
	}
	return { ...project, ext: { ...project.ext, design: extValue(next) } };
}

export function upsertBrandSkin(project: Project, record: BrandSkinRecord, select: boolean): Project {
	const updated = withDesignExt(project, (prev) => {
		const skins = { ...(prev.skins ?? {}) };
		const keys = Object.keys(skins);
		if (!skins[record.id] && keys.length >= MAX_SKINS) {
			const oldest = brandSkinsOf(project)[0];
			if (oldest && oldest.id !== record.id) delete skins[oldest.id];
		}
		skins[record.id] = record;
		return { ...prev, skins };
	});
	return select ? { ...updated, skin: record.id } : updated;
}

export function removeBrandSkin(project: Project, id: string): Project {
	const next = withDesignExt(project, (prev) => {
		const skins = { ...(prev.skins ?? {}) };
		delete skins[id];
		return { ...prev, skins };
	});
	return (next.skin ?? null) === id ? { ...next, skin: null } : next;
}

/**
 * Copy the legacy browser-wide `buildy:v1:customSkin` slot into projects that still need it.
 * Projects with `skin === "custom"` always receive a copy; the selected project also receives one
 * when it has no Brand Skin yet. Returns whether the shared slot can be cleared.
 */
export function migrateLegacyCustomSkin(
	projects: readonly Project[],
	legacy: ThemeConfig | null,
	selectedId: string | null,
	now = new Date().toISOString()
): { projects: Project[]; clearLegacy: boolean } {
	if (!legacy) return { projects: [...projects], clearLegacy: false };
	const record: BrandSkinRecord = {
		id: IMPORTED_BRAND_SKIN_ID,
		name: importedThemeBrief().name,
		createdAt: now,
		source: "import",
		brief: importedThemeBrief(),
		theme: legacy
	};
	let copied = false;
	const next = projects.map((project) => {
		if (brandSkinOf(project, IMPORTED_BRAND_SKIN_ID)) return project;
		const isCurrent = project.id === selectedId;
		const wants = project.skin === IMPORTED_BRAND_SKIN_ID || (isCurrent && brandSkinsOf(project).length === 0);
		if (!wants) return project;
		copied = true;
		const added = upsertBrandSkin(project, record, project.skin === IMPORTED_BRAND_SKIN_ID);
		return { ...added, updatedAt: project.updatedAt };
	});
	// Clear the shared slot once every project that had skin=custom has a copy (no cross-project leakage after this).
	const pending = next.some((project) => project.skin === IMPORTED_BRAND_SKIN_ID && !brandSkinOf(project, IMPORTED_BRAND_SKIN_ID));
	return { projects: next, clearLegacy: copied || !pending };
}
