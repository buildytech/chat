import { PLACEHOLDERS, PLACEHOLDER_ROTATION_MS, type ScenarioId } from "@buildytech/builder-core";

/**
 * Chat home state. Scenario and screen picking used to live here and filter a Stock screen list into the brief.
 * Screens and blocks are added from the Blocks tab now, so this module only rotates the empty-composer placeholder
 * and remembers the selected chat's recorded scenario / screen for the page that Blocks already started.
 */

let scenarioId = $state<ScenarioId | null>(null);
let screenId = $state<string | null>(null);
let placeholderIndex = $state(0);
let focused = $state(false);
let composing = $state(false);
let modelOpen = $state(false);

export function getScenarioId(): ScenarioId | null {
	return scenarioId;
}

export function getScreenId(): string | null {
	return screenId;
}

export function getFocused(): boolean {
	return focused;
}

export function getComposing(): boolean {
	return composing;
}

export function getModelOpen(): boolean {
	return modelOpen;
}

export function currentPlaceholder(): string {
	const list = PLACEHOLDERS.default;
	return list[placeholderIndex % list.length] ?? list[0];
}

export function setFocused(next: boolean): void {
	focused = next;
}

export function setComposing(next: boolean): void {
	composing = next;
}

export function openModelDialog(): void {
	modelOpen = true;
}

export function closeModelDialog(): void {
	modelOpen = false;
}

export function rotatePlaceholder(hidden: boolean, reducedMotion: boolean): void {
	if (hidden || focused || composing || reducedMotion || modelOpen) return;
	const list = PLACEHOLDERS.default;
	placeholderIndex = (placeholderIndex + 1) % list.length;
}

export function resetPlaceholders(): void {
	placeholderIndex = 0;
}

export function sendBrief(draft: string): { ok: true; brief: string } | { ok: false; code: string } {
	const text = draft.trim();
	if (!text) return { ok: false, code: "empty_brief" };
	return { ok: true, brief: text };
}

export const ROTATION_MS = PLACEHOLDER_ROTATION_MS;

export function resetOnboarding(): void {
	scenarioId = null;
	screenId = null;
	placeholderIndex = 0;
	focused = false;
	composing = false;
	modelOpen = false;
}

export function hydrateSessionContext(ctx: { scenarioId?: ScenarioId | null; screenId?: string | null }): void {
	scenarioId = ctx.scenarioId ?? null;
	screenId = ctx.screenId ?? null;
	placeholderIndex = 0;
}
