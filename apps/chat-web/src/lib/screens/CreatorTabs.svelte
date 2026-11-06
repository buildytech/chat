<script lang="ts">
	import MessageSquare from "@lucide/svelte/icons/message-square";
	import PanelLeft from "@lucide/svelte/icons/panel-left";
	import Block from "../compose/Block.svelte";
	import Group from "../compose/Group.svelte";
	import Button from "../../ui/button/Button.svelte";
	import Icon from "../../ui/icon/Icon.svelte";
	import Text from "../../ui/text/Text.svelte";
	import { t } from "../i18n/dictionary";
	import { cn } from "../../utils/cn";

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
				"inline-flex flex-1 items-center justify-center gap-2 rounded-default px-3 py-2 text-sm",
				surface === "chat"
					? "bg-accent text-accent-foreground"
					: "text-muted-foreground hover:bg-accent/70"
			)}
			aria-pressed={surface === "chat" ? "true" : "false"}
			aria-controls="creator-chat-column"
			onclick={() => onSelect("chat")}
		>
			<Icon size="sm"><MessageSquare /></Icon>
			<Text tag="span">{t("shell.tabChat")}</Text>
		</Button>
		<Button
			class={cn(
				"inline-flex flex-1 items-center justify-center gap-2 rounded-default px-3 py-2 text-sm",
				surface === "workspace"
					? "bg-accent text-accent-foreground"
					: "text-muted-foreground hover:bg-accent/70"
			)}
			aria-pressed={surface === "workspace" ? "true" : "false"}
			aria-controls="main-content"
			onclick={() => onSelect("workspace")}
		>
			<Icon size="sm"><PanelLeft /></Icon>
			<Text tag="span">{t("shell.tabWorkspace")}</Text>
		</Button>
	</Group>
</Block>
