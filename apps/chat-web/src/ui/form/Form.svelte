<!-- Generated from ui8kit/codegen Form brick (Svelte 5). Kit zone. -->
<!--
  Form renders a native form element; method is whitelisted (get|post|dialog).
-->
<script lang="ts" module>
	import type { Snippet } from "svelte";

	export type FormProps = {
		id?: string;
		name?: string;
		action?: string;
		method?: "get" | "post" | "dialog" | string;
		enctype?: string;
		novalidate?: boolean;
		autocomplete?: string;
		target?: string;
		"aria-label"?: string;
		"aria-labelledby"?: string;
		"aria-describedby"?: string;
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	};
</script>

<script lang="ts">
	import { oneOfOrLower, orUndef, safeRest } from "../../utils/expr";

	let {
		id,
		name,
		action,
		method,
		enctype,
		novalidate,
		autocomplete,
		target,
		"aria-label": ariaLabel,
		"aria-labelledby": ariaLabelledBy,
		"aria-describedby": ariaDescribedBy,
		class: className,
		children,
		...rawRest
	}: FormProps = $props();

	const rest = $derived(safeRest(rawRest));
	const cls = $derived(className);
	const methodValue = $derived(method ? oneOfOrLower(method, "", "get", "post", "dialog") : "");
</script>

<form
	id={orUndef(id)}
	name={orUndef(name)}
	action={orUndef(action)}
	method={orUndef(methodValue)}
	enctype={orUndef(enctype) as "application/x-www-form-urlencoded" | "multipart/form-data" | "text/plain" | undefined}
	novalidate={novalidate || undefined}
	autocomplete={orUndef(autocomplete) as HTMLFormElement["autocomplete"] | undefined}
	target={orUndef(target)}
	aria-label={orUndef(ariaLabel)}
	aria-labelledby={orUndef(ariaLabelledBy)}
	aria-describedby={orUndef(ariaDescribedBy)}
	{...(cls ? { class: cls } : {})}
	{...rest}
>
	{@render children?.()}
</form>
