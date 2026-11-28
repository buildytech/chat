/**
 * A provider per role (ADR 0068), pure logic (node tests import it): what each provider of the host can serve, the
 * owner's approved-model lists, the role choices kept on this device, and the status a role's turn runs against.
 * The host enforces its own rules (keys, allowlists, approved lists on the desktop); this only narrows the choices.
 */
import { IMAGE_MODELS, APPROVED_ID_PATTERN, APPROVED_MAX_IDS, PROVIDER_IDS, PROVIDER_ROLES, appModelIds, isProviderId, openRouterModel, type ModelKind, type ProviderId, type ProviderRole } from "@buildytech/chat-agent";

/** host_unavailable: this host cannot serve the provider at all (OpenRouter on the web). */
type ProviderState = "ready" | "not_configured" | "limit" | "unavailable" | "host_unavailable";

/** One provider as the app reads it; `chat` in app model ids, `rawChat` and `image` in the provider's own ids. */
export type ProviderView = { id: ProviderId; state: ProviderState; keySource: string | null; roles: readonly ProviderRole[]; chat: string[]; rawChat: string[]; image: string[]; pending: boolean };

type StatusEntry = { id?: unknown; state?: unknown; key?: { present?: unknown; source?: unknown }; roles?: unknown; models?: { chat?: unknown; image?: unknown }; pending?: unknown };
export type ProvidersStatus = {
	ready?: boolean;
	code?: string;
	key?: { present: boolean; source?: string | null };
	models?: { listed?: boolean; chatIds?: string[]; imageIds?: string[]; candidate?: string | null };
	capabilities?: { settings?: string[]; keys?: string[]; signIn?: string[] };
	providers?: StatusEntry[];
	provider?: { id: "xai" | "openrouter" };
};

const isRecord = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const field = (v: unknown, name: string): unknown => (isRecord(v) ? v[name] : undefined);
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);
const STATES: readonly ProviderState[] = ["ready", "not_configured", "limit", "unavailable"];
const isState = (value: unknown): value is ProviderState => STATES.some((s) => s === value);
const ROLES: readonly ProviderRole[] = PROVIDER_ROLES;
/** Only the picture model the host draws with (IMAGE_MODELS): a key may list more. */
const drawn = (id: ProviderId, ids: string[]): string[] => ids.filter((model) => model === IMAGE_MODELS[id]);

/** The providers of a status: the desktop lists them; a web host serves xAI only (read from the top-level fields). */
export function providerViews(status: ProvidersStatus | null): ProviderView[] {
	if (status && Array.isArray(status.providers)) {
		const out: ProviderView[] = [];
		for (const entry of status.providers) {
			if (!isProviderId(entry.id)) continue;
			const rawChat = strings(entry.models?.chat);
			out.push({
				id: entry.id,
				state: isState(entry.state) ? entry.state : "unavailable",
				keySource: entry.key?.present === true && typeof entry.key.source === "string" ? entry.key.source : null,
				roles: ROLES.filter((role) => strings(entry.roles).includes(role)),
				chat: entry.id === "openrouter" ? appModelIds(rawChat) : rawChat,
				rawChat,
				image: drawn(entry.id, strings(entry.models?.image)),
				pending: entry.pending === true
			});
		}
		return PROVIDER_IDS.map((id) => out.find((p) => p.id === id) ?? { id, state: "host_unavailable", keySource: null, roles: [], chat: [], rawChat: [], image: [], pending: false });
	}
	const present = status?.key?.present === true;
	const chat = status?.models?.listed ? strings(status.models.chatIds) : [];
	const xai: ProviderView = {
		id: "xai",
		state: !present ? "not_configured" : status?.ready ? "ready" : "unavailable",
		keySource: present ? (status?.key?.source ?? "server") : null,
		roles: ROLES,
		chat,
		rawChat: chat,
		image: drawn("xai", strings(status?.models?.imageIds)),
		pending: false
	};
	return [xai, { id: "openrouter", state: "host_unavailable", keySource: null, roles: [], chat: [], rawChat: [], image: [], pending: false }];
}

