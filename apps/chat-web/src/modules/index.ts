/**
 * The module loader (ADR 0041): the one place the app names a module. `__MODULE_CHAT__` is a build-time constant
 * (`VITE_MODULE_CHAT`); when it is false the bundler drops the branch and the chat module is not in the bundle.
 * Called once before the first render (`hooks.client.ts`).
 */
import { registerModule } from "$lib/modules/registry.svelte";

export async function loadModules(): Promise<void> {
	if (__MODULE_CHAT__) registerModule((await import("./chat")).chatModule);
}
