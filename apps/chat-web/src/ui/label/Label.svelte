<!-- Generated from ui8kit/codegen Label brick (Svelte 5). Kit zone. -->
<script lang="ts" module>
	import type { Snippet } from "svelte";

	export type LabelProps = {
		for?: string;
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	};
</script>

<script lang="ts">
	import { orUndef, safeRest } from "../../utils/expr";

	let { for: htmlFor, class: className, children, ...rawRest }: LabelProps = $props();

	const rest = $derived(safeRest(rawRest));
	const cls = $derived(className);
</script>

<label for={orUndef(htmlFor)} {...(cls ? { class: cls } : {})} {...rest}>
	{@render children?.()}
</label>
