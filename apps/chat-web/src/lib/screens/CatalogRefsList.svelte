<script lang="ts">
	import Copy from "@lucide/svelte/icons/copy";
	import Check from "@lucide/svelte/icons/check";
	import ExternalLink from "@lucide/svelte/icons/external-link";
	import Block from "../compose/Block.svelte";
	import Group from "../compose/Group.svelte";
	import Stack from "../compose/Stack.svelte";
	import Title from "../compose/Title.svelte";
	import Box from "../../ui/box/Box.svelte";
	import Button from "../../ui/button/Button.svelte";
	import Icon from "../../ui/icon/Icon.svelte";
	import Link from "../../ui/link/Link.svelte";
	import Text from "../../ui/text/Text.svelte";
	import { t } from "../i18n/dictionary";
	import type { CatalogFilters, CatalogRefs } from "@buildytech/builder-core";

	let { refs, demo = false }: { refs: CatalogRefs; demo?: boolean } = $props();

	let copiedId = $state<string | null>(null);

	function filterLine(filters: CatalogFilters): string {
		return Object.entries(filters)
			.filter(([key, value]) => key !== "type" && (Array.isArray(value) ? value.length > 0 : Boolean(value)))
			.map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(",") : value}`)
			.join(" · ");
	}

	async function copyId(id: string) {
		try {
			await navigator.clipboard.writeText(id);
			copiedId = id;
			setTimeout(() => {
				if (copiedId === id) copiedId = null;
			}, 1200);
		} catch {
			copiedId = null;
		}
	}
</script>

<Block tag="section" class="rounded-default border border-border px-3 py-3" aria-label={t("catalogRefs.label")}>
	<Stack class="gap-2">
		<Title as={3} class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
			{t("catalogRefs.title")}
		</Title>
		{#if demo}
			<Text tag="p" class="text-xs text-muted-foreground">{t("catalogRefs.demo")}</Text>
		{/if}
		{#if refs.screen}
			<Stack class="gap-1">
				<Group class="flex-wrap items-center gap-2">
					<Text tag="span" class="text-xs text-muted-foreground">{t("catalogRefs.screen")}</Text>
					<Link
						href={refs.screen.url}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-1 text-sm font-medium text-foreground underline underline-offset-4"
						aria-label={t("catalogRefs.open").replace("{title}", refs.screen.title)}
					>
						<Text tag="span">{refs.screen.title}</Text>
						<Icon size="sm"><ExternalLink /></Icon>
					</Link>
					<Button
						class="inline-flex items-center gap-1 rounded-default px-1 py-1 font-mono text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
						aria-label={copiedId === refs.screen.catalogId
							? t("catalogRefs.copied").replace("{id}", refs.screen.catalogId)
							: t("catalogRefs.copyId").replace("{id}", refs.screen.catalogId)}
						onclick={() => copyId(refs.screen!.catalogId)}
					>
						<Text tag="span">{refs.screen.catalogId}</Text>
						<Icon size="sm">{#if copiedId === refs.screen.catalogId}<Check />{:else}<Copy />{/if}</Icon>
					</Button>
				</Group>
				<Text tag="p" class="font-mono text-xs break-all text-muted-foreground">{filterLine(refs.screen.filters)}</Text>
			</Stack>
		{/if}
		<Box tag="ul" class="flex flex-col gap-2">
			{#each refs.blocks as ref (ref.blockId)}
				<Box tag="li" class="flex flex-col gap-1">
					<Group class="flex-wrap items-center gap-2">
						<Link
							href={ref.url}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center gap-1 text-sm font-medium text-foreground underline underline-offset-4"
							aria-label={t("catalogRefs.open").replace("{title}", ref.title)}
						>
							<Text tag="span">{ref.title}</Text>
							<Icon size="sm"><ExternalLink /></Icon>
						</Link>
						<Button
							class="inline-flex items-center gap-1 rounded-default px-1 py-1 font-mono text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
							aria-label={copiedId === ref.catalogId
								? t("catalogRefs.copied").replace("{id}", ref.catalogId)
								: t("catalogRefs.copyId").replace("{id}", ref.catalogId)}
							onclick={() => copyId(ref.catalogId)}
						>
							<Text tag="span">{ref.catalogId}</Text>
							<Icon size="sm">{#if copiedId === ref.catalogId}<Check />{:else}<Copy />{/if}</Icon>
						</Button>
						{#if ref.rows > 0}
							<Text tag="span" class="text-xs text-muted-foreground">
								{t("catalogRefs.rows").replace("{n}", String(ref.rows))}
							</Text>
						{/if}
					</Group>
					<Text tag="p" class="font-mono text-xs break-all text-muted-foreground">
						{t("catalogRefs.meta")
							.replace("{kind}", ref.kind)
							.replace("{label}", ref.catalogLabel)
							.replace("{variants}", ref.variants.join(","))}
					</Text>
				</Box>
			{/each}
		</Box>
		<Text tag="p" class="font-mono text-xs break-all text-muted-foreground">
			{t("catalogRefs.digest").replace("{digest}", `${refs.catalogDigest.slice(0, 19)}… @ ${refs.pinnedCommit.slice(0, 7)}`)}
		</Text>
	</Stack>
</Block>
