import {
	PAGE_LIMITS,
	type PageBlock,
	type PageBlockCopy,
	type PageBlockKind,
	type PageCopyKey
} from "@buildytech/page-contract";

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
};

export type ModelBlockContent = {
	kind: PageBlockKind;
	title?: string;
	copy: PageBlockCopy;
	items: ModelContentItem[];
	/** Follow-up turns: true only on blocks the author asked to change. */
	edit?: boolean;
};

export type ModelPageContent = {
	title?: string;
	locale?: string;
	demoLabel?: string;
	blocks: ModelBlockContent[];
	/** Follow-up turns: Stock block kinds the author asked to remove. */
	remove?: PageBlockKind[];
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
	"address"
];

const LOCALE_PATTERN = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

// Cyrillic stems (lowercase). See module comment.
const RU = {
	fake: "\u0444\u0435\u0439\u043a", // fake-
	fictional: "\u0432\u044b\u043c\u044b\u0448\u043b", // fictional-
	madeUp: "\u0432\u044b\u0434\u0443\u043c\u0430\u043d", // made-up-
	test: "\u0442\u0435\u0441\u0442\u043e\u0432", // test (adj.)
	demo: "\u0434\u0435\u043c\u043e", // demo
	mock: "\u043c\u043e\u043a\u043e\u0432", // mock (adj.)
	random: "\u0441\u043b\u0443\u0447\u0430\u0439\u043d", // random-
	sample: "\u043f\u0440\u0438\u043c\u0435\u0440\u043d", // sample-/approximate
	data: "\u0434\u0430\u043d\u043d", // data
	figures: "\u0446\u0438\u0444\u0440", // figures
	metrics: "\u043f\u043e\u043a\u0430\u0437\u0430\u0442\u0435\u043b", // indicators
	content: "\u043a\u043e\u043d\u0442\u0435\u043d\u0442", // content
	values: "\u0437\u043d\u0430\u0447\u0435\u043d\u0438", // values
	records: "\u0437\u0430\u043f\u0438\u0441", // records
	russian: "\u0440\u0443\u0441\u0441\u043a", // russian
	english: "\u0430\u043d\u0433\u043b\u0438\u0439\u0441\u043a" // english
} as const;

const RU_ALWAYS = new RegExp(`(?:${RU.fake}|${RU.fictional}|${RU.madeUp})`, "u");
const RU_QUALIFIED = new RegExp(
	`(?:${RU.test}|${RU.demo}|${RU.mock}|${RU.random}|${RU.sample})[\\p{L}]*(?:[\\s-]+[\\p{L}]+)?[\\s-]+(?:${RU.data}|${RU.figures}|${RU.metrics}|${RU.content}|${RU.values}|${RU.records})`,
	"u"
);
const EN_ALWAYS = /\b(?:fake|dummy|lorem ipsum|made[- ]up)\b/i;
const EN_QUALIFIED =
	/\b(?:mock(?:ed)?|sample|demo|placeholder|test|fictional|synthetic|example)\s+(?:\w+\s+)?(?:data|content|figures|numbers|values|metrics|stats|records|rows|entries)\b/i;

/** True only when the author explicitly asked for demo, fake, sample, or mock data. */
export function detectDemoDataRequest(brief: string): boolean {
	const text = brief.toLowerCase();
	if (!text.trim()) return false;
	return EN_ALWAYS.test(text) || EN_QUALIFIED.test(text) || RU_ALWAYS.test(text) || RU_QUALIFIED.test(text);
}

/** Explicit "in Russian" / "in English" request, in either language. */
export function explicitLocaleRequest(brief: string): string | null {
	const text = brief.toLowerCase();
	// "na russkom" / "na angliiskom" ("in Russian" / "in English").
	if (/\bin russian\b/.test(text) || new RegExp(`\u043d\u0430\\s+${RU.russian}`, "u").test(text)) return "ru";
	if (/\bin english\b/.test(text) || new RegExp(`\u043d\u0430\\s+${RU.english}`, "u").test(text)) return "en";
	return null;
}

/** Script-based guess. Cyrillic-majority text is Russian; everything else defaults to English. */
export function detectBriefLocale(brief: string): string {
	const letters = brief.match(/\p{L}/gu) ?? [];
	if (!letters.length) return "en";
	const cyrillic = letters.filter((ch) => /\p{Script=Cyrillic}/u.test(ch)).length;
	return cyrillic * 2 >= letters.length ? "ru" : "en";
}

export function isPageLocale(value: unknown): value is string {
	return (
		typeof value === "string" &&
		value.length <= PAGE_LIMITS.maxLocaleLength &&
		LOCALE_PATTERN.test(value)
	);
}

/** Page locale: explicit author request, then the model's locale, then the brief's script. */
export function resolvePageLocale(input: { brief: string; modelLocale?: string; fallback?: string }): string {
	const explicit = explicitLocaleRequest(input.brief);
	if (explicit) return explicit;
	const detected = detectBriefLocale(input.brief);
	if (isPageLocale(input.modelLocale)) {
		// A Cyrillic brief cannot produce an English page unless the author asked for English.
		if (detected === "ru" && input.modelLocale.split("-")[0] !== "ru") return "ru";
		return input.modelLocale;
	}
	if (input.fallback && isPageLocale(input.fallback) && detected === "en") return input.fallback;
	return detected;
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

function normalizeKind(raw: unknown): PageBlockKind | null {
	const key = String(raw ?? "").trim().toLowerCase();
	if (CONTENT_KINDS.has(key)) return key as PageBlockKind;
	if (key === "header" || key === "navigation" || key === "navbar" || key === "topbar") return "nav";
	if (key === "sidebar" || key === "side-nav" || key === "side_nav" || key === "sidebar-nav") return "sidenav";
	if (key === "tabbar" || key === "tab-bar" || key === "bottom-nav" || key === "bottom_nav" || key === "bottombar") return "bottomnav";
	if (key === "kpis" || key === "kpi" || key === "stats") return "metrics";
	if (key === "feed" || key === "events" || key === "timeline") return "activity";
	return null;
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
		const copySource =
			rec.copy && typeof rec.copy === "object" ? { ...rec, ...(rec.copy as Record<string, unknown>) } : rec;
		const copy: PageBlockCopy = {};
		for (const field of COPY_FIELDS) {
			const text = cleanText(copySource[field], field === "lede" ? 400 : 160);
			if (text) copy[field] = text;
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
		out.blocks.push({ kind, ...(blockTitle ? { title: blockTitle } : {}), copy, items, ...(rec.edit === true ? { edit: true } : {}) });
	}
	if (Array.isArray(args.remove)) {
		const remove = args.remove.map(normalizeKind).filter((kind): kind is PageBlockKind => Boolean(kind));
		if (remove.length) out.remove = [...new Set(remove)];
	}
	return out;
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
			group: { type: "string", description: "Sidenav only: group heading for this link, e.g. Workspace." }
		},
		required: ["label"]
	};
	const copyProps: Record<string, unknown> = {};
	for (const field of COPY_FIELDS) copyProps[field] = { type: "string" };
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
					edit: {
						type: "boolean",
						description:
							"Follow-up turns on currentPage only: true on blocks the author asked to change or add. Other existing blocks keep their copy and rows."
					}
				},
				required: ["kind", "title"]
			}
		},
		remove: {
			type: "array",
			description: "Follow-up turns only: block kinds the author explicitly asked to remove. Never remove anything else.",
			items: { type: "string", enum: [...CONTENT_KINDS] }
		}
	};
}
