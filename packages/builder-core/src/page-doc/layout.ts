/**
 * Variant and layout axes of a block (t85u): the variant is the source of truth, the host writes the axes it sets
 * (block-contract/v1 `axes`: hero-simple `media`, team-simple `cols` and `surface`) into the block's props.
 *   - A write that names a new variant gets its axes; axis values carried over from the block as it was are stale and
 *     replaced. An axis written to a value of neither the old nor the new variant is a contradiction: rejected.
 *   - A write that keeps the variant (or names none) but writes other axis values picks the one variant with exactly
 *     those axes (said in the notes: the Inspector or a patch of `/props/media`); no such variant: rejected.
 *   - On a variant change a setting the variants set on their own (`align` of mediaTop) follows the new variant only
 *     while it still holds the old variant's value; a value set by hand is kept.
 * Rejections are props_invalid at the axis, with the variants and their axes in `expected`.
 */
import type { BlockV2, PropValueV2 } from "@buildytech/page-contract";
import { layoutAxes, variantAxisValues, variantSettingDefault, variantSettingNames } from "../catalog/blocks.ts";
import type { DocIssue } from "./gate.ts";
import { itemInfo } from "./items.ts";

type Props = Record<string, PropValueV2>;
type LayoutResult = { ok: true; variant: string | undefined; props: Props | undefined; notes: string[] } | { ok: false; issues: DocIssue[] };

const show = (axes: Record<string, string>) => Object.entries(axes).map(([axis, value]) => `${axis} ${JSON.stringify(value)}`).join(", ");

function variantsText(item: string, variants: readonly string[]): string {
	return variants.map((name) => `${name} (${show(variantAxisValues(item, name) ?? {})})`).join("; ");
}

/**
 * The variant and props of one written block after the layout rule. `prior` is the block as it was (same id and item),
 * absent for a new block or an item change. Blocks without axes, and unknown variants (the gate says so), pass through.
 */
export function reconcileLayout(item: string, at: string, prior: Pick<BlockV2, "variant" | "props"> | undefined, variant: string | undefined, props: Props | undefined): LayoutResult {
	const info = itemInfo(item);
	const axes = layoutAxes(item);
	if (!info || !axes.length || (variant !== undefined && !info.variants.includes(variant))) return { ok: true, variant, props, notes: [] };
	const priorVariant = prior ? (prior.variant && info.variants.includes(prior.variant) ? prior.variant : info.defaultVariant) : undefined;
	const named = variant !== undefined && (priorVariant === undefined || variant !== priorVariant);
	const current = variant ?? priorVariant ?? info.defaultVariant;
	const written: Record<string, string> = {};
	for (const axis of axes) {
		const value = props?.[axis];
		if (value !== undefined && value !== null) written[axis] = String(value);
	}
	const target = variantAxisValues(item, current) ?? {};
	let chosen = current;
	const notes: string[] = [];
	if (named) {
		const priorAxes = priorVariant ? (variantAxisValues(item, priorVariant) ?? {}) : {};
		const stale = (axis: string, value: string) => prior !== undefined && (value === String(prior.props?.[axis] ?? "") || value === priorAxes[axis]);
		const clash = axes.filter((axis) => written[axis] !== undefined && written[axis] !== target[axis] && !stale(axis, written[axis]!));
		if (clash.length) {
			return {
				ok: false,
				issues: clash.map((axis) => ({
					path: `${at}/props/${axis}`,
					code: "props_invalid",
					expected: `${JSON.stringify(target[axis])}: variant ${current} sets ${axis}. Leave ${axes.join(", ")} out (the variant sets them) or pick the variant with that layout: ${variantsText(item, info.variants)}`,
					got: written[axis]
				}))
			};
		}
	} else if (axes.some((axis) => written[axis] !== undefined && written[axis] !== target[axis])) {
		const wanted = { ...target, ...written };
		const matches = info.variants.filter((name) => {
			const values = variantAxisValues(item, name) ?? {};
			return axes.every((axis) => values[axis] === wanted[axis]);
		});
		if (matches.length !== 1) {
			const axis = axes.find((name) => written[name] !== undefined && written[name] !== target[name])!;
			return {
				ok: false,
				issues: [{
					path: `${at}/props/${axis}`,
					code: "props_invalid",
					expected: `a layout of one variant: ${show(wanted)} is none. Set variant instead of the axes: ${variantsText(item, info.variants)}`,
					got: written[axis]
				}]
			};
		}
		chosen = matches[0]!;
		notes.push(`variant ${current} -> ${chosen} (the layout axes ${show(written)} written).`);
	}
	if (!props) return { ok: true, variant: chosen === current ? variant : chosen, props, notes };
	const out: Props = { ...props };
	const axisValues = variantAxisValues(item, chosen) ?? {};
	for (const axis of axes) if (axisValues[axis] !== undefined) out[axis] = axisValues[axis]!;
	const from = priorVariant ?? (named ? undefined : current);
	if (prior && from !== undefined && from !== chosen) {
		const kept: string[] = [];
		for (const name of variantSettingNames(item)) {
			const value = out[name];
			const before = variantSettingDefault(item, from, name);
			if (value === undefined || value === before) {
				const next = variantSettingDefault(item, chosen, name);
				if (next === undefined) delete out[name];
				else out[name] = next;
			} else kept.push(`${name} ${JSON.stringify(value)}`);
		}
		if (kept.length) notes.push(`variant ${from} -> ${chosen}: ${kept.join(", ")} kept (set by hand).`);
	}
	return { ok: true, variant: chosen === current ? variant : chosen, props: out, notes };
}
