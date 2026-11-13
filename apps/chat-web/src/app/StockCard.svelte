<!--
  One home Stock screen, in the same card as the Blocks feed (StockMediaCard): full-bleed thumbnail on top, the title
  row with its actions (open in Stock, attach), the screen id on one truncated line, the subtitle and, when the
  screen has sections BuildY cannot render, that note.
-->
<script lang="ts">
import { Check, ExternalLink, Paperclip } from "$lib/shell-icons";
	import Button from "$registry/compose/Button.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Link from "$registry/kit/ui/link/Link.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { screenThumbUrl, stockAssetUrl, type CatalogScreen, type ScreenCompatibility } from "@buildytech/builder-core";
	import StockMediaCard from "./StockMediaCard.svelte";

	let {
		screen,
		compatibility,
		selected = false,
		onAttach
	}: {
		screen: CatalogScreen;
		compatibility: ScreenCompatibility;
		selected?: boolean;
		onAttach: (id: string) => void;
	} = $props();

	const missing = $derived(compatibility.missing.map((item) => item.catalogLabel).join(", "));
	const name = $derived(`${screen.title} / ${screen.subtitle}`);
</script>

<StockMediaCard tag="article" thumb={screenThumbUrl(screen.screenId)} thumbTitle={name} {selected} class="h-full" data-slot="stock-card" data-id={screen.screenId}>
	<Group class="min-w-0 items-center justify-between gap-1">
		<Text tag="h3" class="min-w-0 truncate text-xs font-medium text-foreground" title={screen.title}>{screen.title}</Text>
		<Group class="shrink-0 items-center gap-1">
			<Link
				href={stockAssetUrl(screen.screenId)}
				target="_blank"
				rel="noopener noreferrer"
				class="inline-flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
				aria-label={t("catalogRefs.open").replace("{title}", name)}
				title={t("catalogRefs.open").replace("{title}", name)}
				data-action="stock-open"
			>
				<Icon size="sm"><ExternalLink /></Icon>
			</Link>
			<Button
				size="sm"
				layout="icon"
				variant={selected ? "default" : "outline"}
				class="size-8 px-0"
				pressed={selected}
				aria-label={`${t("home.attachScreen")}: ${name}`}
				title={t("home.attachScreen")}
				data-action="stock-attach"
				onclick={() => onAttach(screen.screenId)}
			>
				{#if selected}<Check />{:else}<Paperclip />{/if}
			</Button>
		</Group>
	</Group>
	<Text tag="span" class="truncate font-mono text-[11px] text-muted-foreground" title={screen.screenId}>{screen.screenId}</Text>
	<Text tag="span" class="truncate text-[11px] text-muted-foreground" title={screen.subtitle}>{screen.subtitle}</Text>
	{#if missing}
		<Text tag="span" class="text-[11px] text-muted-foreground" data-slot="stock-missing">
			{t("home.incompatible")}
			{t("home.missing").replace("{list}", missing)}
		</Text>
	{/if}
</StockMediaCard>
