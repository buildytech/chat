<script lang="ts">
import { MessageSquare, PanelLeft } from "$lib/shell-icons";
	import Block from "$registry/compose/Block.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { cn } from "$registry/utils/cn";

	let {
		surface,
		onSelect
	}: {
		surface: "chat" | "workspace";
		onSelect: (surface: "chat" | "workspace") => void;
	} = $props();
</script>

<Block
	tag="nav"
	class="shrink-0 border-t border-border bg-background p-2 lg:hidden"
	aria-label={t("shell.tabs")}
>
	<Group class="gap-2">
		<Button
			class={cn(
				"inline-flex flex-1 items-center justify-center gap-2 rounded px-3 py-2 text-sm",
				surface === "chat"
					? "bg-accent text-accent-foreground"
					: "text-muted-foreground hover:bg-accent/70"
			)}
			pressed={surface === "chat"}
			aria-controls="creator-chat-column"
			onclick={() => onSelect("chat")}
		>
			<Icon size="sm"><MessageSquare /></Icon>
			<Text tag="span">{t("shell.tabChat")}</Text>
		</Button>
		<Button
			class={cn(
				"inline-flex flex-1 items-center justify-center gap-2 rounded px-3 py-2 text-sm",
				surface === "workspace"
					? "bg-accent text-accent-foreground"
					: "text-muted-foreground hover:bg-accent/70"
			)}
			pressed={surface === "workspace"}
			aria-controls="main-content"
			onclick={() => onSelect("workspace")}
		>
			<Icon size="sm"><PanelLeft /></Icon>
			<Text tag="span">{t("shell.tabWorkspace")}</Text>
		</Button>
	</Group>
</Block>
