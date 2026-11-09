import {
	PAGE_LIMITS,
	type PageBlock,
	type PageBlockCopy,
	type PageBlockKind,
	type PageCopyKey
} from "@buildytech/page-contract";
import { rendererKindForLabel } from "./catalog/compatibility.ts";
import { isLucideIcon, resolveCatalogChoice } from "./catalog/sources.ts";

/**
 * Model-supplied page content for propose_layout.
 *
 * The assembler still selects and orders Stock blocks. This module only carries the
 * model's copy (and, when the author explicitly asked for it, demo data rows) onto
 * those blocks. Catalog defaults remain the fallback for any missing field.
 *
 * Repo rule: no Cyrillic in code. Russian stems below are written as \u escapes.
 */

export type ModelContentItem = {
	label: string;
	value?: string;
	note?: string;
	detail?: string;
	/** Sidebar group heading for a nav link (stored as nav-link copy.eyebrow). */
	group?: string;
	/** Lucide icon name of a feature row (copy.icon); checked against the pinned registry snapshot. */
	icon?: string;
};

export type ModelBlockContent = {
	kind: PageBlockKind;
	title?: string;
	copy: PageBlockCopy;
	items: ModelContentItem[];
	/** Follow-up turns: true only on blocks the author asked to change. */
	edit?: boolean;
	/** Stock catalog block (spec, label or asset id) and catalog variant the model picked; checked by the program. */
	catalogBlock?: string;
	variant?: string;
};

export type ModelPageContent = {
	title?: string;
	locale?: string;
	demoLabel?: string;
	blocks: ModelBlockContent[];
	/** Follow-up turns: Stock block kinds the author asked to remove. */
	remove?: PageBlockKind[];
	/**
	 * Typed intent set by the model from the author's words (the host does not parse words):
	 * demo data requested (true), explicitly declined (false), or not mentioned (undefined).
	 */
	demoData?: boolean;
	/** Block kinds the author explicitly wants (from catalog block labels such as sidenav, sitemap). */
	requireBlocks?: PageBlockKind[];
	/** requireBlocks values that are not catalog block labels or page kinds (reported, never invented). */
	unknownBlocks?: string[];
	/** The author asked for a brand-new page instead of editing the current one. */
	newPage?: boolean;
};

/** Kinds whose rows are figures or events. Rows are kept only when the author asked for demo data. */
export const DATA_KINDS: ReadonlySet<PageBlockKind> = new Set<PageBlockKind>(["overview", "metrics", "chart", "activity"]);

/** Child kind and row limit per parent kind. */
const ITEM_RULES: Partial<Record<PageBlockKind, { child: PageBlockKind; max: number }>> = {
	nav: { child: "nav-link", max: 6 },
	features: { child: "feature", max: 6 },
	menu: { child: "dish", max: 8 },
	overview: { child: "metric", max: 4 },
	metrics: { child: "metric", max: 6 },
	chart: { child: "metric", max: 12 },
	activity: { child: "activity-item", max: 8 },
	sidenav: { child: "nav-link", max: 8 },
	bottomnav: { child: "nav-link", max: 5 }
};

/** Child kind rendered inside a parent kind (shared with the catalog provenance gate). */
export function childKindFor(kind: PageBlockKind): PageBlockKind | null {
	return ITEM_RULES[kind]?.child ?? null;
}

export function itemLimitFor(kind: PageBlockKind): number {
	return ITEM_RULES[kind]?.max ?? 0;
}

const CONTENT_KINDS = new Set<string>([
	"nav",
	"sidenav",
	"bottomnav",
	"hero",
	"pagehead",
	"overview",
	"metrics",
	"chart",
	"activity",
	"features",
	"menu",
	"hours",
	"cta",
	"footer"
]);

const COPY_FIELDS: readonly PageCopyKey[] = [
	"eyebrow",
	"headline",
	"lede",
	"action",
	"note",
	"brand",
	"contact",
	"legal",
	"days",
	"address",
	"href"
];

const HREF_PATTERN = /^(?:#|\/|https?:\/\/|mailto:)/;
const TOKEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9./-]*$/;

/** A catalog token (icon name, variant, catalog block) as the model sent it, trimmed; never free text. */
function cleanToken(value: unknown, max: number): string | undefined {
	if (typeof value !== "string") return undefined;
	const token = value.trim();
	return token && token.length <= max && TOKEN_PATTERN.test(token) ? token : undefined;
}

const LOCALE_PATTERN = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

export function isPageLocale(value: unknown): value is string {
	return (
		typeof value === "string" &&
		value.length <= PAGE_LIMITS.maxLocaleLength &&
		LOCALE_PATTERN.test(value)
	);
}

