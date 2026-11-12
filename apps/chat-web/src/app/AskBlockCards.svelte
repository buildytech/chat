<script lang="ts">
	import { previewSettings } from "$lib/browser/preview-settings.svelte";
 import ExternalLink from "@lucide/svelte/icons/external-link";
	import Block from "$registry/compose/Block.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Title from "$registry/compose/Title.svelte";
	import Box from "$registry/kit/ui/box/Box.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Link from "$registry/kit/ui/link/Link.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { askBlockCards } from "@buildytech/builder-core";
	import StockThumb from "./StockThumb.svelte";

	// Cards are rebuilt from the bundled catalog (askBlockCards), never taken from the wire.
	let { blocks, onApplyVariant }: { blocks: string[]; onApplyVariant?: (spec: string, variant: string) => void } = $props();

	const cards = $derived(askBlockCards(blocks));
</script>

{#if cards.length > 0}
	<Box tag="ul" class="flex flex-col gap-4" aria-label={t("ask.cards")}>
		{#each cards as card (card.spec)}
			<Box tag="li">
				<Block tag="article" class="overflow-hidden rounded border border-border" data-spec={card.spec}>
					<!-- full-bleed picture on top (the card radius clips it): the chat column is narrow in the compact IDE layout -->
					<StockThumb src={card.thumb} title={card.title} bleed class="w-full border-b" />
					<Stack align="stretch" class="gap-2 p-3">
						<Group class="flex-wrap items-center justify-between gap-2">
							<Title as={3} class="text-sm font-semibold text-foreground">{card.title}</Title>
							<Link
								href={card.stockUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-2 text-xs text-muted-foreground underline underline-offset-4"
								aria-label={t("catalogRefs.open").replace("{title}", card.title)}
							>
								<Text tag="span">{t("ask.openStock")}</Text>
								<Icon size="sm"><ExternalLink /></Icon>
							</Link>
						</Group>
						{#if !previewSettings.hideServiceLabels}
 <Text tag="p" class="font-mono text-xs break-all text-muted-foreground">
							{t("ask.cardMeta")
								.replace("{spec}", card.spec)
								.replace("{item}", card.registryItem ?? t("ask.noRegistryItem"))
								.replace("{n}", String(card.variants.length))}
						</Text>
						{/if}
 <Text tag="p" class="text-xs text-muted-foreground">{t("ask.applyHint")}</Text>
						<Group class="flex-wrap gap-2">
							{#each card.variants as variant (variant)}
								<Button
									class="rounded border border-border px-2 py-1 font-mono text-xs text-foreground hover:bg-accent"
									aria-label={t("ask.applyVariant").replace("{variant}", variant).replace("{block}", card.title)}
									onclick={() => onApplyVariant?.(card.spec, variant)}
								>
									<Text tag="span">{variant}{variant === card.defaultVariant ? ` (${t("ask.default")})` : ""}</Text>
								</Button>
							{/each}
						</Group>
					</Stack>
				</Block>
			</Box>
		{/each}
	</Box>
{/if}
