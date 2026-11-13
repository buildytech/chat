/**
 * Render probe (ADR 0035): a page that passes the gate must show something in the preview and the export. The schema gate
 * checks the shape of props, not what the component does with them (an icon-less currency symbol where the component calls
 * `Intl.NumberFormat`, a list left empty that is the block's whole content). The host therefore renders every block of a
 * write with the SAME compiled registry block the preview uses (api/runtime/_render/blocks.mjs, built by
 * scripts/build-render-bundle.mjs) and rejects what throws or shows nothing, with the path of the prop that caused it.
 *
 * The probe is installed by the runtime entry (server side). Where none is installed (the browser, unit tests of pure
 * page logic) the gate is unchanged; where it is required (`installRenderProbe(fn, { required: true })`) a missing probe is
 * a failure, never a silent pass.
 */
import type { PageV2 } from "@buildytech/page-contract";
import { renderBlock } from "./render.ts";

export type ProbeResult = { ok: true; html: string } | { ok: false; error: string };
/** Render one registry block (organism file name, effective props) to HTML. Must not throw. */
export type RenderProbe = (organism: string, props: Record<string, unknown>) => ProbeResult;
export type ProbeIssue = { path: string; code: "render_failed" | "render_empty" | "render_probe_unavailable"; expected: string; got?: unknown };

let probe: RenderProbe | null = null;
let required = false;
const CACHE = new Map<string, ProbeIssue | null>();

export function installRenderProbe(fn: RenderProbe | null, options: { required?: boolean } = {}): void {
	probe = fn;
	required = Boolean(options.required);
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

/**
 * V8 writes the argument of some Intl errors ("Invalid currency code : ...") one byte per character, so a non-Latin-1 value
 * comes back as its UTF-8 bytes read as Latin-1 (a rouble sign as "a" + two more characters). Undo that when it round-trips.
 */
function readable(message: string): string {
	const back = Buffer.from(message, "latin1").toString("utf8");
	return back !== message && !back.includes("\ufffd") ? back : message;
}

/** JSON Pointer of the first string leaf whose value appears in an error message (the prop the component choked on). */
function culprit(props: unknown, message: string): string | null {
	let found: string | null = null;
	const bytes = (value: string) => Buffer.from(value, "utf8").toString("latin1");
	const walk = (value: unknown, path: string): void => {
		if (found) return;
		if (typeof value === "string") {
			if (value.length > 0 && value.length <= 40 && (message.includes(value) || message.includes(bytes(value)))) found = path;
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
	const rendered = renderBlock({ item, variant, props } as never);
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
	if (!probe) {
		return required ? [{ path: "/", code: "render_probe_unavailable", expected: "the render probe (api/runtime/_render/blocks.mjs, `npm run bundle:runtime`) to be loaded" }] : [];
	}
	const out: ProbeIssue[] = [];
	page.blocks.forEach((block, index) => {
		if (skip.has(index)) return;
		const issue = probeBlock(block.item, block.variant, block.props as Record<string, unknown> | undefined, `/blocks/${index}`);
		if (issue) out.push(issue);
	});
	return out;
}

/** Blocks of the page that throw or show nothing in the preview now (what get_page tells the agent); empty without a probe. */
export function renderProblems(page: PageV2): ProbeIssue[] {
	return renderIssues(page).filter((issue) => issue.code !== "render_probe_unavailable");
}
