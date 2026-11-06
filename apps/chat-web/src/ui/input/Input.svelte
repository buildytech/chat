<!-- Generated from ui8kit/codegen Input brick (Svelte 5). Kit zone. -->
<!--
  Input renders a native input element (default type text).
-->
<script lang="ts" module>
	export type InputProps = {
		type?: string;
		id?: string;
		name?: string;
		value?: string;
		placeholder?: string;
		min?: string;
		max?: string;
		step?: string;
		required?: boolean;
		disabled?: boolean;
		readOnly?: boolean;
		"aria-invalid"?: string;
		"aria-describedby"?: string;
		class?: string;
		[key: string]: unknown;
	};
</script>

<script lang="ts">
	import { defaultIfEmpty, orUndef, safeRest } from "../../utils/expr";

	let {
		type,
		id,
		name,
		value,
		placeholder,
		min,
		max,
		step,
		required,
		disabled,
		readOnly,
		"aria-invalid": ariaInvalid,
		"aria-describedby": ariaDescribedBy,
		class: className,
		...rawRest
	}: InputProps = $props();

	const rest = $derived(safeRest(rawRest));
	const cls = $derived(className);
	const inputType = $derived(defaultIfEmpty(type, "text"));
</script>

<input
	type={inputType}
	id={orUndef(id)}
	name={orUndef(name)}
	value={value}
	placeholder={orUndef(placeholder)}
	min={orUndef(min)}
	max={orUndef(max)}
	step={orUndef(step)}
	required={required || undefined}
	disabled={disabled || undefined}
	readonly={readOnly || undefined}
	aria-invalid={orUndef(ariaInvalid) as "true" | "false" | "grammar" | "spelling" | undefined}
	aria-describedby={orUndef(ariaDescribedBy)}
	{...(cls ? { class: cls } : {})}
	{...rest}
/>
