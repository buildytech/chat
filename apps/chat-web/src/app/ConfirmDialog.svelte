<script lang="ts">
	import { onMount } from "svelte";
	import Block from "$registry/compose/Block.svelte";
	import Group from "$registry/compose/Group.svelte";
	import Stack from "$registry/compose/Stack.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import Title from "$registry/compose/Title.svelte";
	import { t } from "$lib/i18n/dictionary";

	let {
		title,
		description,
		confirmLabel,
		cancelLabel = "",
		onConfirm,
		onClose
	}: {
		title: string;
		description: string;
		confirmLabel: string;
		cancelLabel?: string;
		onConfirm: () => void;
		onClose: () => void;
	} = $props();

	const cancelText = $derived(cancelLabel || t("sidebar.deleteCancel"));

	onMount(() => {
		const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		queueMicrotask(() => document.getElementById("confirm-dialog-cancel")?.focus());
		function onKey(event: KeyboardEvent) {
			if (event.key !== "Escape") return;
			event.preventDefault();
			event.stopPropagation();
			onClose();
		}
		window.addEventListener("keydown", onKey, true);
		return () => {
			window.removeEventListener("keydown", onKey, true);
			previous?.focus();
		};
	});
</script>

<Block class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
	<Button class="absolute inset-0 h-full w-full bg-transparent" aria-label={t("modal.close")} onclick={onClose}>
		<Text tag="span" class="sr-only">{t("modal.close")}</Text>
	</Button>
	<Stack align="stretch"
		class="relative z-10 w-full max-w-sm gap-4 rounded border border-border bg-card p-5"
		role="dialog"
		aria-modal="true"
		aria-labelledby="confirm-dialog-title"
		aria-describedby="confirm-dialog-body"
	>
		<Stack align="stretch" class="gap-2">
			<Title as={2} id="confirm-dialog-title" class="text-base font-semibold text-foreground">{title}</Title>
			<Text tag="p" id="confirm-dialog-body" class="text-sm text-muted-foreground">{description}</Text>
		</Stack>
		<Group class="justify-end gap-2">
			<Button
				id="confirm-dialog-cancel"
				type="button"
				class="rounded border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent"
				onclick={onClose}
			>
				<Text tag="span">{cancelText}</Text>
			</Button>
			<Button
				type="button"
				class="rounded bg-foreground px-3 py-1.5 text-sm text-background hover:bg-foreground/90"
				onclick={onConfirm}
			>
				<Text tag="span">{confirmLabel}</Text>
			</Button>
		</Group>
	</Stack>
</Block>
