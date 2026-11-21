/**
 * Media mode state (t109u): the third composer mode next to Ask and Build. It works on the page Preview shows; the picture
 * itself is the block's `image` prop (written through the inspector's page gate, one undo step per pick), and everything
 * else (art direction, the candidates, what they were drawn from, the cost) is side data of the project in `ext.media`,
 * never in block props, so prop budgets and the session schema stay as they are.
 */
import { getCurrentPage } from "../../../lib/page-store";
import { inspector } from "../../../lib/inspector/inspector.svelte.ts";
import { getSelectedProject, putProject } from "../../../lib/project/store.svelte.ts";
import type { AgentMode } from "@buildytech/chat-agent";
import { getChatMode, setChatMode } from "../core/chat.svelte.ts";
import { generateCandidates } from "./client.ts";
import { defaultStyle, imageSlots, mediaPrompt, type ImageSlot } from "./slots.ts";

type ComposerMode = AgentMode | "media";
export const COMPOSER_MODES: readonly ComposerMode[] = ["ask", "build", "media"];
const CANDIDATES_PER_SLOT = 3;

/** What one slot keeps: the candidates, the description and frame they were drawn from, the picked one, the cost. */
type SlotRecord = { candidates: string[]; alt: string; aspect: string; extra?: string; picked?: string; costUsdTicks?: number; ms?: number; at: string };
type MediaExt = { active?: boolean; style?: string; slots?: Record<string, SlotRecord> };

let pendingMedia = $state(false);
/** In-flight work per block id (memory only: a reload ends it). */
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

export function getComposerMode(): ComposerMode {
	const project = getSelectedProject();
	if (project ? mediaExt().active === true : pendingMedia) return "media";
	return getChatMode();
}

export function setComposerMode(mode: ComposerMode): void {
	const media = mode === "media";
	pendingMedia = media;
	if (getSelectedProject() && Boolean(mediaExt().active) !== media) writeExt((prev) => ({ ...prev, active: media }));
	if (!media) setChatMode(mode);
}

export const mediaStyle = (): string => mediaExt().style ?? defaultStyle(getSelectedProject()?.skin ?? null);
export const setMediaStyle = (style: string): void => writeExt((prev) => ({ ...prev, style: style.trim() }));
export const slotRecord = (blockId: string): SlotRecord | null => mediaExt().slots?.[blockId] ?? null;
export const pageSlots = (): ImageSlot[] => imageSlots(getCurrentPage());
export const isRunning = (blockId: string): boolean => Boolean(running[blockId]);
export const slotError = (blockId: string): string | null => errors[blockId] ?? null;

/** The total billed cost of every drawn slot of this page, in USD (null when nothing reported one). */
export function mediaCostUsd(): number | null {
	const ticks = Object.values(mediaExt().slots ?? {}).reduce((sum, rec) => sum + (rec.costUsdTicks ?? 0), 0);
	return ticks > 0 ? ticks / 1e10 : null;
}

export function setSlotExtra(blockId: string, extra: string): void {
	writeExt((prev) => {
		const rec = prev.slots?.[blockId];
		return { ...prev, slots: { ...prev.slots, [blockId]: { ...(rec ?? { candidates: [], alt: "", aspect: "", at: "" }), extra: extra.trim() } } };
	});
}

/** Draw candidates for one slot (replaces its earlier candidates; the picked picture on the page stays until a new pick). */
export async function generateSlot(blockId: string): Promise<boolean> {
	const slot = pageSlots().find((s) => s.blockId === blockId);
	if (!slot || running[blockId]) return false;
	running = { ...running, [blockId]: {} };
	errors = { ...errors, [blockId]: "" };
	const extra = slotRecord(blockId)?.extra ?? "";
	try {
		const out = await generateCandidates(mediaPrompt(slot, mediaStyle(), extra), slot.aspect, CANDIDATES_PER_SLOT);
		if (!out.ok) {
			errors = { ...errors, [blockId]: `${out.code}: ${out.message}` };
			return false;
		}
		writeExt((prev) => ({ ...prev, slots: { ...prev.slots, [blockId]: { candidates: out.urls, alt: slot.alt, aspect: slot.aspect, ...(extra ? { extra } : {}), ...(out.costUsdTicks !== null ? { costUsdTicks: out.costUsdTicks } : {}), ms: out.ms, at: new Date().toISOString() } } }));
		return true;
	} catch (err) {
		errors = { ...errors, [blockId]: err instanceof Error ? err.message : String(err) };
		return false;
	} finally {
		running = { ...running, [blockId]: undefined };
	}
}

/** Every slot of the page at once (each slot is its own deferred request on the server). */
export async function generatePage(): Promise<void> {
	await Promise.all(pageSlots().map((slot) => generateSlot(slot.blockId)));
}

/** Put a candidate on the page: the block's `image` prop, through the page gate (one undo step). */
export function pickCandidate(blockId: string, url: string): boolean {
	if (!inspector.run({ op: "set", blockId, pointer: "/image", value: url })) return false;
	writeExt((prev) => {
		const rec = prev.slots?.[blockId];
		return rec ? { ...prev, slots: { ...prev.slots, [blockId]: { ...rec, picked: url } } } : prev;
	});
	return true;
}

/** Composer send in Media mode: the text (if any) becomes the page art direction, then the whole page is drawn. */
export async function mediaSend(text: string): Promise<void> {
	if (text.trim()) setMediaStyle(text);
	await generatePage();
}
