<!-- Providers (ADR 0068), the chat module's section of the Settings screen: one row per role (Build, Ask, Media) with its
     provider, model, state and spend; the approved-model lists per provider and kind; on the desktop the xAI key (kept in
     the system keychain, never shown again) and the OpenRouter sign-in. Nothing switches a provider by itself. -->
<script lang="ts">
	import { onMount } from "svelte";
	import Box from "$registry/compose/Box.svelte";
	import Grid from "$registry/compose/Grid.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Title from "$registry/compose/Title.svelte";
	import Text from "$registry/compose/Text.svelte";
	import Badge from "$registry/compose/Badge.svelte";
	import Button from "$registry/compose/Button.svelte";
	import Input from "$registry/compose/Input.svelte";
	import Label from "$registry/compose/Label.svelte";
	import Select from "$registry/compose/Select.svelte";
	import SelectOption from "$registry/compose/SelectOption.svelte";
	import Textarea from "$registry/compose/Textarea.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { getChatModel, PROVIDER_ROLES, type ModelKind, type ProviderId, type ProviderRole } from "@buildytech/chat-agent";
	import { getSelectedModelId, setSelectedModelId } from "../browser/models.svelte.ts";
	import { approvedOnHost, effectiveProvider, getApproved, getProviderViews, getRoleChoices, getSpend, hostTakesKeys, mediaDraw, refreshProviders, resetSpend, saveApproved, setAskModel, setAskSame, setBuildProvider, setMediaModel, setMediaProvider, storeXaiKey } from "../browser/providers.svelte.ts";
	import { chatChoices, formatTicks, imageChoices, parseApprovedText, type ProviderView } from "../browser/provider-roles.ts";
	import RuntimeSignIn from "./RuntimeSignIn.svelte";

	onMount(() => void refreshProviders().catch(() => undefined));

	const views = $derived(getProviderViews());
	const doc = $derived(getApproved());
	const choices = $derived(getRoleChoices());
	const spend = $derived(getSpend());
	const view = (id: ProviderId | "off"): ProviderView | undefined => views.find((p) => p.id === id);
	const valueOf = (event: Event): string => (event.currentTarget instanceof HTMLSelectElement || event.currentTarget instanceof HTMLTextAreaElement || event.currentTarget instanceof HTMLInputElement ? event.currentTarget.value : "");
	const modelLabel = (id: string): string => getChatModel(id)?.label ?? id;

	type Row = { role: ProviderRole; provider: ProviderId | "off"; providerValue: string; providers: ProviderView[]; models: string[]; model: string | null; modelDisabled: boolean; state: string; spent: string };

	function row(role: ProviderRole): Row {
		const provider = effectiveProvider(role);
		const current = view(provider);
		const providers = views.filter((p) => p.roles.includes(role));
		const spent = formatTicks(Object.values(spend[role]).reduce((sum, ticks) => sum + (ticks ?? 0), 0));
		const state = provider === "off" ? "off" : (current?.state ?? "host_unavailable");
		if (role === "media") {
			const draw = mediaDraw();
			return { role, provider, providerValue: provider, providers, models: current ? imageChoices(current, doc) : [], model: draw.model, modelDisabled: provider === "off", state, spent };
		}
		const same = role === "ask" && choices.ask.same;
		const model = role === "ask" && !choices.ask.same ? choices.ask.model : getSelectedModelId();
		return { role, provider, providerValue: same ? "same" : provider, providers, models: current ? chatChoices(current, doc) : [], model, modelDisabled: same, state, spent };
	}
	const rows = $derived(PROVIDER_ROLES.map(row));

	function chooseProvider(role: ProviderRole, value: string) {
		if (role === "build" && (value === "xai" || value === "openrouter")) setBuildProvider(value);
		if (role === "ask") {
			if (value === "same") setAskSame();
			else if (value === "xai" || value === "openrouter") setAskModel(value, chatChoices(view(value) ?? views[0], doc)[0] ?? getSelectedModelId());
		}
		if (role === "media" && (value === "xai" || value === "openrouter" || value === "off")) setMediaProvider(value);
	}

	function chooseModel(r: Row, id: string) {
		if (r.role === "build") setSelectedModelId(id);
		if (r.role === "ask" && r.provider !== "off") setAskModel(r.provider, id);
		if (r.role === "media") setMediaModel(id);
	}

	const STATE_VARIANT: Record<string, string> = { ready: "default", limit: "destructive", unavailable: "destructive" };

	// ---- approved lists ----
	const listed = $derived(views.filter((p) => p.state !== "host_unavailable"));
	const kindsOf = (p: ProviderView): ModelKind[] => [...(p.roles.includes("build") ? (["chat"] as const) : []), ...(p.roles.includes("media") ? (["image"] as const) : [])];
	let drafts = $state<Record<string, string>>({});
	let notes = $state<Record<string, string>>({});
	const listKey = (id: ProviderId, kind: ModelKind) => `${id}-${kind}`;
	const textOf = (id: ProviderId, kind: ModelKind) => drafts[listKey(id, kind)] ?? (doc[id][kind] ?? []).join("\n");
	const served = (p: ProviderView, kind: ModelKind) => (kind === "chat" ? p.rawChat : p.image);

	async function saveList(id: ProviderId, kind: ModelKind) {
		const key = listKey(id, kind);
		const parsed = parseApprovedText(textOf(id, kind));
		if (!parsed.ok) {
			notes = { ...notes, [key]: parsed.line ? t("providers.approvedBadLine").replace("{line}", parsed.line) : t("providers.approvedTooMany") };
			return;
		}
		const out = await saveApproved(id, kind, parsed.ids.length ? parsed.ids : null);
		if (out.ok) drafts = Object.fromEntries(Object.entries(drafts).filter(([k]) => k !== key));
		notes = { ...notes, [key]: out.ok ? t("providers.approvedSaved") : t("providers.saveFailed").replace("{code}", out.code) };
	}

	// ---- xAI key (desktop) ----
	let keyText = $state("");
	let keyNote = $state("");
	let keyBusy = $state(false);
	async function saveKey(key: string | null) {
		if (keyBusy) return;
		keyBusy = true;
		const out = await storeXaiKey(key);
		keyBusy = false;
		keyText = "";
		keyNote = out.ok ? t(key === null ? "providers.keyRemoved" : "providers.keySaved") : t("providers.saveFailed").replace("{code}", out.code);
	}
	const xaiSource = $derived(view("xai")?.keySource ?? null);
