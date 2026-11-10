/**
 * `window.buildy`: the portable session of this browser (ADR 0015). `export()` returns the session file buildy:v1
 * (https://schema.buildy.tw/session.schema.json) and, with `{ download: true }`, saves it as a .json file that Lab
 * BuildY and every BuildY host open. `import(json)` checks a file (schema + program checks) and loads it; a failing
 * file changes nothing. Holds no credential: provider keys and Basic Auth never enter a session.
 */
import { catalogProvenance } from "@buildytech/builder-core";
import { SESSION_FORMAT, SESSION_SCHEMA_URL } from "@buildytech/page-contract/session";
import snapshotConfig from "../../../../../catalog/snapshot.config.json";
import { exportSessions, importSessions, type ImportResult } from "../chat-core";
import { theme, THEME_KEY } from "../theme/theme.svelte";
import { getSelectedModelId, setSelectedModelId } from "./models.svelte";
import { previewSettings } from "./preview-settings.svelte";
import type { SessionApp, SessionFile, SessionPins, SessionSettings } from "./session-file.ts";
import { writeKey } from "./storage-v1.ts";

declare const __BUILDY_APP_VERSION__: string;
declare const __BUILDY_APP_COMMIT__: string;

export type BuildyApi = {
	readonly format: typeof SESSION_FORMAT;
	readonly schema: string;
	export(options?: { download?: boolean }): SessionFile;
	import(json: unknown): Promise<ImportResult>;
};

function app(): SessionApp {
	const commit = typeof __BUILDY_APP_COMMIT__ === "string" ? __BUILDY_APP_COMMIT__ : "";
	return {
		name: "buildy-chat",
		version: typeof __BUILDY_APP_VERSION__ === "string" ? __BUILDY_APP_VERSION__ : "0.0.0",
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
	if (input.theme) {
		writeKey(THEME_KEY, input.theme);
		theme.init();
	}
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

export function installBuildyApi(): void {
	if (typeof window === "undefined") return;
	const api: BuildyApi = {
		format: SESSION_FORMAT,
		schema: SESSION_SCHEMA_URL,
		export(options) {
			const file = exportSessions({ app: app(), pins: sessionPins(), settings: settings() });
			if (options?.download) download(file);
			return file;
		},
		async import(json) {
			const result = await importSessions(json);
			if (result.ok) {
				const parsed = typeof json === "string" ? (JSON.parse(json) as SessionFile) : (json as SessionFile);
				applySettings(parsed.settings);
			}
			return result;
		}
	};
	Object.defineProperty(window, "buildy", { value: Object.freeze(api), configurable: true, enumerable: false, writable: false });
}
