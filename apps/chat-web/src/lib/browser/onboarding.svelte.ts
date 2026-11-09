import {
	OWNER_FILTERS,
	PLACEHOLDERS,
	PLACEHOLDER_ROTATION_MS,
	SCENARIO_PROMPTS,
	compatibilityFor,
	getScreenById,
	paginateScreens,
	screenCanonicalJson,
	type CatalogScreen,
	type PlaceholderMode,
	type ScenarioId,
	type ScreenCompatibility,
	type SearchResult
} from "@buildytech/builder-core";

export type ModalKind = "scenario" | "screen" | "model" | null;

let scenarioId = $state<ScenarioId | null>(null);
let screenId = $state<string | null>(null);
let page = $state(1);
let stockQuery = $state("");
let placeholderIndex = $state(0);
let focused = $state(false);
let composing = $state(false);
let modal = $state<ModalKind>(null);
let keepOutsideScreen = $state(true);

export function getScenarioId(): ScenarioId | null {
	return scenarioId;
}

export function getScreenId(): string | null {
	return screenId;
}

export function getPage(): number {
	return page;
}

export function getPlaceholderIndex(): number {
	return placeholderIndex;
}

export function getFocused(): boolean {
	return focused;
}

export function getComposing(): boolean {
	return composing;
}

export function getModal(): ModalKind {
	return modal;
}

export function placeholderMode(): PlaceholderMode {
	return scenarioId ?? "default";
}

export function placeholders(): readonly string[] {
	return PLACEHOLDERS[placeholderMode()];
}

export function currentPlaceholder(): string {
	const list = placeholders();
	return list[placeholderIndex % list.length] ?? list[0];
}

export function scenarioPrompt() {
	return scenarioId ? SCENARIO_PROMPTS[scenarioId] : null;
}

export function selectedScreen(): CatalogScreen | null {
	return screenId ? getScreenById(screenId) : null;
}

export function selectedCompatibility(): ScreenCompatibility | null {
	const screen = selectedScreen();
	return screen ? compatibilityFor(screen) : null;
}

export function catalogQuery() {
	if (scenarioId === "dashboard") return OWNER_FILTERS.dashboard;
	if (scenarioId === "landing") return OWNER_FILTERS.landing;
	if (scenarioId === "website") return OWNER_FILTERS.website;
	return OWNER_FILTERS.blank;
}

export function getStockQuery(): string {
	return stockQuery;
}

export function setStockQuery(next: string): void {
	stockQuery = next;
	page = 1;
}

export function catalogPage(): SearchResult {
	const raw = paginateScreens({ ...catalogQuery(), page: 1, pageSize: 500 });
	const needle = stockQuery.trim().toLowerCase();
	const matched = needle
		? raw.items.filter((screen) =>
				`${screen.screenId} ${screen.title} ${screen.subtitle} ${screen.labels.blocks.join(" ")} ${screen.labels.job.join(" ")}`
					.toLowerCase()
					.includes(needle)
			)
		: raw.items;
	const pageSize = 12;
	const total = matched.length;
	const pageCount = Math.max(1, Math.ceil(total / pageSize) || 1);
	const current = Math.min(Math.max(page, 1), pageCount);
	const start = (current - 1) * pageSize;
	return {
		...raw,
		page: current,
		pageSize,
		pageCount,
		total,
		items: matched.slice(start, start + pageSize),
		noFit: total === 0
	};
}

export function screenOutsideFilter(): boolean {
	if (!screenId) return false;
	const result = paginateScreens({ ...catalogQuery(), page: 1, pageSize: 500 });
	return !result.items.some((item) => item.screenId === screenId);
}

export function selectScenario(id: ScenarioId): void {
	if (scenarioId === id) return;
	scenarioId = id;
	page = 1;
	placeholderIndex = 0;
	persistNow();
}

export function clearScenario(): void {
	scenarioId = null;
	page = 1;
	placeholderIndex = 0;
	persistNow();
}

export function attachScreen(id: string): { ok: true } | { ok: false; code: string } {
	const screen = getScreenById(id);
	if (!screen) return { ok: false, code: "unknown_screen" };
	screenId = id;
	keepOutsideScreen = true;
	persistNow();
	return { ok: true };
}

export function removeScreen(): void {
	screenId = null;
	keepOutsideScreen = true;
	persistNow();
}

export function setKeepOutsideScreen(keep: boolean): void {
	keepOutsideScreen = keep;
	if (!keep) screenId = null;
}

export function getKeepOutsideScreen(): boolean {
	return keepOutsideScreen;
}

export function setPage(next: number): void {
	page = Math.max(1, next);
}

export function setFocused(next: boolean): void {
	focused = next;
}

export function setComposing(next: boolean): void {
	composing = next;
}

export function openModal(kind: ModalKind): void {
	modal = kind;
}

export function closeModal(): void {
	modal = null;
}

export function rotatePlaceholder(hidden: boolean, reducedMotion: boolean): void {
	if (hidden || focused || composing || reducedMotion || modal) return;
	const list = placeholders();
	placeholderIndex = (placeholderIndex + 1) % list.length;
}

export function resetPlaceholders(): void {
	placeholderIndex = 0;
}

export function sendBrief(draft: string): { ok: true; brief: string } | { ok: false; code: string } {
	const text = draft.trim();
	const scenario = scenarioPrompt();
	if (!text && !scenario) return { ok: false, code: "empty_brief" };
	if (!text && !scenario && screenId) return { ok: false, code: "screen_without_brief" };
	const brief = text || scenario?.text || "";
	if (!brief) return { ok: false, code: "empty_brief" };
	const screen = selectedScreen();
	if (screen) {
		const compat = compatibilityFor(screen);
		if (!compat.compatible && !compat.partial) return { ok: false, code: "incompatible_screen" };
	}
	return { ok: true, brief };
}

export function screenJson() {
	return screenId ? screenCanonicalJson(screenId) : null;
}

export const ROTATION_MS = PLACEHOLDER_ROTATION_MS;

export function resetOnboarding(): void {
	scenarioId = null;
	screenId = null;
	page = 1;
	stockQuery = "";
	placeholderIndex = 0;
	focused = false;
	composing = false;
	modal = null;
	keepOutsideScreen = true;
}

export function hydrateSessionContext(ctx: { scenarioId?: ScenarioId | null; screenId?: string | null }): void {
	scenarioId = ctx.scenarioId ?? null;
	screenId = ctx.screenId ?? null;
	page = 1;
	placeholderIndex = 0;
}

type ContextPersist = (ctx: { scenarioId: ScenarioId | null; screenId: string | null }) => void;
let persistContext: ContextPersist | null = null;

export function setOnboardingPersist(fn: ContextPersist | null): void {
	persistContext = fn;
}

function persistNow(): void {
	persistContext?.({ scenarioId, screenId });
}