/**
 * Page locale: the model's typed locale (it reads the author's language), else the current page's
 * locale, else English. The host does not guess the language from words.
 */
export function resolvePageLocale(input: { modelLocale?: string; fallback?: string }): { locale: string; source: "model" | "page" | "default" } {
	if (isPageLocale(input.modelLocale)) return { locale: input.modelLocale, source: "model" };
	if (input.fallback && isPageLocale(input.fallback)) return { locale: input.fallback, source: "page" };
	return { locale: "en", source: "default" };
}

const DEMO_LABELS: Record<string, string> = {
	en: "Demo data",
	ru: "\u0414\u0435\u043c\u043e-\u0434\u0430\u043d\u043d\u044b\u0435"
};

const SHELL_TITLES: Record<string, { sidenav: string; bottomnav: string }> = {
	en: { sidenav: "Navigation", bottomnav: "Sections" },
	ru: {
		sidenav: "\u041d\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u044f",
		bottomnav: "\u0420\u0430\u0437\u0434\u0435\u043b\u044b"
	}
};

/** Accessible name for app-shell navigation landmarks in the page language. */
export function shellTitle(kind: "sidenav" | "bottomnav", locale: string): string {
	const table = SHELL_TITLES[locale.split("-")[0] ?? "en"] ?? SHELL_TITLES.en!;
	return table[kind];
}

export function isShellDefaultTitle(title: string): boolean {
	return Object.values(SHELL_TITLES).some((row) => row.sidenav === title || row.bottomnav === title);
}

export function defaultDemoLabel(locale: string): string {
	return DEMO_LABELS[locale.split("-")[0] ?? "en"] ?? DEMO_LABELS.en!;
}

/** The model's demo badge text, unless it is in the wrong language for the page (e.g. "Demo data" on a ru page). */
export function demoLabelForLocale(modelLabel: string | undefined, locale: string): string | undefined {
	if (!modelLabel) return undefined;
	const lang = locale.split("-")[0] ?? "en";
	if (lang === "en") return modelLabel;
	if (modelLabel.trim().toLowerCase() === DEMO_LABELS.en!.toLowerCase() || /^demo\b/i.test(modelLabel.trim())) return undefined;
	if (lang === "ru" && !/\p{Script=Cyrillic}/u.test(modelLabel)) return undefined;
	return modelLabel;
}

/** Plain text for the Page contract: no control chars, no markup braces, bounded. */
export function cleanText(value: unknown, max: number): string | undefined {
	if (typeof value !== "string" && typeof value !== "number") return undefined;
	const text = String(value)
		.replace(/[\u0000-\u001F\u007F]/g, " ")
		.replace(/[<>{}]/g, "")
		.replace(/\s+/g, " ")
		.trim();
	if (!text) return undefined;
	const collapsed = text.replace(/\s/g, "").toLowerCase();
	if (/^(?:javascript|data|vbscript|file):/.test(collapsed)) return undefined;
	return text.slice(0, max);
}

/** Page kind for a catalog block label or page kind, via the catalog renderer map (no alias lists). */
function normalizeKind(raw: unknown): PageBlockKind | null {
	const key = String(raw ?? "").trim().toLowerCase();
	if (CONTENT_KINDS.has(key)) return key as PageBlockKind;
	const mapped = rendererKindForLabel(key);
	return mapped && CONTENT_KINDS.has(mapped) ? mapped : null;
}

function parseItem(raw: unknown): ModelContentItem | null {
	if (typeof raw === "string") {
		const label = cleanText(raw, 80);
		return label ? { label } : null;
	}
	if (!raw || typeof raw !== "object") return null;
	const rec = raw as Record<string, unknown>;
	const label = cleanText(rec.label ?? rec.title ?? rec.name, 80);
	if (!label) return null;
	const item: ModelContentItem = { label };
	const rawValue = cleanText(rec.value ?? rec.figure ?? rec.count, 24);
	// Drop punctuation-only figures such as "," or "-" (no letter or digit).
	const value = rawValue && /[\p{L}\p{N}]/u.test(rawValue) ? rawValue : undefined;
	const note = cleanText(rec.note ?? rec.delta ?? rec.status ?? rec.time, 120);
	const detail = cleanText(rec.detail ?? rec.description ?? rec.summary, 200);
	if (value) item.value = value;
	if (note) item.note = note;
	if (detail) item.detail = detail;
	const group = cleanText(rec.group ?? rec.section, 40);
	if (group) item.group = group;
	// The icon is kept as sent (a malformed one too) so the catalog gate can reject it with its path.
	if (typeof rec.icon === "string" && rec.icon.trim()) item.icon = rec.icon.trim().slice(0, 64);
	return item;
}

