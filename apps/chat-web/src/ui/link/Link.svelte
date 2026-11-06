<!-- Generated from ui8kit/codegen Link brick (Svelte 5). Kit zone. -->
<script lang="ts" module>
	import type { Snippet } from "svelte";

	export type LinkProps = {
		href?: string;
		target?: string;
		rel?: string;
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	};
</script>

<script lang="ts">
	import { orUndef, safeRest, safeUrl } from "../../utils/expr";

	let { href, target, rel, class: className, children, ...rawRest }: LinkProps = $props();

	const rest = $derived(safeRest(rawRest));
	const cls = $derived(className);
	const safeHref = $derived(orUndef(safeUrl(href)));
</script>

<a href={safeHref} target={orUndef(target)} rel={orUndef(rel)} {...(cls ? { class: cls } : {})} {...rest}>
	{@render children?.()}
</a>
