<!-- Generated from ui8kit/codegen Icon brick (Svelte 5). Kit zone. -->
<!--
  Icon renders span[data-slot=icon]; Label switches to role=img + aria-label.
-->
<script lang="ts" module>
	import type { Snippet } from "svelte";

	export type IconSize = "xs" | "sm" | "md" | "lg" | "xl";

	export type IconProps = {
		size?: IconSize | string;
		label?: string;
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	};
</script>

<script lang="ts">
	import { safeRest } from "../../utils/expr";
	import { iconClasses } from "./icon.shared";

	let { size, label, class: className, children, ...rawRest }: IconProps = $props();

	const rest = $derived(safeRest(rawRest));
	const cls = $derived(iconClasses({ size, className }));
	const labelled = $derived(Boolean(label && label.trim()));
</script>

<span
	data-slot="icon"
	class={cls}
	role={labelled ? "img" : undefined}
	aria-label={labelled ? label : undefined}
	aria-hidden={labelled ? undefined : "true"}
	{...rest}
>
	{@render children?.()}
</span>