</script>

<Stack align="stretch" class="gap-6" data-slot="provider-settings">
	<Box tag="section" class="rounded border border-border bg-card p-4" aria-labelledby="providers-roles-title">
		<Stack align="stretch" class="gap-4">
			<Group class="items-center justify-between gap-2">
				<Title as={2} id="providers-roles-title" class="text-base font-semibold">{t("providers.rolesTitle")}</Title>
				<Button size="sm" variant="outline" data-action="providers-reset-spend" onclick={resetSpend}>{t("providers.resetSpend")}</Button>
			</Group>
			<Text tag="p" class="text-xs text-muted-foreground">{t("providers.rolesHint")}</Text>
			<Grid class="hidden gap-2 text-xs text-muted-foreground md:grid md:grid-cols-[8rem_1fr_1fr_8rem_6rem]" aria-hidden="true">
				<Text tag="span">{t("providers.col.role")}</Text><Text tag="span">{t("providers.col.provider")}</Text><Text tag="span">{t("providers.col.model")}</Text><Text tag="span">{t("providers.col.state")}</Text><Text tag="span">{t("providers.col.spent")}</Text>
			</Grid>
			{#each rows as r (r.role)}
				<Grid class="items-center gap-2 md:grid-cols-[8rem_1fr_1fr_8rem_6rem]" role="group" aria-labelledby={`role-${r.role}-name`} data-role={r.role}>
					<Text tag="span" id={`role-${r.role}-name`} class="text-sm font-medium">{t(`providers.role.${r.role}`)}</Text>
					<Select size="sm" id={`role-${r.role}-provider`} aria-label={t("providers.providerFor").replace("{role}", t(`providers.role.${r.role}`))} value={r.providerValue} onchange={(e: Event) => chooseProvider(r.role, valueOf(e))}>
						{#if r.role === "ask"}<SelectOption value="same">{t("providers.sameAsBuild")}</SelectOption>{/if}
						{#each r.providers as p (p.id)}<SelectOption value={p.id}>{t(`providers.name.${p.id}`)}</SelectOption>{/each}
						{#if r.role === "media"}<SelectOption value="off">{t("providers.off")}</SelectOption>{/if}
						{#if r.provider !== "off" && !r.providers.some((p) => p.id === r.provider) && r.providerValue !== "same"}<SelectOption value={r.provider}>{t(`providers.name.${r.provider}`)}</SelectOption>{/if}
					</Select>
					<Select size="sm" id={`role-${r.role}-model`} aria-label={t("providers.modelFor").replace("{role}", t(`providers.role.${r.role}`))} value={r.model ?? ""} disabled={r.modelDisabled || !r.models.length} onchange={(e: Event) => chooseModel(r, valueOf(e))}>
						{#if r.model && !r.models.includes(r.model)}<SelectOption value={r.model}>{modelLabel(r.model)}</SelectOption>{/if}
						{#if !r.model}<SelectOption value="">{t("providers.noModel")}</SelectOption>{/if}
						{#each r.models as id (id)}<SelectOption value={id}>{modelLabel(id)}</SelectOption>{/each}
					</Select>
					<Box>
						<Badge size="sm" variant={STATE_VARIANT[r.state] ?? "secondary"} role="status" data-state={r.state}>{t(`providers.state.${r.state}`)}</Badge>
					</Box>
					<Text tag="span" class="text-sm tabular-nums" aria-label={t("providers.spentFor").replace("{role}", t(`providers.role.${r.role}`))}>{r.spent}</Text>
				</Grid>
			{/each}
		</Stack>
	</Box>

	<Box tag="section" class="rounded border border-border bg-card p-4" aria-labelledby="providers-approved-title">
		<Stack align="stretch" class="gap-4">
			<Title as={2} id="providers-approved-title" class="text-base font-semibold">{t("providers.approvedTitle")}</Title>
			<Text tag="p" class="text-xs text-muted-foreground">{t(approvedOnHost() ? "providers.approvedHintHost" : "providers.approvedHintDevice")}</Text>
			{#each listed as p (p.id)}
				{#each kindsOf(p) as kind (kind)}
					{@const key = listKey(p.id, kind)}
					<Stack align="stretch" class="gap-2" data-slot="approved-list" data-provider={p.id} data-kind={kind}>
						<Label for={`approved-${key}`} class="text-sm font-medium">{t("providers.approvedLabel").replace("{provider}", t(`providers.name.${p.id}`)).replace("{kind}", t(`providers.kind.${kind}`))}</Label>
						<Textarea id={`approved-${key}`} size="sm" rows={3} class="font-mono text-xs" spellcheck="false" aria-describedby={`approved-${key}-hint`} placeholder={t("providers.approvedPlaceholder")} value={textOf(p.id, kind)} oninput={(e: Event) => (drafts = { ...drafts, [key]: valueOf(e) })} />
						<Text tag="p" id={`approved-${key}-hint`} class="text-xs text-muted-foreground">{doc[p.id][kind] === null ? t("providers.approvedAll") : t("providers.approvedNarrowed")} {t("providers.served").replace("{ids}", served(p, kind).join(", ") || "—")}</Text>
						<Group class="items-center gap-2">
							<Button size="sm" data-action={`approved-save-${key}`} onclick={() => saveList(p.id, kind)}>{t("providers.approvedSave")}</Button>
							{#if notes[key]}<Text tag="span" class="text-xs text-muted-foreground" role="status" aria-live="polite">{notes[key]}</Text>{/if}
						</Group>
					</Stack>
				{/each}
			{/each}
		</Stack>
	</Box>

	{#if hostTakesKeys() || views.some((p) => p.id === "openrouter" && p.state !== "host_unavailable")}
		<Box tag="section" class="rounded border border-border bg-card p-4" aria-labelledby="providers-keys-title">
			<Stack align="stretch" class="gap-4">
				<Title as={2} id="providers-keys-title" class="text-base font-semibold">{t("providers.keysTitle")}</Title>
				{#if hostTakesKeys()}
					<Stack align="stretch" class="gap-2" data-slot="xai-key">
						<Label for="providers-xai-key" class="text-sm font-medium">{t("providers.xaiKey")}</Label>
						<Text tag="p" id="providers-xai-key-hint" class="text-xs text-muted-foreground">{xaiSource ? t("providers.keyPresent").replace("{source}", xaiSource) : t("providers.keyAbsent")} {t("providers.keyNever")}</Text>
						<Group class="items-center gap-2">
							<Input id="providers-xai-key" type="password" size="sm" class="max-w-md" autocomplete="off" spellcheck="false" aria-describedby="providers-xai-key-hint" value={keyText} oninput={(e: Event) => (keyText = valueOf(e))} />
							<Button size="sm" disabled={keyBusy || !keyText.trim()} data-action="xai-key-save" onclick={() => saveKey(keyText)}>{t("providers.keySave")}</Button>
							{#if xaiSource === "keychain"}<Button size="sm" variant="outline" disabled={keyBusy} data-action="xai-key-remove" onclick={() => saveKey(null)}>{t("providers.keyRemove")}</Button>{/if}
						</Group>
						{#if keyNote}<Text tag="p" class="text-xs text-muted-foreground" role="status" aria-live="polite">{keyNote}</Text>{/if}
					</Stack>
				{/if}
				<RuntimeSignIn />
			</Stack>
		</Box>
	{/if}
</Stack>
