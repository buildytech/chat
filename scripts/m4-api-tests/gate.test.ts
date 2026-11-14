/** The item 6 gate tooling: the ratchet counter and the ui8px class extractor (pure parts). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { assertionCounts } from "../check-ratchet.mjs";
import { classSets } from "../ui8px-extract.mjs";

test("assertion counter: as unknown as, as never and other assertions; imports and `as const` are not counted", () => {
	const text = [
		'import { a as b } from "x";',
		'export { c as d } from "y";',
		"const x = raw as unknown as Foo;",
		"const y = value as never;",
		"const z = value as Record<string, unknown>;",
		"const k = [1] as const;",
		"// const w = ignored as Bar;",
		"const s = (event.target as HTMLInputElement).value;"
	].join("\n");
	assert.deepEqual(assertionCounts(text), { asUnknownAs: 1, asNever: 1, asType: 2 });
});

test("ui8px extractor reads static classes and the literals of class={...}, not template parts", () => {
	const text = ['<div class="flex gap-2 p-4">', '<span class={cn("text-sm", open && "font-medium", `x-${n}`)}>', "</span>", '<i class={active ? "bg-accent px-2" : "px-4"}></i>'].join("\n");
	const values = classSets(text).map((s) => s.value);
	assert.ok(values.includes("flex gap-2 p-4"));
	assert.ok(values.includes("bg-accent px-2") && values.includes("px-4"));
	assert.ok(!values.some((v) => v.includes("${")));
});