/** Parse untrusted propose_layout content args. Unknown kinds and fields are dropped. */
export function parseModelContent(args: Record<string, unknown>): ModelPageContent {
	const out: ModelPageContent = { blocks: [] };
	const title = cleanText(args.title, 80);
	if (title) out.title = title;
	if (isPageLocale(args.locale)) out.locale = args.locale;
	const demoLabel = cleanText(args.demoLabel, 32);
	if (demoLabel) out.demoLabel = demoLabel;
	const rawBlocks = Array.isArray(args.blocks) ? args.blocks : [];
	const seen = new Set<PageBlockKind>();
	for (const raw of rawBlocks.slice(0, 16)) {
		if (!raw || typeof raw !== "object") continue;
		const rec = raw as Record<string, unknown>;
		const kind = normalizeKind(rec.kind);
		if (!kind || seen.has(kind)) continue;
		seen.add(kind);
		const copySource: Record<string, unknown> =
			rec.copy && typeof rec.copy === "object" ? { ...rec, ...(rec.copy as Record<string, unknown>) } : { ...rec };
		// An action may come as { label, href } (organism prop shape).
		const action = copySource.action;
		if (action && typeof action === "object" && !Array.isArray(action)) {
			const link = action as Record<string, unknown>;
			copySource.action = link.label;
			if (copySource.href === undefined) copySource.href = link.href;
		}
		const copy: PageBlockCopy = {};
		for (const field of COPY_FIELDS) {
			const text = cleanText(copySource[field], field === "lede" ? 400 : 160);
			if (text && (field !== "href" || HREF_PATTERN.test(text))) copy[field] = text;
		}
		const rule = ITEM_RULES[kind];
		const items = rule && Array.isArray(rec.items)
			? rec.items
					.map(parseItem)
					.filter((item): item is ModelContentItem => Boolean(item))
					// A metric tile or chart point without a figure renders as an empty bar; drop it.
					.filter((item) => rule.child !== "metric" || Boolean(item.value))
					.slice(0, rule.max)
			: [];
		const blockTitle = cleanText(rec.title, 80);
		const catalogBlock = cleanToken(rec.catalogBlock, 120);
		const variant = typeof rec.variant === "string" && rec.variant.trim() ? rec.variant.trim().slice(0, 60) : undefined;
		out.blocks.push({
			kind,
			...(blockTitle ? { title: blockTitle } : {}),
			copy,
			items,
			...(rec.edit === true ? { edit: true } : {}),
			...(catalogBlock ? { catalogBlock } : {}),
			...(variant ? { variant } : {})
		});
	}
	if (typeof args.demoData === "boolean") out.demoData = args.demoData;
	if (args.newPage === true) out.newPage = true;
	if (Array.isArray(args.requireBlocks)) {
		const kinds: PageBlockKind[] = [];
		const unknown: string[] = [];
		for (const raw of args.requireBlocks.slice(0, 12)) {
			const kind = normalizeKind(raw);
			if (kind) {
				if (!kinds.includes(kind)) kinds.push(kind);
			} else if (typeof raw === "string" && raw.trim()) unknown.push(raw.trim().slice(0, 40));
		}
		if (kinds.length) out.requireBlocks = kinds;
		if (unknown.length) out.unknownBlocks = unknown;
	}
	if (Array.isArray(args.remove)) {
		const remove = args.remove.map(normalizeKind).filter((kind): kind is PageBlockKind => Boolean(kind));
		if (remove.length) out.remove = [...new Set(remove)];
	}
	return out;
}

/**
 * Catalog checks of the model content before assembly: an explicit catalogBlock (and its variant) must be a block of
 * the pinned catalog for that kind, and every row icon a Lucide name of the registry snapshot. A variant without a
 * catalogBlock is checked after assembly against the block of the chosen screen. Catalog blocks are normalized
 * (label or asset id -> block spec).
 */
export function checkContentCatalog(content: ModelPageContent): { ok: true } | { ok: false; code: string; message: string; path: string } {
	for (const [bi, entry] of content.blocks.entries()) {
		if (entry.catalogBlock) {
			const choice = resolveCatalogChoice({ kind: entry.kind, catalogBlock: entry.catalogBlock, variant: entry.variant });
			if (!choice.ok) {
				return { ok: false, code: choice.code, message: choice.message, path: `blocks[${bi}].${choice.code === "unknown_variant" ? "variant" : "catalogBlock"}` };
			}
			entry.catalogBlock = choice.catalogBlock;
			if (choice.variant) entry.variant = choice.variant;
		}
		for (const [ii, item] of entry.items.entries()) {
			if (item.icon !== undefined && !isLucideIcon(item.icon)) {
				return {
					ok: false,
					code: "unknown_icon",
					message: `${item.icon} is not a Lucide icon of the pinned registry snapshot. Call get_block_details on the block for the allowed names.`,
					path: `blocks[${bi}].items[${ii}].icon`
				};
			}
		}
	}
	return { ok: true };
}

