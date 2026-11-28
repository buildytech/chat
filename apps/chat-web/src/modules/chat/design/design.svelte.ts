/**
 * Design mode (ADR 0070): the fourth composer mode. A taste agent writes a brand brief and a magazine-theme v2
 * config into this project's Brand Skins (`ext.design`). It never changes AgentMode (ask|build).
 */
import { getSelectedModelId } from "../browser/models.svelte.ts";
import { effectiveProvider, getRoleChoices, noteSpend } from "../browser/providers.svelte.ts";
import { getSelectedProject, putProject } from "../../../lib/project/store.svelte.ts";
import { t } from "../../../lib/i18n/dictionary";
import { saveBrandSkin } from "../../../lib/theme/brand-skins.svelte.ts";
import { brandSkinsOf, designExtOf, newBrandSkinId, withDesignExt, type DesignExt, type DesignMessage } from "../../../lib/theme/brand-skins.ts";
import { runDesignTurn } from "../../../lib/theme/design-turn.ts";
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

export const designBusy = (): boolean => busy;
export const designError = (): string | null => lastError;
export const designMessages = (): DesignMessage[] => designExtOf(getSelectedProject()).messages ?? [];

export function abortDesignTurn(): void {
	abort?.abort();
}

function pushMessage(message: DesignMessage): void {
	writeExt((prev) => ({ ...prev, messages: [...(prev.messages ?? []), message].slice(-50) }));
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
	const at = new Date().toISOString();
	pushMessage({ id: uid("msg"), role: "user", text: trimmed, createdAt: at });
	try {
		const design = getRoleChoices().design;
		const modelId = !design.same ? design.model : getSelectedModelId();
		const provider = effectiveProvider("design");
		if (provider === "off") {
			lastError = t("design.failed");
			pushMessage({ id: uid("msg"), role: "assistant", text: lastError, createdAt: new Date().toISOString() });
			return;
		}
		const result = await runDesignTurn(trimmed, async (messages, signal) => {
			const out = await completeDesign(messages, modelId, provider, signal);
			noteSpend("design", provider, out.ticks);
			return out.text;
		}, abort.signal);
		if (result.ok) {
			const used = new Set(brandSkinsOf(getSelectedProject() ?? project).map((item) => item.id));
			const record = saveBrandSkin(
				{
					id: newBrandSkinId(result.proposal.brief.name, used),
					name: result.proposal.brief.name,
					createdAt: new Date().toISOString(),
					source: "design",
					brief: result.proposal.brief,
					theme: result.proposal.theme,
					contract: result.proposal.contract
				},
				true
			);
			pushMessage({
				id: uid("msg"),
				role: "assistant",
				text: t("design.applied").replace("{name}", record.name),
				createdAt: new Date().toISOString(),
				skinId: record.id
			});
			return;
		}
		const issues = result.issues;
		const detail = result.code && result.message ? `${result.message} (${result.code})` : (result.message ?? t("design.rejected"));
		lastError = issues.length ? (result.message ?? t("design.rejected")) : detail;
		pushMessage({
			id: uid("msg"),
			role: "assistant",
			text: issues.length ? issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n") : detail,
			createdAt: new Date().toISOString(),
			issues
		});
	} catch (error) {
		const aborted = abort.signal.aborted || (error instanceof Error && error.name === "AbortError");
		lastError = t(aborted ? "design.cancelled" : "design.failed");
		if (!aborted) {
			pushMessage({
				id: uid("msg"),
				role: "assistant",
				text: lastError,
				createdAt: new Date().toISOString()
			});
		}
	} finally {
		busy = false;
	}
}
