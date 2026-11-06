<script lang="ts">
	import History from "@lucide/svelte/icons/history";
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import FolderArchive from "@lucide/svelte/icons/folder-archive";
	import PanelLeft from "@lucide/svelte/icons/panel-left";
	import Group from "../compose/Group.svelte";
	import Button from "../../ui/button/Button.svelte";
	import Icon from "../../ui/icon/Icon.svelte";
	import Text from "../../ui/text/Text.svelte";
	import { t } from "../i18n/dictionary";
	import { cn } from "../../utils/cn";

	export type WorkspaceView = "preview" | "code";

	let {
		view = $bindable("preview"),
		chatHidden = false,
		ontogglechat,
		onDownloadZip
	}: {
		view?: WorkspaceView;
		chatHidden?: boolean;
		ontogglechat?: () => void;
		onDownloadZip?: () => void;
	} = $props();
</script>

<Group
	class="w-full shrink-0 items-center gap-6 border-b border-border px-4 py-3 max-md:flex-wrap max-md:gap-3"
	role="toolbar"
	aria-label={t("workspace.head")}
	data-block="workspace-head"
	data-view={view}
>
	<Button
		class="hidden size-8 items-center justify-center rounded-default border border-border text-foreground hover:bg-accent lg:inline-flex"
		aria-label={chatHidden ? t("workspace.showChat") : t("workspace.hideChat")}
		aria-pressed={chatHidden ? "true" : "false"}
		aria-controls="creator-chat-column"
		onclick={ontogglechat}
	>
		<Icon size="sm"><PanelLeft /></Icon>
	</Button>

	<Group
		class="min-w-0 flex-1 gap-1 rounded-default bg-muted p-1 max-md:basis-full"
		role="tablist"
		aria-label={t("workspace.viewSwitcher")}
	>
		<Button
			class={cn(
				"flex-1 rounded-default px-3 py-1.5 text-sm",
				view === "preview"
					? "bg-card text-foreground shadow-sm"
					: "text-muted-foreground hover:text-foreground"
			)}
			aria-pressed={view === "preview" ? "true" : "false"}
			aria-controls="pane-workspace"
			onclick={() => (view = "preview")}
		>
			<Text tag="span">{t("workspace.preview")}</Text>
		</Button>
		<Button
			class={cn(
				"flex-1 rounded-default px-3 py-1.5 text-sm",
				view === "code"
					? "bg-card text-foreground shadow-sm"
					: "text-muted-foreground hover:text-foreground"
			)}
			aria-pressed={view === "code" ? "true" : "false"}
			aria-controls="pane-workspace"
			onclick={() => (view = "code")}
		>
			<Text tag="span">{t("workspace.code")}</Text>
		</Button>
	</Group>

	<Group class="items-center gap-2 max-md:w-full max-md:gap-3">
		<Button
			class="inline-flex items-center gap-2 rounded-default border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent max-md:flex-1"
			aria-label={t("workspace.version")}
			disabled
			title={t("workspace.versionSoon")}
		>
			<Icon size="sm" class="text-muted-foreground"><History /></Icon>
			<Text tag="span">{t("workspace.version")}</Text>
			<Icon size="sm" class="text-muted-foreground"><ChevronDown /></Icon>
		</Button>
		<Button
			class="inline-flex items-center gap-2 rounded-default border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent max-md:flex-1"
			aria-label={t("workspace.downloadZip")}
			onclick={onDownloadZip}
		>
			<Icon size="sm" class="text-muted-foreground"><FolderArchive /></Icon>
			<Text tag="span">{t("workspace.downloadZip")}</Text>
		</Button>
	</Group>
</Group>
