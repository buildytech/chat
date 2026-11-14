/**
 * The builder module port (ADR 0041). A module (chat is the first) adds panels, slots, hooks and project extensions to
 * the page builder; the builder core knows only this contract and never imports a module (a gate script enforces it).
 * A module is on or off for a whole build (`VITE_MODULE_CHAT`): off, its code, strings and routes are not in the bundle.
 */
import type { Component } from "svelte";
import type { SessionSettings } from "../browser/session-file.ts";
import type { Project } from "../project/types.ts";

/**
 * Places in the core UI where a module renders a component, with the props the core passes (a module reads the rest from
 * its own state). `preview.review`: the preview's status area (a candidate page waiting for Apply or Discard).
 * `block.actions`: a block's provenance row in the preview.
 */
export type SlotProps = {
	"preview.review": Record<string, never>;
	"block.actions": { blockId: string };
};
export type SlotName = keyof SlotProps;

/** A tab of the left panel (next to Blocks and Sections). `labelKey` and the icon belong to the module. Its panel stays mounted while hidden. */
export type ModuleTab = { id: string; labelKey: string; icon: Component; panel: Component };

export type ProjectOpenedEvent = {
	/** The project now selected, or null when none is. */
	project: Project | null;
	reason: "hydrate" | "select" | "create" | "delete";
	/** The id a select or the URL asked for when no such project exists. */
	missing?: string | null;
};

/** Called by the workspace controller; every hook is optional and synchronous unless its type says otherwise. */
export type ModuleHooks = {
	/** Before the selected project changes (select, create, delete, import): stop work that belongs to the old one. */
	beforeProjectChange?: () => void;
	projectOpened?: (event: ProjectOpenedEvent) => void;
	/** Before the projects are read from storage; the value goes to `afterHydrate` (for example a launch parameter read once). */
	beforeHydrate?: () => unknown;
	afterHydrate?: (token: unknown) => void | Promise<void>;
	/** An empty page was started in the selected project (an add from the Blocks feed, the Inspector). */
	pageStarted?: (screenId: string | null) => void;
};

/** What opening a module's file answers: whether it opened, and the line Settings shows (localized by the module). */
export type ModuleImportResult = { ok: boolean; note: string; [key: string]: unknown };
/** A file the Import action can open besides the session file; the first module whose `detect` accepts the parsed value reads it. */
export type ModuleFileKind = { detect: (parsed: unknown) => boolean; open: (parsed: unknown) => Promise<ModuleImportResult> };

export type BuilderModule = {
	/** Unique id, also the project extension name (`ext.<id>`). */
	id: string;
	/** `en` and `ru` message catalogs; keys are the module's own (never a core key). `overrides` re-words core keys while the module is loaded. */
	messages?: { en: Record<string, string>; ru: Record<string, string> };
	messageOverrides?: { en: Record<string, string>; ru: Record<string, string> };
	/** Flat session keys documents before session 1.10.0 kept for this module; read into `ext.<id>` on load, never written. */
	legacyKeys?: readonly string[];
	/** What a new project starts with: title and `ext`. Without a module the title is `page.untitled` and `ext` is empty. */
	newProject?: () => { title: string; ext: Project["ext"] };
	tabs?: readonly ModuleTab[];
	/** How the left panel is named where the shell shows it (mobile switch, region, Ctrl+B toggle); the core default names the panel by its Blocks. */
	leftSurface?: { icon: Component; tabKey: string; regionKey: string; hideKey: string; showKey: string };
	slots?: { [N in SlotName]?: Component<SlotProps[N]> };
	hooks?: ModuleHooks;
	/** True when the module has content in the project (a conversation): the left panel then opens on the remembered tab, not on Blocks. */
	hasActivity?: (project: Project | null) => boolean;
	/** `edit`: the module's mode switch is on Build, or there is none. Read inside `$derived`. */
	editorMode?: () => "build" | "ask";
	/** Open a Stock screen as a new page the module's own way (a recorded proposal); null/undefined falls back to the core start. */
	startPageFromScreen?: (screenId: string) => Promise<{ ok: true } | { ok: false; code: string; message: string }>;
	/** Settings the module keeps in a session file (`settings`). */
	sessionSettings?: { read: () => Partial<SessionSettings>; apply: (settings: SessionSettings) => void };
	fileKinds?: readonly ModuleFileKind[];
	/** Run once when the module registers (browser only). */
	install?: () => void;
};
