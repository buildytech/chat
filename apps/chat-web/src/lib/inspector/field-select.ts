/**
 * Field-level selection in Build (ADR 0021): bridge the preview document and a block's generated view map so a click in
 * the preview finds the prop under the pointer, and a prop (picked in the preview or focused in the inspector) finds its
 * element in the frame and its control in the inspector. The block DOM is the registry output — no marker is added to it;
 * everything is resolved through `data-slot` and the registry `viewMap` (builder-core `view-map.ts`).
 */
import { fieldAtElement, locateField, renderBlock, viewMapOf, type ViewElement } from "@buildytech/builder-core";
import type { PageBlock } from "$lib/page-store";
import { fieldDomId } from "./fields";
import { blockSelector } from "./geometry";

/** The rendered registry block inside a PreviewBlock wrapper: its last element child that is not the provenance bar. */
function blockRoot(wrapper: Element): Element | null {
	for (let el = wrapper.lastElementChild; el; el = el.previousElementSibling) {
		if (el.getAttribute("data-slot") !== "block-provenance") return el;
	}
	return null;
}

/** The prop pointer the click landed on inside a block, or null (on the chrome, or on no mapped field). */
export function fieldAtClick(block: PageBlock, wrapper: Element, target: Element): string | null {
	const render = renderBlock(block);
	const map = render ? viewMapOf(render.item) : null;
	const root = blockRoot(wrapper);
	if (!render || !map || !root || !root.contains(target)) return null;
	return fieldAtElement(root as unknown as ViewElement, map, render.props, target as unknown as ViewElement);
}

/** The element of the preview document that shows `pointer` of a block, or null. */
export function fieldElement(doc: Document, block: PageBlock, pointer: string): Element | null {
	const wrapper = doc.querySelector(blockSelector(block.id));
	const render = renderBlock(block);
	const map = render ? viewMapOf(render.item) : null;
	const root = wrapper ? blockRoot(wrapper) : null;
	if (!render || !map || !root) return null;
	return locateField(root as unknown as ViewElement, map, render.props, pointer) as unknown as Element | null;
}

/** The inspector control of a field: its input, or the fieldset of an object / list / row. */
export function inspectorControl(doc: Document, blockId: string, pointer: string): HTMLElement | null {
	const scope = doc.querySelector(`[data-slot="inspector"]${blockSelector(blockId)}`) ?? doc;
	const byId = doc.getElementById(fieldDomId(blockId, pointer));
	if (byId && (scope === doc || scope.contains(byId))) return byId;
	const within = scope instanceof Element ? scope : doc;
	for (const el of within.querySelectorAll<HTMLElement>("[data-pointer]")) if (el.getAttribute("data-pointer") === pointer) return el;
	return null;
}

/** Focus a field's control in the inspector: open the collapsed group that holds it, bring it into view. */
export function focusInspectorControl(doc: Document, blockId: string, pointer: string): boolean {
	const el = inspectorControl(doc, blockId, pointer);
	if (!el) return false;
	const details = el.closest("details");
	if (details && !details.open) details.open = true;
	el.scrollIntoView({ block: "nearest", behavior: "smooth" });
	const focusable = el.matches("input, textarea, select") ? el : el.querySelector<HTMLElement>("input, textarea, select");
	(focusable ?? el).focus({ preventScroll: true });
	return true;
}
