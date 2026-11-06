<script lang="ts">
	import Send from "@lucide/svelte/icons/send";
	import Block from "../compose/Block.svelte";
	import Group from "../compose/Group.svelte";
	import Button from "../../ui/button/Button.svelte";
	import Form from "../../ui/form/Form.svelte";
	import Icon from "../../ui/icon/Icon.svelte";
	import Label from "../../ui/label/Label.svelte";
	import Text from "../../ui/text/Text.svelte";
	import Textarea from "../../ui/textarea/Textarea.svelte";
	import { t } from "../i18n/dictionary";

	let {
		disabled = false,
		onSend
	}: {
		disabled?: boolean;
		onSend: (text: string) => void;
	} = $props();

	let draft = $state("");

	function submit(event: Event) {
		event.preventDefault();
		const text = draft.trim();
		if (!text || disabled) return;
		onSend(text);
		draft = "";
	}

	function onKeydown(event: KeyboardEvent) {
		if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
			event.preventDefault();
			submit(event);
		}
	}
</script>

<Block tag="footer" class="border-t border-border bg-background px-4 py-3 md:px-8">
	<Form class="mx-auto flex max-w-3xl flex-col gap-2" onsubmit={submit}>
		<Label for="composer" class="sr-only">{t("composer.label")}</Label>
		<Textarea
			id="composer"
			name="message"
			rows="3"
			placeholder={t("composer.placeholder")}
			class="min-h-16 w-full resize-none rounded-default border border-input bg-card px-3 py-2 text-sm text-foreground shadow-none outline-none ring-ring focus-visible:ring-2"
			bind:value={draft}
			onkeydown={onKeydown}
			disabled={disabled}
		/>
		<Group class="justify-end gap-2">
			<Button
				type="submit"
				disabled={disabled}
				class="inline-flex items-center gap-2 rounded-default bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90"
			>
				<Icon size="sm"><Send /></Icon>
				<Text tag="span">{t("composer.send")}</Text>
			</Button>
		</Group>
	</Form>
</Block>
