<script lang="ts">
	// /build: the builder's own address (Open in BuildY links, /build?collection=..., contract docs/collection-intake.md).
	// It opens the same app as / in every build; the chat module, when loaded, reads the collection link.
	import "../../app.css";
	import BuilderApp from "../../app/BuilderApp.svelte";
</script>

<BuilderApp />
