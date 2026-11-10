<script lang="ts">
	// Styles are per route: the chat imports app.css, the standalone /preview imports the registry's own CSS.
	import type { Snippet } from "svelte";

	let { children }: { children: Snippet } = $props();
</script>

{@render children()}