export function hasModelContent(content: ModelPageContent | undefined): boolean {
	return Boolean(content && (content.title || content.blocks.length));
}

function childBlock(parent: PageBlock, child: PageBlockKind, item: ModelContentItem, index: number, demo: boolean): PageBlock {
	const node: PageBlock = {
		id: `${parent.id}-item-${index + 1}`.slice(0, PAGE_LIMITS.maxIdLength),
		kind: child,
		title: item.label,
		summary: item.detail ?? item.note ?? item.label
	};
	const copy: PageBlockCopy = {};
	if (item.value && (demo || child === "nav-link" || child === "feature")) copy.value = item.value;
	if (item.note) copy.note = item.note;
	if (item.group && child === "nav-link") copy.eyebrow = item.group;
	if (item.icon && child === "feature") copy.icon = item.icon;
	if (Object.keys(copy).length) node.copy = copy;
	return node;
}

export type MergeResult = {
	blocks: PageBlock[];
	changed: string[];
	droppedData: string[];
	demoBlocks: string[];
};

/**
 * Overlay model copy on assembled Stock blocks (matched by kind).
 * Data rows for overview/metrics/chart/activity are applied only when `demo` is true;
 * those blocks get the demo badge.
 */
export function mergeModelContent(
	blocks: PageBlock[],
	content: ModelPageContent | undefined,
	opts: { demo: boolean; demoLabel: string; locale?: string; onlyKinds?: ReadonlySet<PageBlockKind> }
): MergeResult {
	const changed: string[] = [];
	const droppedData: string[] = [];
	const demoBlocks: string[] = [];
	if (!content) return { blocks, changed, droppedData, demoBlocks };
	const byKind = new Map(content.blocks.map((entry) => [entry.kind, entry]));
	// Catalog fallback copy is English. On a non-English page, a block the model wrote keeps
	// only the model's fields so the page never mixes languages.
	const foreign = Boolean(opts.locale && opts.locale.split("-")[0] !== "en");
	const navEntry = byKind.get("nav");
	const sideEntry = byKind.get("sidenav");
	if (sideEntry && !sideEntry.copy.brand && content.title) sideEntry.copy = { ...sideEntry.copy, brand: content.title.slice(0, 48) };
	if (content.title || (navEntry && !navEntry.items.length && foreign)) {
		const sections = content.blocks
			.filter((entry) => entry.kind === "overview" || entry.kind === "metrics" || entry.kind === "chart" || entry.kind === "activity")
			.map((entry) => entry.title)
			.filter((title): title is string => Boolean(title))
			.slice(0, 5);
		const nav: ModelBlockContent = navEntry ?? { kind: "nav", copy: {}, items: [] };
		if (!nav.copy.brand && content.title) nav.copy = { ...nav.copy, brand: content.title.slice(0, 48) };
		if (!nav.items.length && sections.length && (foreign || !navEntry)) nav.items = sections.map((label) => ({ label }));
		byKind.set("nav", nav);
	}
	const next = blocks.map((node) => {
		const entry = byKind.get(node.kind);
		const isData = DATA_KINDS.has(node.kind);
		if (!entry) return node;
		if (opts.onlyKinds && !opts.onlyKinds.has(node.kind)) return node;
		const copy: PageBlockCopy = foreign ? {} : { ...node.copy };
		for (const [field, text] of Object.entries(entry.copy) as Array<[PageCopyKey, string]>) {
			copy[field] = text;
			changed.push(`${node.kind}.${field}`);
		}
		const updated: PageBlock = { ...node };
		if (entry.catalogBlock) updated.catalogBlock = entry.catalogBlock;
		if (entry.variant) {
			updated.variant = entry.variant;
			changed.push(`${node.kind}.variant`);
		}
		if (entry.title) {
			updated.title = entry.title;
			changed.push(`${node.kind}.title`);
		}
		if (entry.copy.lede) updated.summary = entry.copy.lede.slice(0, PAGE_LIMITS.maxSummaryLength);
		const rule = ITEM_RULES[node.kind];
		if (rule && entry.items.length) {
			if (isData && !opts.demo) {
				droppedData.push(node.kind);
			} else {
				updated.children = entry.items.map((item, index) => childBlock(node, rule.child, item, index, opts.demo));
				changed.push(`${node.kind}.items`);
				if (isData) {
					copy.badge = opts.demoLabel;
					demoBlocks.push(node.kind);
					// The catalog empty-state lede ("no figures") is false once demo rows exist.
					if (!entry.copy.lede) {
						delete copy.lede;
						updated.summary = updated.title;
					}
				}
			}
		}
		if (Object.keys(copy).length) updated.copy = copy;
		else delete updated.copy;
		return updated;
	});
	if (opts.demo && demoBlocks.length) {
		for (const node of next) {
			if (node.kind === "pagehead" || (node.kind === "hero" && !next.some((b) => b.kind === "pagehead"))) {
				node.copy = { ...node.copy, badge: opts.demoLabel };
				break;
			}
		}
	}
	return { blocks: next, changed, droppedData, demoBlocks };
}

