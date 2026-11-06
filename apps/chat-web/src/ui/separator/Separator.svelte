<!-- Generated from ui8kit/codegen Separator brick (Svelte 5). Kit zone. -->
<script lang="ts" module>
	export type SeparatorProps = {
		orientation?: "horizontal" | "vertical";
		class?: string;
		[key: string]: unknown;
	};
</script>

<script lang="ts">
	import { cn } from "../../utils/cn";
	import { safeRest } from "../../utils/expr";

	let { orientation = "horizontal", class: className, ...rawRest }: SeparatorProps = $props();

	const rest = $derived(safeRest(rawRest));
	const vertical = $derived(orientation === "vertical");
	const cls = $derived(
		cn(
			"bg-border shrink-0",
			vertical ? "h-full w-px" : "h-px w-full",
			className
		)
	);
</script>

<hr
	role="separator"
	aria-orientation={vertical ? "vertical" : "horizontal"}
	class={cls}
	{...rest}
/>
