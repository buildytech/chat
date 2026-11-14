/**
 * The money boundary (owner decision t196u; the Woo / Stripe / Shopify pattern). The document stores money in minor units, as the
 * registry's Codex v0.4 asks (65000 RUB shows as 650), but the model never sees or writes them: everything it reads (the page, a
 * sample) is shown in major units, and everything it writes (a whole page, the value of a JSON Patch operation) is converted back
 * before the write gate and storage. Pure; one conversion pair (toMajor / toMinor with the digits of the currency, JPY and KRW
 * have none) and the schema decides which props are money (props-schema.ts: a number named like the registry's money names beside
 * a `currency` prop). Hosts that are not the model (the Inspector, the client gate, export) use the stored document as it is.
 */
import type { PageV2 } from "@buildytech/page-contract";
import { toMajor, toMinor } from "../catalog/money.ts";
import { propsFieldTree, type PropsFieldNode } from "../catalog/props-schema.ts";

type MoneyDirection = "view" | "store";

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const convert = (value: number, currency: string, to: MoneyDirection): number => (to === "view" ? toMajor(value, currency) : toMinor(value, currency));

/** A value of the shape `nodes` describe (an object or a row), its money props converted; `currency` is the fallback when it has none of its own. */
function walk(value: unknown, nodes: PropsFieldNode[] | undefined, to: MoneyDirection, currency?: string): unknown {
	return isObject(value) && nodes ? walkObject(value, nodes, to, currency) : value;
}

function walkObject(value: Record<string, unknown>, nodes: PropsFieldNode[], to: MoneyDirection, currency?: string): Record<string, unknown> {
	const own = typeof value.currency === "string" && value.currency ? value.currency : currency;
	const out: Record<string, unknown> = { ...value };
	for (const node of nodes) {
		const inner = value[node.name];
		if (inner === undefined) continue;
		if (node.money) {
			if (typeof inner === "number" && own) out[node.name] = convert(inner, own, to);
		} else if (node.kind === "list" && Array.isArray(inner) && node.fields) out[node.name] = inner.map((row) => walk(row, node.fields, to));
		else if (node.kind === "object" && node.fields) out[node.name] = walk(inner, node.fields, to);
	}
	return out;
}

/** The props of a block of `item` with its money converted ("view": stored -> major, "store": major -> stored). Props without money are returned as they are. */
export function convertProps(item: string, props: unknown, to: MoneyDirection): Record<string, unknown> {
	if (!isObject(props)) return {};
	const tree = propsFieldTree(item);
	return tree ? walkObject(props, tree, to) : props;
}

function convertBlock(block: unknown, to: MoneyDirection): unknown {
	return isObject(block) && typeof block.item === "string" && isObject(block.props) ? { ...block, props: convertProps(block.item, block.props, to) } : block;
}

/** A page document with the money of every block converted. */
function convertPage<T extends { blocks?: unknown }>(page: T, to: MoneyDirection): T {
	return Array.isArray(page.blocks) ? { ...page, blocks: page.blocks.map((block: unknown) => convertBlock(block, to)) } : page;
}

/** What the model reads of a page: stored minor units shown as major units. */
export const pageForModel = (page: PageV2): PageV2 => convertPage(page, "view");
/** What the model writes as a whole page: major units turned into what the document stores. */
export const pageFromModel = <T extends { blocks?: unknown }>(page: T): T => convertPage(page, "store");

/** The input of write_page as the model wrote it ({ page } or { patch }, money in major units) as the write gate takes it (money in stored units). */
export function writeInputFromModel(working: PageV2, args: { page?: unknown; patch?: unknown }): { page?: unknown; patch?: unknown } {
	const input: { page?: unknown; patch?: unknown } = {};
	if (args.page !== undefined) input.page = isObject(args.page) ? pageFromModel(args.page) : args.page;
	if (args.patch !== undefined) input.patch = isObject(args.patch) && Array.isArray(args.patch.ops) ? { ...args.patch, ops: patchFromModel(working, args.patch.ops) } : patchFromModel(working, args.patch);
	return input;
}

/** Where a JSON Pointer inside a block's props lands in the field tree: the nodes a value there is made of, or the money node itself. */
type Target = { kind: "fields"; nodes: PropsFieldNode[] } | { kind: "money"; parentPointer: string } | null;