/** JSON schema for the propose_layout content args (shared by both tool-loop paths). */
export function proposeContentParameterSchema(): Record<string, unknown> {
	const item = {
		type: "object",
		properties: {
			label: { type: "string", description: "Row label, metric name, chart x label, nav link, or event text." },
			value: { type: "string", description: "Display figure, e.g. 128 or 94%. Metrics, overview, chart, menu only." },
			note: { type: "string", description: "Delta, status, or time, e.g. +12% or 2 h ago." },
			detail: { type: "string", description: "Secondary line, e.g. who and which project." },
			group: { type: "string", description: "Sidenav only: group heading for this link, e.g. Workspace." },
			icon: {
				type: "string",
				description: "Features only: a Lucide icon name for this feature card. get_block_details on the features block lists the allowed names; unknown names are rejected."
			}
		},
		required: ["label"]
	};
	const copyProps: Record<string, unknown> = {};
	const copyHints: Record<string, string> = {
		action:
			"Label of the block's button or link. On features it is the section link next to the heading (e.g. View all) and needs href on the same block.",
		href: "Target of this block's action: #fragment, /path or https URL. A link the author names for a section goes on that section's block."
	};
	for (const field of COPY_FIELDS) copyProps[field] = copyHints[field] ? { type: "string", description: copyHints[field] } : { type: "string" };
	return {
		title: { type: "string", description: "Page title in the page language." },
		locale: { type: "string", description: "BCP 47 language of the author's request, e.g. ru or en. All copy uses it." },
		demoLabel: {
			type: "string",
			description: "Only when the author asked for demo/fake/sample data: a short marker in the page language, e.g. Demo data."
		},
		blocks: {
			type: "array",
			description:
				"Copy per Stock block kind in the page language. The host keeps the Stock block order and falls back to catalog copy for missing fields. Data items (overview, metrics, chart, activity) are kept only when the author explicitly asked for demo data.",
			items: {
				type: "object",
				properties: {
					kind: {
						type: "string",
						enum: [...CONTENT_KINDS]
					},
					title: { type: "string", description: "Visible section heading in the page language. Required." },
					...copyProps,
					items: { type: "array", items: item },
					variant: {
						type: "string",
						description:
							"Catalog variant of this block, one of get_block_details variants for its catalog block. The host rejects unknown variants; omit for the catalog default."
					},
					catalogBlock: {
						type: "string",
						description: "Optional Stock catalog block (block.<label> or a catalog asset id). Default: the block of this kind on the chosen screen."
					},
					edit: {
						type: "boolean",
						description:
							"Follow-up turns on currentPage only: true on blocks the author asked to change or add. Other existing blocks keep their copy and rows."
					}
				},
				required: ["kind", "title"]
			}
		},
		demoData: {
			type: "boolean",
			description:
				"Records whether the author explicitly asked for demo, fake, sample, mock or test data (in any language): true if asked, false if they asked to remove it or use real data, omit otherwise. The host never generates data: when true YOU must write the rows in blocks[].items (overview, metrics, chart, activity)."
		},
		requireBlocks: {
			type: "array",
			description:
				"Catalog block labels the author explicitly asked for (search_catalog labels.blocks, e.g. sidenav for a sidebar or app shell, bottomnav, sitemap for a footer). The host only adds them from Stock screens that contain them.",
			items: { type: "string" }
		},
		newPage: { type: "boolean", description: "true only when the author asked for a new page instead of editing currentPage." },
		remove: {
			type: "array",
			description: "Follow-up turns only: block kinds the author explicitly asked to remove. Never remove anything else.",
			items: { type: "string", enum: [...CONTENT_KINDS] }
		}
	};
}
