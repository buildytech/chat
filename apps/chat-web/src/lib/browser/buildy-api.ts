/**
 * `window.buildy`: the portable session of this browser (ADR 0015). `export()` returns the session file buildy:v1
 * (https://schema.buildy.tw/session.schema.json) and, with `{ download: true }`, saves it as a .json file that Lab
 * BuildY and every BuildY host open. `import(json)` checks a file (schema + program checks) and loads it; a failing
 * file changes nothing. Holds no credential: provider keys and Basic Auth never enter a session.
 */
import { catalogProvenance } from "@buildytech/builder-core";
import { SESSION_FORMAT, SESSION_SCHEMA_URL } from "@buildytech/page-contract/session";
import chatPackage from "../../../package.json";
import { emit, fileKinds, sessionSettingsModules } from "../modules/registry.svelte.ts";
import { openProject } from "../modules/workspace.svelte.ts";
import type { ModuleImportResult } from "../modules/types.ts";
import { exportProjects, importProjects, type ImportResult } from "../project/file.svelte.ts";
import { theme } from "../theme/theme.svelte";
import { creatorLayout } from "../creator-layout.svelte";
import { previewSettings } from "./preview-settings.svelte";
import type { SessionApp, SessionFile, SessionPins, SessionSettings } from "./session-file.ts";

declare const __BUILDY_APP_COMMIT__: string;
declare const __BUILDY_PINS__: Pick<SessionPins, "stock" | "registry">;

export type BuildyApi = {
	readonly format: typeof SESSION_FORMAT;
	readonly schema: string;
	export(options?: { download?: boolean }): SessionFile;
	/** A session file buildy:v1, or a file a loaded module opens (the chat: a Stock collection buildy-collection:v1 in a new Build chat). */
	import(json: unknown): Promise<ImportResult | ModuleImportResult>;
};

function app(): SessionApp {
	const commit = typeof __BUILDY_APP_COMMIT__ === "string" ? __BUILDY_APP_COMMIT__ : "";
	return {
		name: "buildy-chat",
		version: chatPackage.version,
		host: "browser",
		...(/^[0-9a-f]{7,40}$/.test(commit) ? { commit } : {})
	};
}

/** Pins of this build: the Stock content commit and the registry source commit (catalog/snapshot.config.json). */
export function sessionPins(): SessionPins {
	return {
		...__BUILDY_PINS__,
		catalogDigest: catalogProvenance().sourceDigest
	};
}

function settings(): SessionSettings {
	return {
		theme: theme.mode,
		previewHideServiceLabels: previewSettings.hideServiceLabels,
		...Object.assign({}, ...sessionSettingsModules().map((m) => m.read()))
	};
}

function applySettings(input: SessionSettings | undefined): void {
	if (!input) return;
	for (const module of sessionSettingsModules()) module.apply(input);
	if (typeof input.previewHideServiceLabels === "boolean") previewSettings.setHideServiceLabels(input.previewHideServiceLabels);
	if (input.theme) theme.setPref(input.theme);
}

function download(file: SessionFile): void {
	if (typeof document === "undefined") return;
	const blob = new Blob([JSON.stringify(file, null, 2) + "\n"], { type: "application/json" });
	const href = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = href;
	anchor.download = `buildy-session-${file.exportedAt.replace(/[:.]/g, "-")}.json`;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(href);
}

/** The session file of this browser; `download` also saves it as a .json file (Settings > Export, `buildy.export()`). */
export function exportSessionFile(options?: { download?: boolean }): SessionFile {
	const file = exportProjects({ app: app(), pins: sessionPins(), settings: settings(), prefs: { layout: { ...creatorLayout.layout } } });
	if (options?.download) download(file);
	return file;
}

/** Check and load a session file (Settings > Import, `buildy.import(json)`); a failing file changes nothing. */
export async function importSessionFile(json: unknown): Promise<ImportResult> {
	const result = importProjects(json, () => emit("beforeProjectChange"));
	if (result.ok && result.selected) await openProject(result.selected, { history: "replace" });
	if (result.ok) {
		const parsed = typeof json === "string" ? (JSON.parse(json) as SessionFile) : (json as SessionFile);
		applySettings(parsed.settings);
		// A file with prefs brings its layout (clamped to this host); without prefs this browser keeps its own.
		if (parsed.prefs?.layout) creatorLayout.replace(parsed.prefs.layout);
	}
	return result;
}

/** Parsed JSON of a file or string; null when it is not JSON (the session reader reports that). */
function parsedJson(json: unknown): unknown {
	if (typeof json !== "string") return json;
	try {
		return JSON.parse(json);
	} catch {
		return null;
	}
}

/**
 * Settings > Import and `buildy.import(json)`: the reader is picked by `format`. A file a loaded module claims (the
 * chat: a Stock collection buildy-collection:v1, which opens in a new Build chat with the same checks as an Open in
 * BuildY link) goes to that module; everything else is read as a session file.
 */
export async function importFile(json: unknown): Promise<ImportResult | ModuleImportResult> {
	const parsed = parsedJson(json);
	const kind = fileKinds().find((candidate) => candidate.detect(parsed));
	if (kind) return kind.open(parsed);
	return importSessionFile(json);
}

export function installBuildyApi(): void {
	if (typeof window === "undefined") return;
	const api: BuildyApi = {
		format: SESSION_FORMAT,
		schema: SESSION_SCHEMA_URL,
		export: exportSessionFile,
		import: importFile
	};
	Object.defineProperty(window, "buildy", { value: Object.freeze(api), configurable: true, enumerable: false, writable: false });
}