function targetAt(item: string, pointer: string): Target {
	let nodes: PropsFieldNode[] | undefined = propsFieldTree(item) ?? undefined;
	let current: PropsFieldNode | undefined;
	const parts = pointer.split("/").slice(1);
	for (let i = 0; i < parts.length; i += 1) {
		const part = parts[i]!;
		if (/^\d+$/.test(part) || part === "-") {
			// a row of the list `current`: what lies below is its fields
			if (!current || current.kind !== "list" || !current.fields) return null;
			nodes = current.fields;
			current = undefined;
			continue;
		}
		const next: PropsFieldNode | undefined = nodes?.find((node) => node.name === part);
		if (!next) return null;
		if (next.money) return i === parts.length - 1 ? { kind: "money", parentPointer: parts.slice(0, i).map((p) => `/${p}`).join("") } : null;
		current = next;
		nodes = next.kind === "object" ? next.fields : undefined;
	}
	if (!current) return nodes ? { kind: "fields", nodes } : null;
	if (current.kind === "list" && current.fields) return { kind: "fields", nodes: current.fields };
	if (current.kind === "object" && current.fields) return { kind: "fields", nodes: current.fields };
	return null;
}

function valueAtPointer(root: unknown, pointer: string): unknown {
	let current = root;
	for (const part of pointer.split("/").slice(1)) {
		if (current === null || typeof current !== "object") return undefined;
		const key = part.replace(/~1/g, "/").replace(/~0/g, "~");
		current = isObject(current) ? current[key] : Array.isArray(current) ? current[Number(key)] : undefined;
	}
	return current;
}

/** A block as an operation sees it: its item and props (the currency beside a lone money value is read from them). */
type Slot = { item: string; props: unknown };

const BLOCK_PATH = /^\/blocks\/(\d+|-)(\/.*)?$/;

/** The value of one operation (path under `/blocks`) from what the model wrote to what the document stores; `blocks` are the blocks the operation sees, in order. */
function opValue(blocks: readonly Slot[], path: string, value: unknown): unknown {
	if (path === "" || path === "/") return isObject(value) ? pageFromModel(value) : value;
	if (path === "/blocks") return Array.isArray(value) ? value.map((block: unknown) => convertBlock(block, "store")) : value;
	const hit = BLOCK_PATH.exec(path);
	if (!hit) return value;
	const index = hit[1] === "-" ? blocks.length : Number(hit[1]);
	const rest = hit[2] ?? "";
	if (rest === "") return convertBlock(value, "store");
	if (!rest.startsWith("/props")) return value;
	const item = blocks[index]?.item;
	if (!item) return value;
	const pointer = rest.slice("/props".length);
	if (pointer === "") return convertProps(item, value, "store");
	const target = targetAt(item, pointer);
	if (!target) return value;
	if (target.kind === "fields") {
		if (Array.isArray(value)) return value.map((row) => walk(row, target.nodes, "store"));
		return walk(value, target.nodes, "store");
	}
	// a lone money prop: the currency sits beside it in the block as it is now
	const owner = valueAtPointer(blocks[index]?.props, target.parentPointer);
	const currency = isObject(owner) && typeof owner.currency === "string" ? owner.currency : undefined;
	return typeof value === "number" && currency ? toMinor(value, currency) : value;
}

/** The operations of a JSON Patch the model wrote with their values in stored units (paths and operations unchanged). `base` is the page the patch applies to. */
export function patchFromModel(base: PageV2, ops: unknown): unknown {
	if (!Array.isArray(ops)) return ops;
	const slots: Slot[] = base.blocks.map((block) => ({ item: block.item, props: block.props }));
	return ops.map((op) => {
		if (!isObject(op) || typeof op.path !== "string") return op;
		const kind = op.op;
		let out = op;
		if ((kind === "add" || kind === "replace" || kind === "test") && "value" in op) out = { ...op, value: opValue(slots, op.path, op.value) };
		// keep the blocks in step with block adds and removes, so later indices find their block
		const block = /^\/blocks\/(\d+|-)$/.exec(op.path);
		if (block && kind === "add") slots.splice(block[1] === "-" ? slots.length : Number(block[1]), 0, isObject(op.value) && typeof op.value.item === "string" ? { item: op.value.item, props: op.value.props } : { item: "", props: undefined });
		else if (block && kind === "remove" && block[1] !== "-") slots.splice(Number(block[1]), 1);
		return out;
	});
}