// ---- approved-model lists ----

export type ApprovedDoc = Record<ProviderId, Record<ModelKind, string[] | null>>;

const emptyApproved = (): ApprovedDoc => ({ xai: { chat: null, image: null }, openrouter: { chat: null, image: null } });

/** Reads a stored or answered document; anything else is "nothing narrowed". */
export function readApproved(value: unknown): ApprovedDoc {
	const doc = emptyApproved();
	for (const id of PROVIDER_IDS) {
		const kinds = field(value, id);
		if (!isRecord(kinds)) continue;
		for (const kind of ["chat", "image"] as const) if (Array.isArray(kinds[kind])) doc[id][kind] = strings(kinds[kind]);
	}
	return doc;
}

const ID_RE = new RegExp(APPROVED_ID_PATTERN);

/** A textarea's lines as a list: trimmed, no blanks or repeats; the first bad line, or too many ids, is an error. */
export function parseApprovedText(text: string): { ok: true; ids: string[] } | { ok: false; line: string | null } {
	const ids: string[] = [];
	for (const raw of text.split(/\r?\n/)) {
		const id = raw.trim();
		if (!id || ids.includes(id)) continue;
		if (!ID_RE.test(id)) return { ok: false, line: id };
		ids.push(id);
	}
	return ids.length > APPROVED_MAX_IDS ? { ok: false, line: null } : { ok: true, ids };
}

/** Whether the approved list lets a model through (null: not narrowed). OpenRouter chat lists name OpenRouter ids. */
function approvedChat(doc: ApprovedDoc, provider: ProviderId, appId: string): boolean {
	const list = doc[provider].chat;
	if (list === null) return true;
	const id = provider === "openrouter" ? openRouterModel(appId)?.id : appId;
	return Boolean(id && list.includes(id));
}

const approvedImage = (doc: ApprovedDoc, provider: ProviderId, id: string): boolean => doc[provider].image === null || Boolean(doc[provider].image?.includes(id));

/** The chat models a role can pick on a provider: served by the host with that key, and approved. */
export const chatChoices = (view: ProviderView, doc: ApprovedDoc): string[] => view.chat.filter((id) => approvedChat(doc, view.id, id));
export const imageChoices = (view: ProviderView, doc: ApprovedDoc): string[] => (view.roles.includes("media") ? view.image.filter((id) => approvedImage(doc, view.id, id)) : []);

// ---- role choices (this device) ----

export type MediaProvider = ProviderId | "off";
export type FollowBuild = { same: true } | { same: false; provider: ProviderId; model: string };
export type RoleChoices = { build: { provider: ProviderId | null }; ask: FollowBuild; design: FollowBuild; media: { provider: MediaProvider | null; model?: string } };

const defaultChoices = (): RoleChoices => ({ build: { provider: null }, ask: { same: true }, design: { same: true }, media: { provider: null } });

export function readChoices(value: unknown): RoleChoices {
	const out = defaultChoices();
	const build = field(field(value, "build"), "provider");
	if (isProviderId(build)) out.build = { provider: build };
	const follow = (name: "ask" | "design"): FollowBuild => {
		const row = field(value, name);
		const provider = field(row, "provider");
		const model = field(row, "model");
		return field(row, "same") === false && isProviderId(provider) && typeof model === "string" ? { same: false, provider, model } : { same: true };
	};
	out.ask = follow("ask");
	out.design = follow("design");
	const media = field(field(value, "media"), "provider");
	const mediaModel = field(field(value, "media"), "model");
	if (media === "off" || isProviderId(media)) out.media = { provider: media, ...(typeof mediaModel === "string" ? { model: mediaModel } : {}) };
	return out;
}

const usable = (view: ProviderView | undefined, role: ProviderRole): boolean => Boolean(view && view.roles.includes(role) && view.state !== "not_configured" && view.state !== "host_unavailable");

/**
 * The provider a role uses: the stored choice (kept even when it cannot serve now: the row says why, nothing switches by
 * itself), else the default: Build on OpenRouter when it is there (ADR 0067), else xAI; Media on xAI when it has a key,
 * else off. Ask and Design follow Build unless they have their own.
 */
