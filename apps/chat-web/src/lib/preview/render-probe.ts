/**
 * The browser's render probe (ADR 0038). The SSR bundle of the registry blocks (`render/blocks.mjs`, built by
 * `scripts/build-render-bundle.mjs` into the static site) is loaded on first use and handed to the shared probe
 * (`probeFromModule`): the SAME function and the same compiled blocks the runtime and the coverage script use, so a
 * write is judged identically on every side. Every gated browser write is then probed too: an Inspector edit, a drag and
 * drop or a feed add that makes a component throw is refused with the path of the prop instead of leaving a broken block
 * on the page. A block that only shows nothing (a registry sample that is a placeholder) is accepted (`empty: "allow"`)
 * and the preview says so, as before.
 */
import { installRenderProbe, probeFromModule, type RenderModule } from "@buildytech/builder-core";

/** Path of the compiled blocks inside the site (after the app base path). */
export const RENDER_BUNDLE_PATH = "/render/blocks.mjs";

/** Load the compiled blocks and install the probe; rejects (and installs nothing) when the bundle cannot be loaded. */
export async function loadRenderProbe(url: string): Promise<void> {
	const mod = (await import(/* @vite-ignore */ new URL(url, globalThis.location?.href ?? "http://localhost/").href)) as RenderModule;
	installRenderProbe(probeFromModule(mod), { required: true, empty: "allow" });
}
