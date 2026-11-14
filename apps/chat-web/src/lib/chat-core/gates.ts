import { installRenderProbe } from "@buildytech/builder-core";

/**
 * The write gates of the browser: the props gate (Ajv 2020 over the pinned registry props schemas; its own chunk) and the
 * render probe (the compiled registry blocks, ADR 0038; one file, fetched on first use). `loadPropsGate` loads both, once,
 * before the first proposal is assembled or gated. Until they are installed both are fail-closed (props_gate_unavailable,
 * render_probe_unavailable). The idle prefetch below takes only the props gate; the probe waits for the first write path.
 */
let propsChunk: Promise<unknown> | null = null;
let probeChunk: Promise<unknown> | null = null;
if (typeof window !== "undefined") installRenderProbe(null, { required: true, empty: "allow" });
function importPropsGate(): Promise<unknown> {
	propsChunk ??= import("@buildytech/builder-core/props-gate").catch((err) => {
		propsChunk = null;
		throw err;
	});
	return propsChunk;
}
function importRenderProbe(): Promise<unknown> {
	probeChunk ??= Promise.all([import("../preview/render-probe"), import("$app/paths")]).then(([probe, paths]) => probe.loadRenderProbe(`${paths.base}${probe.RENDER_BUNDLE_PATH}`)).catch((err) => {
		probeChunk = null;
		throw err;
	});
	return probeChunk;
}
export function loadPropsGate(): Promise<unknown> {
	return Promise.all([importPropsGate(), importRenderProbe()]);
}
// Fetch the chunk while the author types; the first send awaits the same promise.
if (typeof window !== "undefined") setTimeout(() => void importPropsGate().catch(() => {}), 0);
