/**
 * Render probe (ADR 0035): a page that passes the gate must show something in the preview and the export. The schema gate
 * checks the shape of props, not what the component does with them (an icon-less currency symbol where the component calls
 * `Intl.NumberFormat`, a list left empty that is the block's whole content). The host therefore renders every block of a
 * write with the SAME compiled registry block the preview uses (api/runtime/_render/blocks.mjs, built by
 * scripts/build-render-bundle.mjs) and rejects what throws or shows nothing, with the path of the prop that caused it.
 *
 * ONE probe function serves every caller (ADR 0038): `probeFromModule` turns a compiled-block module (`blocks` + `render`)
 * into a `RenderProbe`. The runtime and the coverage script give it the SSR bundle, the browser gives it the registry
 * components mounted on a detached element; write-time (`writePage`), the turn-start check (`renderProblems`) and
 * `scripts/inspector-coverage.mjs` all call the same function. The probe is installed by each entry. Where none is
 * installed (unit tests of pure page logic) the gate is unchanged; where it is required
 * (`installRenderProbe(fn, { required: true })`) a missing probe is a failure, never a silent pass.
 */
import type { BlockV2, PageV2 } from "@buildytech/page-contract";
import { renderBlock } from "./render.ts";

export type ProbeResult = { ok: true; html: string } | { ok: false; error: string };
/** Render one registry block (organism file name, effective props) to HTML. Must not throw. */
export type RenderProbe = (organism: string, props: Record<string, unknown>) => ProbeResult;
/** The part of a compiled-block module the probe uses: the blocks by organism file name, and a renderer for one of them. */
export type RenderModule = {
	blocks: Record<string, unknown>;
	render: (component: never, options: { props: Record<string, unknown> }) => { body: string };
};
export type ProbeOutcome = "throws" | "empty" | "content";
export type ProbeIssue = { path: string; code: "render_failed" | "render_empty" | "render_probe_unavailable"; expected: string; got?: unknown };

/** The one probe closure: a missing block or a throwing component is a failed result, never an exception. */
export function probeFromModule(mod: RenderModule): RenderProbe {
	return (organism, props) => {
		const component = mod.blocks[organism];
		if (!component) return { ok: false, error: `no compiled block ${organism}` };
		try {
			return { ok: true, html: mod.render(component as never, { props }).body };
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : String(err) };
		}
	};
}

/** What a render result amounts to for the page: it threw, shows nothing, or shows content. */
export function probeOutcome(result: ProbeResult): ProbeOutcome {
	return !result.ok ? "throws" : showsContent(result.html) ? "content" : "empty";
}

let probe: RenderProbe | null = null;
let required = false;
/** "reject": a block that shows nothing fails the write (the agent host). "allow": it passes and the preview says so (the browser: a freshly added block with registry sample props is a placeholder the author fills in). A block that throws fails either way. */
let emptyPolicy: "reject" | "allow" = "reject";
const CACHE = new Map<string, ProbeIssue | null>();

export function installRenderProbe(fn: RenderProbe | null, options: { required?: boolean; empty?: "reject" | "allow" } = {}): void {
	probe = fn;
	required = Boolean(options.required);
	emptyPolicy = options.empty ?? "reject";
	CACHE.clear();
}

export function renderProbeInstalled(): boolean {
	return probe !== null;
}

/** HTML without comments and styles. */
function visible(html: string): { html: string; text: string } {
	const clean = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<script[\s\S]*?<\/script>/g, "");
	return { html: clean.trim(), text: clean.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim() };
}

/** What the rendered markup shows: any text, or an image, icon, media or control. */
export function showsContent(html: string): boolean {
	const { html: clean, text } = visible(html);
	return clean !== "" && (text !== "" || /<(img|svg|video|picture|canvas|iframe|input|textarea|select|button)\b/i.test(clean));
}

/** UTF-8 bytes of a string, one per character (what V8 writes into some Intl errors); no Node `Buffer`, so it runs in the browser. */
function latin1Bytes(value: string): string {
	return Array.from(new TextEncoder().encode(value), (byte) => String.fromCharCode(byte)).join("");
}

/** A string whose characters are all bytes (< 256) read as UTF-8; null when it is not one. */
function fromLatin1Bytes(value: string): string | null {
	const bytes = new Uint8Array(value.length);
	for (let i = 0; i < value.length; i += 1) {
		const code = value.charCodeAt(i);
		if (code > 255) return null;
		bytes[i] = code;
	}
	return new TextDecoder("utf-8").decode(bytes);
}

