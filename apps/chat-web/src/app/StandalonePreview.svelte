<!--
  The preview site as-is in its own window (/preview?session=...): this chat's page (pending proposal, else the applied
  page) rendered with the same registry blocks and the registry's own CSS and the chat's skin, no chat UI and no service labels. Theme
  follows the chat's light / dark choice; the page follows edits made in the chat tab (storage events).
-->
<script lang="ts">
	import { onMount } from "svelte";
	import Block from "$registry/compose/Block.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { blocksOf, readPreviewPage, type Page } from "$lib/page-store";
	import { THEME_KEY, theme } from "$lib/theme/theme.svelte";
	import { applySkin, readSessionSkin } from "$lib/theme/skins";
	import { storedCustomSkin } from "$lib/theme/custom-skin.svelte";
	import PreviewBlock from "./PreviewBlock.svelte";

	let ready = $state(false);
	let page = $state.raw<Page | null>(null);

	// Read-only: this window never binds or writes the chat's page store.
	function load() {
		const session = new URLSearchParams(location.search).get("session");
		page = readPreviewPage(session);
		// The Custom Skin (ADR 0025) fixes its own light / dark mode, after the chat's mode.
		void applySkin(document, readSessionSkin(session), storedCustomSkin());
	}

	onMount(() => {
		theme.init();
		load();
		ready = true;
		const onStorage = (event: StorageEvent) => {
			if (event.key === THEME_KEY) theme.init();
			load();
		};
		window.addEventListener("storage", onStorage);
		return () => window.removeEventListener("storage", onStorage);
	});

	const blocks = $derived(page ? blocksOf(page) : []);
</script>

<svelte:head>
	<title>{page?.title ?? t("preview.standaloneTitle")}</title>
</svelte:head>

<Block tag="main" class="bg-background text-foreground" data-slot="preview-window" data-blocks={blocks.length}>
	{#if ready && blocks.length === 0}
		<Text tag="p" class="p-4 text-sm text-muted-foreground">{t("preview.standaloneEmpty")}</Text>
	{:else}
		{#each blocks as block (block.id)}
			<PreviewBlock {block} clean standalone />
		{/each}
	{/if}
</Block>
