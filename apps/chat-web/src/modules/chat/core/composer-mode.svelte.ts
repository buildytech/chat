/**
 * Composer modes (ADR 0011, 0060, 0070): the author picks Ask, Build, Media or Design.
 * Ask and Build are AgentMode (session ext.chat.mode). Media and Design are project flags
 * (`ext.media.active`, `ext.design.active`) and are never written to the AgentMode enum.
 */
import { type AgentMode } from "@buildytech/chat-agent";
import { getSelectedProject, putProject } from "../../../lib/project/store.svelte.ts";
import { getChatMode, setChatMode } from "./chat.svelte.ts";

export type ComposerMode = AgentMode | "media" | "design";
export const COMPOSER_MODES: readonly ComposerMode[] = ["ask", "build", "media", "design"];

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

function extFlag(name: "media" | "design"): boolean {
	const ext: unknown = getSelectedProject()?.ext[name];
	return isRecord(ext) && ext.active === true;
}

let pending: ComposerMode | null = $state(null);

export function getComposerMode(): ComposerMode {
	const project = getSelectedProject();
	if (project) {
		if (extFlag("design")) return "design";
		if (extFlag("media")) return "media";
		return getChatMode();
	}
	if (pending === "design" || pending === "media") return pending;
	return getChatMode();
}

export function setComposerMode(mode: ComposerMode): void {
	pending = mode === "media" || mode === "design" ? mode : null;
	const project = getSelectedProject();
	if (project) {
		const mediaOn = mode === "media";
		const designOn = mode === "design";
		const media = isRecord(project.ext.media) ? project.ext.media : {};
		const design = isRecord(project.ext.design) ? project.ext.design : {};
		const nextMedia = { ...media, active: mediaOn };
		const nextDesign = { ...design, active: designOn };
		const same = media.active === mediaOn && design.active === designOn;
		if (!same) {
			putProject({
				...project,
				ext: { ...project.ext, media: nextMedia, design: nextDesign }
			});
		}
	}
	if (mode === "ask" || mode === "build") setChatMode(mode);
}