export function roleProvider(role: ProviderRole, choices: RoleChoices, views: ProviderView[]): ProviderId | "off" {
	const view = (id: ProviderId) => views.find((p) => p.id === id);
	if (role === "media") {
		if (choices.media.provider) return choices.media.provider;
		return usable(view("xai"), "media") ? "xai" : "off";
	}
	const own = role === "ask" ? choices.ask : role === "design" ? choices.design : null;
	if (own && !own.same) return own.provider;
	if (choices.build.provider) return choices.build.provider;
	return usable(view("openrouter"), "build") ? "openrouter" : "xai";
}

/** The picture model Media draws with: the chosen one while it is still offered, else the first offered (none: no draws). */
export function mediaModel(choices: RoleChoices, view: ProviderView | undefined, doc: ApprovedDoc): string | null {
	const offered = view ? imageChoices(view, doc) : [];
	return choices.media.model && offered.includes(choices.media.model) ? choices.media.model : (offered[0] ?? null);
}

// ---- spent per role (this device, since the last reset) ----

type SpendLedger = Record<ProviderRole, Partial<Record<ProviderId, number>>>;
export const emptySpend = (): SpendLedger => ({ build: {}, ask: {}, media: {}, design: {} });

export function readSpend(value: unknown): SpendLedger {
	const out = emptySpend();
	for (const role of ROLES) {
		for (const id of PROVIDER_IDS) {
			const ticks = field(field(value, role), id);
			if (typeof ticks === "number" && Number.isSafeInteger(ticks) && ticks >= 0) out[role][id] = ticks;
		}
	}
	return out;
}

export function addSpend(ledger: SpendLedger, role: ProviderRole, provider: ProviderId, ticks: number | null): SpendLedger {
	if (ticks === null || !Number.isSafeInteger(ticks) || ticks <= 0) return ledger;
	return { ...ledger, [role]: { ...ledger[role], [provider]: (ledger[role][provider] ?? 0) + ticks } };
}

/** The billed ticks of a run's cost (usage.cost: xAI ticks, OpenRouter's usage.cost in USD converted), or null when none was billed. */
export function costTicks(cost: unknown): number | null {
	if (field(cost, "available") !== true || field(cost, "kind") !== "billed") return null;
	const ticks = field(cost, "ticks");
	const n = typeof ticks === "string" && /^(0|[1-9][0-9]*)$/.test(ticks) ? Number(ticks) : NaN;
	return Number.isSafeInteger(n) ? n : null;
}

/** USD for the Settings rows: 4 decimals under a cent, else 2. */
export function formatTicks(ticks: number): string {
	const usd = ticks / 1e10;
	return `$${usd > 0 && usd < 0.01 ? usd.toFixed(4) : usd.toFixed(2)}`;
}

/** The status a role's turn runs against: that provider's readiness, key and approved models, in app ids. */
export function roleStatus<S extends ProvidersStatus>(status: S, provider: ProviderId, doc: ApprovedDoc): S {
	const view = providerViews(status).find((p) => p.id === provider);
	if (!view) return status;
	const chatIds = chatChoices(view, doc);
	if (!Array.isArray(status.providers)) {
		// A web host: xAI only; the approved list narrows what the selector offers.
		return { ...status, models: { ...status.models, listed: Boolean(status.models?.listed), chatIds } };
	}
	const ready = view.state === "ready" || view.state === "limit";
	const code = ready ? "xai_runtime_ready" : view.state === "not_configured" ? (provider === "xai" ? "xai_api_key_missing" : "openrouter_key_missing") : view.state === "host_unavailable" ? "provider_unavailable" : "xai_models_list_failed";
	return { ...status, ready: ready && chatIds.length > 0, code: ready && !chatIds.length ? "model_not_approved" : code, key: { present: view.keySource !== null, source: view.keySource }, models: { ...status.models, listed: true, chatIds, candidate: chatIds[0] ?? null }, provider: { id: provider } };
}
