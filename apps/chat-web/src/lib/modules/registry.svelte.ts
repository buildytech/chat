/**
 * The module registry (ADR 0041): which builder modules are loaded, and the questions the core UI asks them. Module-level
 * state; `registerModule` runs once per module before the first render (`modules/index.ts`). With no module registered
 * every answer is the builder-only one, so the core runs without chat.
 */
import { registerMessages } from "../i18n/dictionary.ts";
import { registerLegacyKeys } from "../project/doc.ts";
import type { Project } from "../project/types.ts";
import type { Component } from "svelte";
import type { BuilderModule, ModuleFileKind, ModuleHooks, ModuleTab, SlotName, SlotProps } from "./types.ts";

let modules = $state<readonly BuilderModule[]>([]);

export function registerModule(module: BuilderModule): void {
	if (modules.some((m) => m.id === module.id)) return;
	if (module.messages) registerMessages(module.messages, module.messageOverrides);
	if (module.legacyKeys) registerLegacyKeys(module.id, module.legacyKeys);
	module.install?.();
	modules = [...modules, module];
}

export const loadedModules = (): readonly BuilderModule[] => modules;
export const hasModule = (id: string): boolean => modules.some((m) => m.id === id);
export const moduleTabs = (): readonly ModuleTab[] => modules.flatMap((m) => m.tabs ?? []);
export const slotComponents = <N extends SlotName>(name: N): Component<SlotProps[N]>[] => modules.flatMap((m) => (m.slots?.[name] ? [m.slots[name] as Component<SlotProps[N]>] : []));
const CORE_LEFT_SURFACE = { icon: null, tabKey: "shell.tabPanel", regionKey: "shell.leftPanel", hideKey: "workspace.hidePanel", showKey: "workspace.showPanel" } as const;
/** The names of the left panel in the shell: the module's when it brings its own, else the builder's. */
export const leftSurface = (): { icon: Component | null; tabKey: string; regionKey: string; hideKey: string; showKey: string } => modules.find((m) => m.leftSurface)?.leftSurface ?? CORE_LEFT_SURFACE;
export const fileKinds = (): ModuleFileKind[] => modules.flatMap((m) => [...(m.fileKinds ?? [])]);
export const sessionSettingsModules = () => modules.flatMap((m) => (m.sessionSettings ? [m.sessionSettings] : []));

/** True when a module reports content (a conversation) in the project. */
export const projectHasActivity = (project: Project | null): boolean => modules.some((m) => m.hasActivity?.(project) === true);
/** `build` unless a module with a mode switch says `ask`: the manual editor is always available. */
export const editorMode = (): "build" | "ask" => modules.find((m) => m.editorMode)?.editorMode?.() ?? "build";
export const newProjectDefaults = (fallbackTitle: string): { title: string; ext: Project["ext"] } => modules.find((m) => m.newProject)?.newProject?.() ?? { title: fallbackTitle, ext: {} };
export const startPageHook = (): BuilderModule["startPageFromScreen"] => modules.find((m) => m.startPageFromScreen)?.startPageFromScreen;

type Sync = Exclude<keyof ModuleHooks, "beforeHydrate" | "afterHydrate">;
export function emit<K extends Sync>(name: K, ...args: Parameters<NonNullable<ModuleHooks[K]>>): void {
	for (const module of modules) (module.hooks?.[name] as ((...a: unknown[]) => void) | undefined)?.(...args);
}
export const collectBeforeHydrate = (): unknown[] => modules.map((m) => m.hooks?.beforeHydrate?.());
export async function runAfterHydrate(tokens: unknown[]): Promise<void> {
	for (const [i, module] of modules.entries()) await module.hooks?.afterHydrate?.(tokens[i]);
}
