<script lang="ts" module>
	export type CodeEditorProps = {
		/** document text */
		doc: string;
		/** 1-based line that holds the cursor initially */
		activeLine?: number;
		editable?: boolean;
		language?: "json" | "svelte";
		class?: string;
		[key: string]: unknown;
	};
</script>

<script lang="ts">
	import { untrack } from "svelte";
	import { EditorView } from "@codemirror/view";
	import { EditorState } from "@codemirror/state";
	import { cn } from "$registry/utils/cn";
	import { editorCode, remeasure } from "$lib/editor/editor-code";

	let {
		doc,
		activeLine = 1,
		editable = false,
		language = "svelte",
		class: className,
		...rest
	}: CodeEditorProps = $props();

	let host: HTMLDivElement | undefined = $state();
	let view: EditorView | undefined;

	$effect(() => {
		const el = host;
		const lang = language;
		const canEdit = editable;
		if (!el) return;

		const state = EditorState.create({
			doc: untrack(() => doc),
			extensions: editorCode({ editable: canEdit, language: lang })
		});
		const line = state.doc.line(Math.min(Math.max(untrack(() => activeLine), 1), state.doc.lines));
		const next = new EditorView({
			parent: el,
			state: state.update({ selection: { anchor: line.from } }).state
		});
		view = next;
		void document.fonts.ready.then(() => {
			if (view === next) next.dispatch({ effects: remeasure.of(null) });
		});
		return () => {
			next.destroy();
			if (view === next) view = undefined;
		};
	});

	$effect(() => {
		const nextDoc = doc;
		const current = view;
		if (!current) return;
		if (current.state.doc.toString() !== nextDoc) {
			current.dispatch({
				changes: { from: 0, to: current.state.doc.length, insert: nextDoc }
			});
		}
	});
</script>

<div class={cn("code-editor", className)} data-slot="code-editor" bind:this={host} {...rest}></div>
