/**
 * Media mode state (t109u): the third composer mode next to Ask and Build. It works on the page Preview shows; the picture
 * itself is the block's `image` prop (written through the inspector's page gate, one undo step per pick), and everything
 * else (art direction, the candidates, what they were drawn from, the cost) is side data of the project in `ext.media`,
 * never in block props, so prop budgets and the session schema stay as they are.
 */
import { getCurrentPage } from "../../../lib/page-store";
import { inspector } from "../../../lib/inspector/inspector.svelte.ts";
import { getSelectedProject, putProject } from "../../../lib/project/store.svelte.ts";
import { MEDIA_SLOT_CONCURRENCY } from "@buildytech/chat-agent";
import { generateCandidates } from "./client.ts";
import { getProviderStatus, mediaDraw, noteSpend, refreshProviders } from "../browser/providers.svelte.ts";
import { t } from "../../../lib/i18n/dictionary";
import { defaultStyle, imageSlots, mediaPrompt, type ImageSlot } from "./slots.ts";

export { COMPOSER_MODES, getComposerMode, setComposerMode, type ComposerMode } from "../core/composer-mode.svelte.ts";
const CANDIDATES_PER_SLOT = 3;

/** What one slot keeps: the candidates, the description and frame they were drawn from, the picked one, the cost. */
/** `provider` / `model`: what drew the candidates (ADR 0068). */
type SlotRecord = { candidates: string[]; alt: string; aspect: string; extra?: string; picked?: string; costUsdTicks?: number; ms?: number; at: string; provider?: string; model?: string };
type MediaExt = { active?: boolean; style?: string; slots?: Record<string, SlotRecord> };

/** In-flight work per slot key (memory only: a reload ends it). */
let running = $state<Record<string, { error?: string } | undefined>>({});
let errors = $state<Record<string, string>>({});

const isMediaExt = (value: unknown): value is MediaExt => Boolean(value) && typeof value === "object" && !Array.isArray(value);

function mediaExt(): MediaExt {
	const ext: unknown = getSelectedProject()?.ext.media;
	return isMediaExt(ext) ? ext : {};
}

function writeExt(change: (prev: MediaExt) => MediaExt): void {
	const project = getSelectedProject();
	if (!project) return;
	putProject({ ...project, ext: { ...project.ext, media: change(mediaExt()) } });
}

export const mediaStyle = (): string => mediaExt().style ?? defaultStyle(getSelectedProject()?.skin ?? null);
export const setMediaStyle = (style: string): void => writeExt((prev) => ({ ...prev, style: style.trim() }));
export const slotRecord = (key: string): SlotRecord | null => mediaExt().slots?.[key] ?? null;
export const pageSlots = (): ImageSlot[] => imageSlots(getCurrentPage());
export const isRunning = (key: string): boolean => Boolean(running[key]);
export const slotError = (key: string): string | null => errors[key] ?? null;

/** The total billed cost of every drawn slot of this page, in USD (null when nothing reported one). */
export function mediaCostUsd(): number | null {
	const ticks = Object.values(mediaExt().slots ?? {}).reduce((sum, rec) => sum + (rec.costUsdTicks ?? 0), 0);
	return ticks > 0 ? ticks / 1e10 : null;
}

export function setSlotExtra(key: string, extra: string): void {
	writeExt((prev) => {
		const rec = prev.slots?.[key];
		return { ...prev, slots: { ...prev.slots, [key]: { ...(rec ?? { candidates: [], alt: "", aspect: "", at: "" }), extra: extra.trim() } } };
	});
}

/** Draw candidates for one slot (replaces its earlier candidates; the picked picture on the page stays until a new pick). */
export async function generateSlot(key: string): Promise<boolean> {
	const slot = pageSlots().find((s) => s.key === key);
	if (!slot || running[key]) return false;
	running = { ...running, [key]: {} };
	errors = { ...errors, [key]: "" };
	const extra = slotRecord(key)?.extra ?? "";
	try {
		if (!getProviderStatus()) await refreshProviders();
		// The Media role's provider and model (ADR 0068): off draws nothing; nothing switches by itself.
		const { provider, model } = mediaDraw();
		if (provider === "off" || !model) {
			errors = { ...errors, [key]: t(provider === "off" ? "media.providerOff" : "media.noApprovedModel") };
			return false;
		}
		const out = await generateCandidates(mediaPrompt(slot, mediaStyle(), extra), slot.aspect, CANDIDATES_PER_SLOT, undefined, { provider, model });
		if (!out.ok) {
			errors = { ...errors, [key]: `${out.code}: ${out.message}` };
			return false;
		}
		noteSpend("media", provider, out.costUsdTicks);
		writeExt((prev) => ({ ...prev, slots: { ...prev.slots, [key]: { candidates: out.urls, alt: slot.alt, aspect: slot.aspect, ...(extra ? { extra } : {}), ...(out.costUsdTicks !== null ? { costUsdTicks: out.costUsdTicks } : {}), ms: out.ms, at: new Date().toISOString(), provider, model } } }));
		return true;
	} catch (err) {
		errors = { ...errors, [key]: err instanceof Error ? err.message : String(err) };
		return false;
	} finally {
		running = { ...running, [key]: undefined };
	}
}

/** Every slot of the page, MEDIA_SLOT_CONCURRENCY at a time (a key's spend limit is not overshot by a burst, ADR 0068). */
export async function generatePage(): Promise<void> {
	const queue = pageSlots().map((slot) => slot.key);
	const worker = async () => {
		for (let key = queue.shift(); key !== undefined; key = queue.shift()) await generateSlot(key);
	};
	await Promise.all(Array.from({ length: Math.min(MEDIA_SLOT_CONCURRENCY, queue.length) }, worker));
}

/** Put a candidate on the page: the slot's `image` prop, through the page gate (one undo step). */
export function pickCandidate(key: string, url: string): boolean {
	const slot = pageSlots().find((s) => s.key === key);
	if (!slot || !inspector.run({ op: "set", blockId: slot.blockId, pointer: slot.pointer, value: url })) return false;
	writeExt((prev) => {
		const rec = prev.slots?.[key];
		return rec ? { ...prev, slots: { ...prev.slots, [key]: { ...rec, picked: url } } } : prev;
	});
	return true;
}

/** Composer send in Media mode: the text (if any) becomes the page art direction, then the whole page is drawn. */
export async function mediaSend(text: string): Promise<void> {
	if (text.trim()) setMediaStyle(text);
	await generatePage();
}
