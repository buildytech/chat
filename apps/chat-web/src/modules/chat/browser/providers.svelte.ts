/**
 * Providers per role (ADR 0068), the browser state: the last status's providers, the owner's approved-model lists (the
 * desktop keeps them on the host, GET/PUT /runtime/v1/settings/providers; a web host has no such route, so this device
 * keeps them), and the role choices of this device. The Settings screen reads and changes it; turns and Media read it.
 */
import type { ModelKind, ProviderId, ProviderRole } from "@buildytech/chat-agent";
import { readKey, writeKey } from "../../../lib/browser/storage-v1.ts";
import { fetchXaiStatus } from "./xai-client.ts";
import { noteAccountModels } from "./models.svelte.ts";
import { addSpend, emptySpend, mediaModel, readSpend, providerViews, readApproved, readChoices, roleProvider, roleStatus, type ApprovedDoc, type MediaProvider, type ProvidersStatus, type ProviderView, type RoleChoices } from "./provider-roles.ts";

const ROLES_KEY = "buildy:v1:providerRoles";
const APPROVED_KEY = "buildy:v1:approvedModels";
const SPEND_KEY = "buildy:v1:providerSpend";
const SETTINGS_URL = "/runtime/v1/settings/providers";

function stored(key: string): unknown {
	try {
		const raw = readKey(key);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

let status = $state<ProvidersStatus | null>(null);
let choices = $state<RoleChoices>(readChoices(stored(ROLES_KEY)));
let approved = $state<ApprovedDoc>(readApproved(stored(APPROVED_KEY)));
let hostSettings = $state(false);
let spend = $state(readSpend(stored(SPEND_KEY)));

export const getSpend = () => spend;
/** Adds a billed cost to a role's provider (a turn's usage.cost, a draw's costUsdTicks); unbilled adds nothing. */
export function noteSpend(role: ProviderRole, provider: ProviderId | "off", ticks: number | null): void {
	if (provider === "off") return;
	const next = addSpend(spend, role, provider, ticks);
	if (next === spend) return;
	spend = next;
	writeKey(SPEND_KEY, JSON.stringify(next));
}
export function resetSpend(): void {
	spend = emptySpend();
	writeKey(SPEND_KEY, JSON.stringify(spend));
}

export const getProviderStatus = (): ProvidersStatus | null => status;
export const getProviderViews = (): ProviderView[] => providerViews(status);
export const getApproved = (): ApprovedDoc => approved;
export const getRoleChoices = (): RoleChoices => choices;
/** Whether the host keeps the approved lists (the desktop) rather than this device. */
export const approvedOnHost = (): boolean => hostSettings;
export const hostTakesKeys = (): boolean => Boolean(status?.capabilities?.keys?.includes("xai"));
export const effectiveProvider = (role: ProviderRole): ProviderId | "off" => roleProvider(role, choices, providerViews(status));

/** The status a role's turn runs against (its provider's readiness and approved models). */
export function statusForRole<S extends ProvidersStatus>(raw: S, role: ProviderRole): S {
	const provider = roleProvider(role, choices, providerViews(raw));
	return provider === "off" ? raw : roleStatus(raw, provider, approved);
}

/** Notes a status: the providers, and the Build role's models narrow the composer's selector. */
export function noteProviders<S extends ProvidersStatus & { models?: { listed?: boolean; chatIds?: string[] } }>(raw: S): void {
	status = raw;
	hostSettings = Boolean(raw.capabilities?.settings?.includes("providers"));
	noteAccountModels(statusForRole(raw, "build"));
}

async function readHostApproved(signal?: AbortSignal): Promise<void> {
	const res = await fetch(SETTINGS_URL, { signal, credentials: "same-origin", cache: "no-store", headers: { accept: "application/json" } }).catch(() => null);
	if (!res?.ok) return;
	const body: unknown = await res.json().catch(() => null);
	approved = readApproved(body && typeof body === "object" && "approved" in body ? body.approved : null);
}

/** Reads the status (and on the desktop the host's approved lists) once. */
export async function refreshProviders(signal?: AbortSignal): Promise<void> {
	const raw = await fetchXaiStatus(signal);
	noteProviders(raw);
	if (hostSettings) await readHostApproved(signal);
}

function saveChoices(next: RoleChoices): void {
	choices = next;
	writeKey(ROLES_KEY, JSON.stringify(next));
}

export const setBuildProvider = (provider: ProviderId): void => saveChoices({ ...choices, build: { provider } });
export const setAskSame = (): void => saveChoices({ ...choices, ask: { same: true } });
export const setAskModel = (provider: ProviderId, model: string): void => saveChoices({ ...choices, ask: { same: false, provider, model } });
export const setMediaProvider = (provider: MediaProvider): void => saveChoices({ ...choices, media: { provider } });
export const setMediaModel = (model: string): void => saveChoices({ ...choices, media: { ...choices.media, model } });
/** The Media role's provider and picture model now (null model: nothing it may draw with). */
export function mediaDraw(): { provider: ProviderId | "off"; model: string | null } {
	const provider = effectiveProvider("media");
	if (provider === "off") return { provider, model: null };
	return { provider, model: mediaModel(choices, providerViews(status).find((p) => p.id === provider), approved) };
}

/** Replaces one approved list (null: not narrowed). The desktop host checks and keeps it; else this device keeps it. */
export async function saveApproved(provider: ProviderId, kind: ModelKind, ids: string[] | null): Promise<{ ok: true } | { ok: false; code: string }> {
	const next: ApprovedDoc = { ...approved, [provider]: { ...approved[provider], [kind]: ids } };
	if (!hostSettings) {
		approved = next;
		writeKey(APPROVED_KEY, JSON.stringify(next));
		if (status) noteProviders(status);
		return { ok: true };
	}
	const res = await fetch(SETTINGS_URL, { method: "PUT", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ approved: { [provider]: { [kind]: ids } } }) }).catch(() => null);
	const body: unknown = await res?.json().catch(() => null);
	if (!res?.ok) {
		const error = body && typeof body === "object" && "error" in body ? body.error : null;
		return { ok: false, code: error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : `http_${res?.status ?? 0}` };
	}
	approved = readApproved(body && typeof body === "object" && "approved" in body ? body.approved : next);
	if (status) noteProviders(status);
	return { ok: true };
}

/** The desktop keeps an xAI key in the system keychain (PUT/DELETE /runtime/v1/keys/xai); the key never comes back. */
export async function storeXaiKey(key: string | null): Promise<{ ok: true } | { ok: false; code: string }> {
	const res = await fetch("/runtime/v1/keys/xai", {
		method: key === null ? "DELETE" : "PUT",
		credentials: "same-origin",
		cache: "no-store",
		headers: { "content-type": "application/json", accept: "application/json" },
		...(key === null ? {} : { body: JSON.stringify({ key }) })
	}).catch(() => null);
	if (!res?.ok) {
		const body: unknown = await res?.json().catch(() => null);
		const error = body && typeof body === "object" && "error" in body ? body.error : null;
		return { ok: false, code: error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : `http_${res?.status ?? 0}` };
	}
	await refreshProviders();
	return { ok: true };
}