/**
 * V8 writes the argument of some Intl errors ("Invalid currency code : ...") one byte per character, so a non-Latin-1 value
 * comes back as its UTF-8 bytes read as Latin-1 (a rouble sign as "a" + two more characters). Undo that when it round-trips.
 */
function readable(message: string): string {
	const back = fromLatin1Bytes(message);
	return back !== null && back !== message && !back.includes("\ufffd") ? back : message;
}

/** JSON Pointer of the first string leaf whose value appears in an error message (the prop the component choked on). */
function culprit(props: unknown, message: string): string | null {
	let found: string | null = null;
	const walk = (value: unknown, path: string): void => {
		if (found) return;
		if (typeof value === "string") {
			if (value.length > 0 && value.length <= 40 && (message.includes(value) || message.includes(latin1Bytes(value)))) found = path;
		} else if (Array.isArray(value)) value.forEach((entry, i) => walk(entry, `${path}/${i}`));
		else if (value && typeof value === "object") for (const [key, entry] of Object.entries(value)) walk(entry, `${path}/${key.replace(/~/g, "~0").replace(/\//g, "~1")}`);
	};
	walk(props, "");
	return found;
}

/** Props that are empty lists: what a block with no content most likely lacks. */
function emptyLists(props: Record<string, unknown>): string[] {
	return Object.entries(props).filter(([, value]) => Array.isArray(value) && value.length === 0).map(([key]) => key);
}

function probeBlock(item: string, variant: string | undefined, props: Record<string, unknown> | undefined, at: string): ProbeIssue | null {
	const rendered = renderBlock({ item, variant, props: props as BlockV2["props"] });
	if (!rendered) return null;
	const key = `${rendered.organism}\n${JSON.stringify(rendered.props)}`;
	const hit = CACHE.get(key);
	if (hit !== undefined) return hit && { ...hit, path: `${at}${hit.path}` };
	let issue: ProbeIssue | null = null;
	let result: ProbeResult;
	try {
		result = probe!(rendered.organism, rendered.props);
	} catch (err) {
		result = { ok: false, error: err instanceof Error ? err.message : String(err) };
	}
	if (!result.ok) {
		const raw = result.error.split("\n")[0]!.slice(0, 200);
		const where = culprit(rendered.props, raw);
		const message = readable(raw);
		issue = {
			path: `/props${where ?? ""}`,
			code: "render_failed",
			expected: `props ${item} can render: its component threw "${message}" while rendering${where ? " with this value" : ""}`,
			got: where ? undefined : "see the error above"
		};
		if (where) issue.got = message;
	} else if (!showsContent(result.html)) {
		const lists = emptyLists(rendered.props);
		issue = {
			path: "/props",
			code: "render_empty",
			expected: `props that make ${item}/${rendered.variant} show content: it renders nothing now${lists.length ? ` (empty lists: ${lists.join(", ")})` : ""}; write its texts, rows and images`,
			got: lists.length ? lists.map((name) => `${name}: []`).join(", ") : "nothing visible"
		};
	}
	CACHE.set(key, issue);
	return issue && { ...issue, path: `${at}${issue.path}` };
}

/** Render issues of a (schema-valid) page; `at` indexes are the block indexes of the page. Blocks whose props already failed are skipped by the caller. */
export function renderIssues(page: PageV2, skip: ReadonlySet<number> = new Set()): ProbeIssue[] {
	const todo = page.blocks.flatMap((block, index) => (skip.has(index) ? [] : [{ block, index }]));
	// Nothing to render (a rename, a move, a removal): nothing was left unchecked, so a missing probe is not a failure.
	if (todo.length === 0) return [];
	if (!probe) {
		return required ? [{ path: "/", code: "render_probe_unavailable", expected: "the render probe (api/runtime/_render/blocks.mjs, `npm run bundle:runtime`) to be loaded" }] : [];
	}
	const out: ProbeIssue[] = [];
	for (const { block, index } of todo) {
		const issue = probeBlock(block.item, block.variant, block.props as Record<string, unknown> | undefined, `/blocks/${index}`);
		if (issue && !(emptyPolicy === "allow" && issue.code === "render_empty")) out.push(issue);
	}
	return out;
}

/** Blocks of the page that throw or show nothing in the preview now (what get_page tells the agent); empty without a probe. */
export function renderProblems(page: PageV2): ProbeIssue[] {
	return renderIssues(page).filter((issue) => issue.code !== "render_probe_unavailable");
}
