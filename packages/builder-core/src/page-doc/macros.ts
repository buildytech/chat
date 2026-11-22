/**
 * Content macros (ADR 0066): a token in a text prop that the render replaces with a value of the moment, so a page
 * written once stays right ("© {year} Shop" shows the current year). The syntax is the one of the WordPress builder
 * (wp-fasty `Links::TOKEN`): `{name}` or `{name:argument}`, lowercase. Only the names of `MACROS` are replaced; any other
 * `{…}` text, an unknown name included, stays as it is (literal braces in copy never break a page).
 *
 * `renderBlock` applies them, so the preview, the code pane, the ZIP export and the render probe show the same text. The
 * page document keeps the token: the inspector edits `{year}`, and the next render or export shows the year of then.
 */
export type MacroContext = {
	/** The moment of the render; the year is read in the local time zone of the host that renders (the author's browser). */
	now: Date;
};

type Macro = {
	/** What the token stands for (the agent's prompt and the docs list it). */
	description: string;
	/** The value; `argument` is the part after `:`, absent when the token has none. Null: the token stays as written. */
	value: (context: MacroContext, argument: string | undefined) => string | null;
};

/** The registry of macros. A new one is one entry here plus a test; the agent rule lists the names from `macroNames`. */
export const MACROS: ReadonlyMap<string, Macro> = new Map<string, Macro>([
	[
		"year",
		{
			description: "the current year (four digits), for the copyright line",
			value: ({ now }, argument) => (argument === undefined ? String(now.getFullYear()) : null)
		}
	]
]);

/** Every `{name}` / `{name:argument}` token; the name decides whether it is a macro. */
const TOKEN = /\{([a-z][a-z0-9-]*)(?::([a-z0-9_-]+))?\}/g;

export function macroNames(): string[] {
	return [...MACROS.keys()];
}

/** `text` with every known macro replaced; unknown tokens and stray braces are kept. */
export function expandMacros(text: string, context: MacroContext = { now: new Date() }): string {
	if (!text.includes("{")) return text;
	return text.replace(TOKEN, (token, name: string, argument: string | undefined) => {
		return MACROS.get(name)?.value(context, argument) ?? token;
	});
}

/** A copy of `props` with the macros of every string inside them (object values and list items, at any depth) expanded. */
export function expandMacrosDeep(props: Record<string, unknown>, context: MacroContext = { now: new Date() }): Record<string, unknown> {
	const walk = (inner: unknown): unknown => {
		if (typeof inner === "string") return expandMacros(inner, context);
		if (Array.isArray(inner)) return inner.map(walk);
		if (inner && typeof inner === "object") return Object.fromEntries(Object.entries(inner).map(([key, entry]) => [key, walk(entry)]));
		return inner;
	};
	return Object.fromEntries(Object.entries(props).map(([key, entry]) => [key, walk(entry)]));
}
