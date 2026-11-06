<script lang="ts">
	import ArrowLeft from "@lucide/svelte/icons/arrow-left";
	import ArrowRight from "@lucide/svelte/icons/arrow-right";
	import ExternalLink from "@lucide/svelte/icons/external-link";
	import Monitor from "@lucide/svelte/icons/monitor";
	import RefreshCw from "@lucide/svelte/icons/refresh-cw";
	import Smartphone from "@lucide/svelte/icons/smartphone";
	import Block from "../compose/Block.svelte";
	import Group from "../compose/Group.svelte";
	import Stack from "../compose/Stack.svelte";
	import Button from "../../ui/button/Button.svelte";
	import Icon from "../../ui/icon/Icon.svelte";
	import Input from "../../ui/input/Input.svelte";
	import Text from "../../ui/text/Text.svelte";
	import { t } from "../i18n/dictionary";
	import { cn } from "../../utils/cn";
	import { blocksOf, getCurrentPage, getSelectedBlockId } from "../page-store";
	import PreviewBlock from "./PreviewBlock.svelte";

	const page = $derived(getCurrentPage());
	const blocks = $derived(blocksOf(page));
	const selectedId = $derived(getSelectedBlockId());
	const slugUrl = $derived(`/${page.slug}`);

	let device = $state<"desktop" | "mobile">("desktop");
	let url = $state("");
	let draft = $state("");
	let history = $state<string[]>([]);
	let future = $state<string[]>([]);
	let reloadKey = $state(0);
	let spinning = $state(false);

	const currentUrl = $derived(url || slugUrl);

	function commit(next: string) {
		const value = next.trim() || slugUrl;
		if (value !== currentUrl) {
			history = [...history, currentUrl];
			future = [];
			url = value;
		}
		draft = value;
	}

	function back() {
		const prev = history.at(-1);
		if (prev === undefined) return;
		future = [currentUrl, ...future];
		history = history.slice(0, -1);
		url = prev;
		draft = prev;
	}

	function forward() {
		const next = future[0];
		if (next === undefined) return;
		history = [...history, currentUrl];
		future = future.slice(1);
		url = next;
		draft = next;
	}

	function reload() {
		spinning = true;
		reloadKey += 1;
		draft = currentUrl;
		setTimeout(() => (spinning = false), 500);
	}

	function onAddressKey(event: KeyboardEvent) {
		if (event.key === "Enter") {
			event.preventDefault();
			commit(draft);
			(event.currentTarget as HTMLInputElement).blur();
		} else if (event.key === "Escape") {
			draft = currentUrl;
			(event.currentTarget as HTMLInputElement).blur();
			event.stopPropagation();
		}
	}

	function openNew() {
		window.open(location.href, "_blank", "noopener");
	}
</script>

<Block
	tag="section"
	class="mt-4 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-default border border-border bg-card"
	aria-label={t("workspace.preview")}
	data-block="preview-pane"
>
	<Group
		class="shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border p-3"
		data-slot="browser-head"
	>
		<Group
			class="gap-1 rounded-default bg-muted p-1"
			role="tablist"
			aria-label={t("preview.device")}
		>
			<Button
				class={cn(
					"inline-flex size-8 items-center justify-center rounded-default",
					device === "desktop" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
				)}
				aria-label={t("preview.desktop")}
				aria-pressed={device === "desktop" ? "true" : "false"}
				onclick={() => (device = "desktop")}
			>
				<Icon size="sm"><Monitor /></Icon>
			</Button>
			<Button
				class={cn(
					"inline-flex size-8 items-center justify-center rounded-default",
					device === "mobile" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
				)}
				aria-label={t("preview.mobile")}
				aria-pressed={device === "mobile" ? "true" : "false"}
				onclick={() => (device = "mobile")}
			>
				<Icon size="sm"><Smartphone /></Icon>
			</Button>
		</Group>

		<Group
			class="min-w-0 flex-1 items-center justify-between gap-2 rounded-default border border-border bg-background px-2 py-1 max-md:order-3 max-md:basis-full"
			role="group"
			aria-label={t("preview.address")}
		>
			<Group class="min-w-0 flex-1 items-center gap-1">
				<Button
					class="inline-flex size-7 items-center justify-center rounded-default text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
					aria-label={t("preview.back")}
					disabled={history.length === 0}
					onclick={back}
				>
					<Icon size="sm"><ArrowLeft /></Icon>
				</Button>
				<Button
					class="inline-flex size-7 items-center justify-center rounded-default text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
					aria-label={t("preview.forward")}
					disabled={future.length === 0}
					onclick={forward}
				>
					<Icon size="sm"><ArrowRight /></Icon>
				</Button>
				<Text tag="span" class="shrink-0 text-xs text-muted-foreground" aria-hidden="true">{t("preview.site")}</Text>
				<Input
					class="min-w-0 flex-1 border-0 bg-transparent px-1 py-1 text-xs font-semibold text-foreground shadow-none outline-none"
					value={draft || slugUrl}
					aria-label={t("preview.address")}
					autocomplete="off"
					spellcheck="false"
					oninput={(event: Event) => {
						draft = (event.currentTarget as HTMLInputElement).value;
					}}
					onkeydown={onAddressKey}
					onfocus={(event: FocusEvent) => (event.currentTarget as HTMLInputElement).select()}
					onblur={() => (draft = currentUrl)}
				/>
			</Group>
			<Button
				class="inline-flex size-7 items-center justify-center rounded-default text-muted-foreground hover:bg-accent hover:text-foreground"
				aria-label={t("preview.reload")}
				onclick={reload}
			>
				<Icon size="sm" class={spinning ? "animate-spin" : undefined}><RefreshCw /></Icon>
			</Button>
		</Group>

		<Group class="items-center gap-2 max-md:order-2">
			<Button
				class="inline-flex items-center rounded-default border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent"
				aria-label={t("preview.edit")}
				disabled
				title={t("preview.editSoon")}
			>
				<Text tag="span">{t("preview.edit")}</Text>
			</Button>
			<Button
				class="inline-flex size-8 items-center justify-center rounded-default border border-border text-foreground hover:bg-accent"
				aria-label={t("preview.openNew")}
				onclick={openNew}
			>
				<Icon size="sm"><ExternalLink /></Icon>
			</Button>
		</Group>
	</Group>

	<Block class="min-h-0 flex-1 overflow-y-auto p-4" data-device={device}>
		<Stack class={cn("gap-3", device === "mobile" && "mx-auto w-full max-w-[390px]")}>
			{#key reloadKey}
				<Text tag="p" class="text-xs text-muted-foreground">{t("preview.runtime")}</Text>
				{#if blocks.length === 0}
					<Text tag="p" class="text-sm text-muted-foreground">{t("workspace.empty")}</Text>
				{:else}
					{#each blocks as block (block.id)}
						<PreviewBlock {block} {selectedId} />
					{/each}
				{/if}
			{/key}
		</Stack>
	</Block>
</Block>
