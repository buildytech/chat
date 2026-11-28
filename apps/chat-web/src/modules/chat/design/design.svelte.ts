/**
 * Design mode (ADR 0070): the fourth composer mode. A taste agent writes a brand brief and a magazine-theme v2
 * config into this project's Brand Skins (`ext.design`). It never changes AgentMode (ask|build).
 */
import { getSelectedModelId } from "../browser/models.svelte.ts";
import { effectiveProvider, getRoleChoices, noteSpend } from "../browser/providers.svelte.ts";
import { getSelectedProject, putProject } from "../../../lib/project/store.svelte.ts";
import { t } from "../../../lib/i18n/dictionary";
import { saveBrandSkin } from "../../../lib/theme/brand-skins.svelte.ts";
import { brandSkinOf, brandSkinsOf, designExtOf, editedBrandSkin, newBrandSkinId, revisionOf, sameBrandSkinContent, withDesignExt, type BrandSkinRecord, type DesignExt, type DesignMessage } from "../../../lib/theme/brand-skins.ts";
import { runDesignTurn, type DesignBase } from "../../../lib/theme/design-turn.ts";
import { completeDesign } from "./client.ts";

let busy = $state(false);
let lastError = $state<string | null>(null);
let abort: AbortController | null = null;

const uid = (prefix: string): string => `${prefix}-${crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`}`;

function writeExt(change: (prev: DesignExt) => DesignExt): void {
	const project = getSelectedProject();
	if (!project) return;
	putProject(withDesignExt(project, change));
}

// Edit or create (ADR 0072): a Design turn edits a Brand Skin of the project, the active one unless another is picked;
// "Create new" makes the next turn start a fresh skin. After a turn the skin it made or changed is the active one.
let newRequested = $state(false);
let pickedId = $state<string | null>(null);

/** The Brand Skin the next Design turn edits: the picked one, else the project's active skin when it is a Brand Skin; null: a new skin. */
export function designEditTarget(): BrandSkinRecord | null {
	const project = getSelectedProject();
	if (!project || newRequested) return null;
	return brandSkinOf(project, pickedId ?? project.skin ?? null) ?? brandSkinOf(project, project.skin ?? null);
}
export const designNewRequested = (): boolean => newRequested;
/** Edit this skin on the next turn. */
export function pickDesignSkin(id: string): void {
	newRequested = false;
	pickedId = id;
}
/** The explicit "Create new": the next turn writes a new Brand Skin instead of editing one. */
export function requestNewDesignSkin(): void {
	newRequested = true;
}

const baseOf = (record: BrandSkinRecord): DesignBase => ({ id: record.id, name: record.name, revision: revisionOf(record), brief: record.brief, theme: record.theme });

export const designBusy = (): boolean => busy;
export const designError = (): string | null => lastError;
export const designMessages = (): DesignMessage[] => designExtOf(getSelectedProject()).messages ?? [];

export function abortDesignTurn(): void {
	abort?.abort();
}

function pushMessage(message: DesignMessage): void {
	writeExt((prev) => ({ ...prev, messages: [...(prev.messages ?? []), message].slice(-50) }));
}

type Proposal = Extract<Awaited<ReturnType<typeof runDesignTurn>>, { ok: true }>["proposal"];

function reply(text: string, extra: Partial<DesignMessage> = {}): void {
	pushMessage({ id: uid("msg"), role: "assistant", text, createdAt: new Date().toISOString(), ...extra });
}

/** The host accepted an edit of `editing`: same id, next revision, selected; an answer that changes nothing is only reported. */
function acceptEdit(editing: BrandSkinRecord, proposal: Proposal): void {
	if (sameBrandSkinContent(editing, proposal)) {
		reply(t("design.noChange").replace("{name}", editing.name), { skinId: editing.id, revision: revisionOf(editing) });
		return;
	}
	const record = saveBrandSkin(editedBrandSkin(editing, proposal), true);
	pickedId = null;
	reply(t("design.updated").replace("{name}", record.name).replace("{revision}", String(revisionOf(record))), { skinId: record.id, revision: revisionOf(record) });
}

/** The host accepted a new skin: stored under a fresh id (revision 1) and selected; the next turn edits it. */
function acceptNew(proposal: Proposal, project: NonNullable<ReturnType<typeof getSelectedProject>>): void {
	const used = new Set(brandSkinsOf(project).map((item) => item.id));
	const record = saveBrandSkin(
		{
			id: newBrandSkinId(proposal.brief.name, used),
			name: proposal.brief.name,
			createdAt: new Date().toISOString(),
			source: "design",
			brief: proposal.brief,
			theme: proposal.theme,
			contract: proposal.contract,
			revision: 1
		},
		true
	);
	newRequested = false;
	pickedId = null;
	reply(t("design.applied").replace("{name}", record.name), { skinId: record.id, revision: 1 });
}

/** Composer send in Design mode: run the taste agent and, if the host accepts the proposal, store a Brand Skin. */
export async function designSend(text: string): Promise<void> {
	const trimmed = text.trim();
	if (!trimmed || busy) return;
	const project = getSelectedProject();
	if (!project) {
		lastError = t("design.needProject");
		return;
	}
	abort?.abort();
	abort = new AbortController();
	busy = true;
	lastError = null;
	const editing = designEditTarget();
	const at = new Date().toISOString();
	pushMessage({ id: uid("msg"), role: "user", text: trimmed, createdAt: at });
	try {
		const design = getRoleChoices().design;
		const modelId = !design.same ? design.model : getSelectedModelId();
		const provider = effectiveProvider("design");
		if (provider === "off") {
			lastError = t("design.failed");
			reply(lastError);
			return;
		}
		const result = await runDesignTurn(trimmed, async (messages, signal) => {
			const out = await completeDesign(messages, modelId, provider, signal);
			noteSpend("design", provider, out.ticks);
			return out.text;
		}, abort.signal, editing ? baseOf(editing) : undefined);
		if (result.ok) {
			if (editing) acceptEdit(editing, result.proposal);
			else acceptNew(result.proposal, getSelectedProject() ?? project);
			return;
		}
		const issues = result.issues;
		const detail = result.code && result.message ? `${result.message} (${result.code})` : (result.message ?? t("design.rejected"));
		lastError = issues.length ? (result.message ?? t("design.rejected")) : detail;
		reply(issues.length ? issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n") : detail, { issues });
	} catch (error) {
		const aborted = abort.signal.aborted || (error instanceof Error && error.name === "AbortError");
		lastError = t(aborted ? "design.cancelled" : "design.failed");
		if (!aborted) reply(lastError);
	} finally {
		busy = false;
	}
}
