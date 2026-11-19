/**
 * The props validator slot of the program gate (ADR 0010): props-gate.ts installs an Ajv 2020 validator of the pinned
 * props schemas; until then the gate is fail-closed (a page with a registry block is rejected).
 */
import type { RegistryRender } from "./organism.ts";

/** One problem of the merged props of a registry block, as the published props schema reports it. */
export type PropsIssue = {
	/** JSON Pointer into the block props, e.g. /members/2/title. */
	pointer: string;
	keyword: string;
	message: string;
	/** The value that was rejected, when there is one. */
	value?: unknown;
	/** enum: every allowed value (a layout axis, a setting). */
	allowed?: unknown[];
};

/** Validates the merged props of a registry block against its published schema (props-gate.ts installs it). */
export type PropsValidator = (render: RegistryRender) => PropsIssue[];

let PROPS_VALIDATOR: PropsValidator | null = null;

/** Install the props validator (the browser loads props-gate.ts lazily before its first write; the runtime at start). */
export function setPropsValidator(validator: PropsValidator | null): void {
	PROPS_VALIDATOR = validator;
}

export function propsValidatorInstalled(): boolean {
	return PROPS_VALIDATOR !== null;
}

/** Issues of the props of one registry item; null while no validator is installed (the gate is fail-closed). */
export function validateItemProps(item: string, props: Record<string, unknown>): PropsIssue[] | null {
	return PROPS_VALIDATOR ? PROPS_VALIDATOR({ item, props } as RegistryRender) : null;
}
