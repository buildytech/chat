<!-- The address bar of the preview: the page slug as a path, back / forward over the slugs set here, and reload. -->
<script lang="ts">
	import { ArrowLeft, ArrowRight, RefreshCw } from "$lib/shell-icons";
	import Group from "$registry/compose/Group.svelte";
	import Button from "$registry/kit/ui/button/Button.svelte";
	import Icon from "$registry/kit/ui/icon/Icon.svelte";
	import Input from "$registry/kit/ui/input/Input.svelte";
	import Text from "$registry/kit/ui/text/Text.svelte";
	import { t } from "$lib/i18n/dictionary";
	import { inspector } from "$lib/inspector/inspector.svelte";
	import { getBoundProjectId } from "$lib/page-store";
	import { pageSlug } from "$lib/browser/page-address";

	let { currentUrl, onreload }: { currentUrl: string; onreload: () => void } = $props();

	let draft = $state("");
	let history = $state<string[]>([]);
	let future = $state<string[]>([]);
	let spinning = $state(false);

	$effect(() => {
		getBoundProjectId();
		draft = currentUrl;
	});

	$effect(() => {
		getBoundProjectId();
		history = [];
		future = [];
	});

	function commit(next: string) {
		const slug = pageSlug(next);
		if (!slug) return false;
		const before = currentUrl;
		if (!inspector.setSlug(slug)) return false;
		const value = "/" + slug;
		if (value !== before) {
			history = [...history, before];
			future = [];
		}
		draft = value;
		return true;
	}

	function back() {
		const prev = history.at(-1);
		if (prev === undefined) return;
		future = [currentUrl, ...future];
		history = history.slice(0, -1);
		inspector.setSlug(prev.slice(1));
		draft = prev;
	}

	function forward() {
		const next = future[0];
		if (next === undefined) return;
		history = [...history, currentUrl];
		future = future.slice(1);
		inspector.setSlug(next.slice(1));
		draft = next;
	}

	function reload() {
		spinning = true;
		draft = currentUrl;
		onreload();
		setTimeout(() => (spinning = false), 500);
	}

	function onAddressKey(event: KeyboardEvent) {
		if (event.key === "Enter") {
			event.preventDefault();
			const input = event.currentTarget as HTMLInputElement;
			if (!commit(draft)) {
				input.setCustomValidity(t("preview.invalidAddress"));
				input.reportValidity();
				return;
			}
			input.setCustomValidity("");
			input.blur();
		} else if (event.key === "Escape") {
			draft = currentUrl;
			(event.currentTarget as HTMLInputElement).blur();
			event.stopPropagation();
		}
	}
</script>

	<Group
		class="min-w-0 flex-1 items-center justify-between gap-2 rounded bg-background px-2 py-0 max-md:hidden"
		role="group"
		aria-label={t("preview.address")}
	>
		<Group class="min-w-0 flex-1 items-center gap-0">
			<Button
				class="inline-flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
				aria-label={t("preview.back")}
				disabled={history.length === 0}
				onclick={back}
			>
				<Icon size="sm"><ArrowLeft /></Icon>
			</Button>
			<Button
				class="inline-flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
				aria-label={t("preview.forward")}
				disabled={future.length === 0}
				onclick={forward}
			>
				<Icon size="sm"><ArrowRight /></Icon>
			</Button>
			<Text tag="span" class="shrink-0 text-xs text-muted-foreground" aria-hidden="true">{t("preview.site")}</Text>
			<Input
				class="min-w-0 flex-1 border-0 bg-transparent px-1 py-1 text-xs font-semibold text-foreground shadow-none outline-none"
				value={draft || currentUrl}
				aria-label={t("preview.address")}
				autocomplete="off"
				spellcheck="false"
				oninput={(event: Event) => {
					(event.currentTarget as HTMLInputElement).setCustomValidity("");
					draft = (event.currentTarget as HTMLInputElement).value;
				}}
				onkeydown={onAddressKey}
				onfocus={(event: FocusEvent) => (event.currentTarget as HTMLInputElement).select()}
				onblur={() => (draft = currentUrl)}
			/>
		</Group>
		<Button
			class="inline-flex size-8 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
			aria-label={t("preview.reload")}
			onclick={reload}
		>
			<Icon size="sm" class={spinning ? "animate-spin" : undefined}><RefreshCw /></Icon>
		</Button>
	</Group>
