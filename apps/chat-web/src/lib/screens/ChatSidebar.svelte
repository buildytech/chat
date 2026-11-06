<script lang="ts">
	import MessageSquare from "@lucide/svelte/icons/message-square";
	import Plus from "@lucide/svelte/icons/plus";
	import Trash2 from "@lucide/svelte/icons/trash-2";
	import Block from "../compose/Block.svelte";
	import Group from "../compose/Group.svelte";
	import Stack from "../compose/Stack.svelte";
	import Button from "../../ui/button/Button.svelte";
	import Icon from "../../ui/icon/Icon.svelte";
	import Separator from "../../ui/separator/Separator.svelte";
	import Text from "../../ui/text/Text.svelte";
	import { t } from "../i18n/dictionary";
	import { cn } from "../../utils/cn";
	import type { SessionSummary } from "../chat-core";

	let {
		sessions,
		selectedId,
		onNew,
		onSelect,
		onDelete
	}: {
		sessions: SessionSummary[];
		selectedId: string | null;
		onNew: () => void;
		onSelect: (id: string) => void;
		onDelete: (id: string) => void;
	} = $props();
</script>

<Block
	tag="aside"
	class="flex h-full w-[248px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
>
	<Stack class="gap-3 p-4">
		<Text tag="span" class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
			{t("sidebar.chats")}
		</Text>
		<Button
			class="inline-flex w-full items-center justify-start gap-2 rounded-default bg-primary px-3 py-2 text-sm text-primary-foreground"
			onclick={onNew}
		>
			<Icon size="sm"><Plus /></Icon>
			<Text tag="span">{t("sidebar.newChat")}</Text>
		</Button>
	</Stack>
	<Separator />
	<Stack class="min-h-0 flex-1 gap-1 overflow-y-auto p-3">
		{#if sessions.length === 0}
			<Text tag="p" class="px-2 py-3 text-sm text-muted-foreground">{t("sidebar.empty")}</Text>
		{:else}
			{#each sessions as session (session.id)}
				<Group class="gap-1">
					<Button
						class={cn(
							"min-w-0 flex-1 justify-start rounded-default px-3 py-2 text-left text-sm",
							selectedId === session.id
								? "bg-accent text-accent-foreground"
								: "text-foreground hover:bg-accent/70"
						)}
						onclick={() => onSelect(session.id)}
					>
						<Group class="min-w-0 gap-2">
							<Icon size="sm"><MessageSquare /></Icon>
							<Text tag="span" class="truncate">{session.title}</Text>
						</Group>
					</Button>
					<Button
						class="shrink-0 rounded-default p-2 text-muted-foreground hover:bg-accent hover:text-destructive"
						aria-label={t("sidebar.delete")}
						onclick={() => onDelete(session.id)}
					>
						<Icon size="sm"><Trash2 /></Icon>
					</Button>
				</Group>
			{/each}
		{/if}
	</Stack>
</Block>
