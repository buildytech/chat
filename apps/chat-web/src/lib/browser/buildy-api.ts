/**
 * `window.buildy`: the portable session of this browser (ADR 0015). `export()` returns the session file buildy:v1
 * (https://schema.buildy.tw/session.schema.json) and, with `{ download: true }`, saves it as a .json file that Lab
 * BuildY and every BuildY host open. `import(json)` checks a file (schema + program checks) and loads it; a failing
 * file changes nothing. Holds no credential: provider keys and Basic Auth never enter a session.
 */
import { catalogProvenance } from "@buildytech/builder-core";
import { SESSION_FORMAT, SESSION_SCHEMA_URL } from "@buildytech/page-contract/session";
import snapshotConfig from "../../../../../catalog/snapshot.config.json";
import chatPackage from "../../../package.json";
import { exportSessions, importSessions, openCollectionFile, type CollectionIntake, type ImportResult } from "../../modules/chat/core";
import { isCollectionDoc } from "@buildytech/page-contract/collection";
import { theme } from "../theme/theme.svelte";
import { migrationReport, type MigrationHits } from "./migration-counters.ts";
import { browserStorage } from "./storage-v1.ts";
import { getSelectedModelId, setSelectedModelId } from "../../modules/chat/browser/models.svelte.ts";
import { creatorLayout } from "../creator-layout.svelte";
import { previewSettings } from "./preview-settings.svelte";
import type { SessionApp, SessionFile, SessionPins, SessionSettings } from "./session-file.ts";

declare const __BUILDY_APP_COMMIT__: string;

export type BuildyApi = {
	readonly format: typeof SESSION_FORMAT;
	readonly schema: string;
	export(options?: { download?: boolean }): SessionFile;
	/** A session file buildy:v1, or a Stock collection buildy-collection:v1 (opened in a new Build chat). */
	import(json: unknown): Promise<ImportResult | CollectionIntake>;
	/** Hits of the old-data paths in this browser since this build first ran (refactor plan item 4: a migration goes only when every browser shows zero). */
	migrationReport(): MigrationHits;
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
		stock: { repo: snapshotConfig.codegenX.repo, contentCommit: snapshotConfig.codegenX.commit },
		registry: { url: snapshotConfig.ui8kit.registry, sourceCommit: snapshotConfig.ui8kit.sourceCommit },
		catalogDigest: catalogProvenance().sourceDigest
	};
}

function settings(): SessionSettings {
	return {
		theme: theme.mode,
		selectedModelId: getSelectedModelId(),
		previewHideServiceLabels: previewSettings.hideServiceLabels
	};
}

function applySettings(input: SessionSettings | undefined): void {
	if (!input) return;
	if (input.selectedModelId) setSelectedModelId(input.selectedModelId);
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
	const file = exportSessions({ app: app(), pins: sessionPins(), settings: settings(), prefs: { layout: { ...creatorLayout.layout } } });
	if (options?.download) download(file);
	return file;
}

/** Check and load a session file (Settings > Import, `buildy.import(json)`); a failing file changes nothing. */
export async function importSessionFile(json: unknown): Promise<ImportResult> {
	const result = await importSessions(json);
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
 * Settings > Import and `buildy.import(json)`: the reader is picked by `format`. A Stock collection
 * (buildy-collection:v1, the file Stock downloads when a link would be too long) opens in a new Build chat with the
 * same checks as an Open in BuildY link; everything else is read as a session file.
 */
export async function importFile(json: unknown): Promise<ImportResult | CollectionIntake> {
	const parsed = parsedJson(json);
	if (isCollectionDoc(parsed)) return openCollectionFile(parsed);
	return importSessionFile(json);
}

export function installBuildyApi(): void {
	if (typeof window === "undefined") return;
	const api: BuildyApi = {
		format: SESSION_FORMAT,
		schema: SESSION_SCHEMA_URL,
		export: exportSessionFile,
		import: importFile,
		migrationReport: () => {
			const store = browserStorage();
			return store ? migrationReport(store) : { since: null, lastAt: null, counters: { pageV1: 0, feedScreen: 0, legacyKeys: 0, proposalApplied: 0 }, total: 0 };
		}
	};
	Object.defineProperty(window, "buildy", { value: Object.freeze(api), configurable: true, enumerable: false, writable: false });
}
