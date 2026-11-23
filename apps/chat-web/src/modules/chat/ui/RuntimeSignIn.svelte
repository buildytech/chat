<script lang="ts">
	import Group from "$registry/compose/Group.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { onSignInChange, signInState, signOut, startSignIn, type SignInState } from "../browser/runtime-sign-in.ts";
	import { refreshAccountModels } from "../browser/models.svelte.ts";

	// Sign in with OpenRouter (ADR 0067): shown only when the host offers it (the desktop app's status); the web never does.
	let sign = $state<SignInState>(signInState());
	$effect(() =>
		onSignInChange((next) => {
			sign = next;
		}),
	);
	let busy = $state(false);

	async function begin() {
		if (busy) return;
		busy = true;
		try {
			await startSignIn(() => refreshAccountModels());
		} finally {
			busy = false;
		}
	}

	async function end() {
		if (busy) return;
		busy = true;
		try {
			await signOut(() => refreshAccountModels());
		} finally {
			busy = false;
		}
	}
</script>

{#if sign.offered}
	<Group class="flex-wrap items-center gap-2 px-2" data-slot="composer-sign-in">
		{#if sign.signedIn}
			<Text tag="p" class="text-xs text-muted-foreground" role="status">{t("signIn.signedIn")}</Text>
			<Button type="button" class="inline-flex h-6 w-fit items-center rounded px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground" disabled={busy} onclick={end}
				>{t("signIn.signOut")}</Button
			>
		{:else if sign.pending}
			<Text tag="p" class="text-xs text-muted-foreground" role="status" aria-live="polite">{t("signIn.pending")}</Text>
		{:else}
			<Button type="button" class="inline-flex h-6 w-fit items-center rounded px-2 text-xs text-foreground hover:bg-accent" disabled={busy} onclick={begin}>{t("signIn.openrouter")}</Button>
			{#if sign.failed}<Text tag="p" class="text-xs text-destructive" role="status">{t("signIn.failed")}</Text>{/if}
		{/if}
	</Group>
{/if}
