/**
 * Scoped kit styles for the chat preview, generated from the vendored registry styles (styles/theme.css, styles/kit.css).
 *
 * The chat keeps its own theme (zinc, Istok Web, its radius). Inside `.ui8kit-preview` the kit tokens apply: every
 * kit colour as a literal value (light, and dark under `.dark` or `[data-theme="dark"]`), the kit radius scale, the
 * Tailwind default sans font, and the kit base and data-slot rules with their selectors prefixed by the scope.
 * Kit colours the chat theme has no utility for are added as `@theme inline` keys that read a scoped variable.
 * Pure function of the inputs; registry-snapshot.mjs writes the result and checks it offline.
 */

export const SCOPE = ".ui8kit-preview";
const DARK = `:is(.dark, [data-theme="dark"]) ${SCOPE}, ${SCOPE}:is(.dark, [data-theme="dark"])`;

/** Minimal CSS reader: top-level and nested blocks with their preludes, and declarations. Comments dropped. */
export function parseCss(text) {
	const src = text.replace(/\/\*[\s\S]*?\*\//g, "");
	let i = 0;
	function block() {
		const nodes = [];
		let buf = "";
		while (i < src.length) {
			const ch = src[i];
			if (ch === '"' || ch === "'") {
				const end = src.indexOf(ch, i + 1);
				buf += src.slice(i, end + 1);
				i = end + 1;
			} else if (ch === "(") {
				let depth = 0;
				const start = i;
				do {
					if (src[i] === "(") depth += 1;
					else if (src[i] === ")") depth -= 1;
					else if (src[i] === '"' || src[i] === "'") i = src.indexOf(src[i], i + 1);
					i += 1;
				} while (depth > 0 && i < src.length);
				buf += src.slice(start, i);
			} else if (ch === "{") {
				i += 1;
				const prelude = buf.trim();
				buf = "";
				nodes.push({ prelude, children: block() });
			} else if (ch === "}") {
				i += 1;
				if (buf.trim()) nodes.push({ decl: buf.trim() });
				return nodes;
			} else if (ch === ";") {
				i += 1;
				if (buf.trim()) nodes.push({ decl: buf.trim() });
				buf = "";
			} else {
				buf += ch;
				i += 1;
			}
		}
		if (buf.trim()) nodes.push({ decl: buf.trim() });
		return nodes;
	}
	return block();
}

const declMap = (nodes) =>
	Object.fromEntries(
		nodes.filter((node) => node.decl && !node.decl.startsWith("@")).map((node) => {
			const at = node.decl.indexOf(":");
			return [node.decl.slice(0, at).trim(), node.decl.slice(at + 1).trim()];
		})
	);

function splitSelectors(prelude) {
	const parts = [];
	let depth = 0;
	let buf = "";
	for (const ch of prelude) {
		if (ch === "(") depth += 1;
		if (ch === ")") depth -= 1;
		if (ch === "," && depth === 0) {
			parts.push(buf.trim());
			buf = "";
		} else buf += ch;
	}
	if (buf.trim()) parts.push(buf.trim());
	return parts;
}

function scopeSelector(selector) {
	if (selector === "html" || selector === "body" || selector === ":root") return [SCOPE];
	if (selector === "*") return [SCOPE, `${SCOPE} *`];
	return [`${SCOPE} ${selector}`];
}

function serialize(nodes, indent = "") {
	return nodes
		.map((node) =>
			node.decl !== undefined
				? `${indent}${node.decl};`
				: `${indent}${node.prelude} {\n${serialize(node.children, `${indent}\t`)}\n${indent}}`
		)
		.join("\n");
}

/** Prefix every style rule with the scope; keep @utility and @custom-variant definitions as they are. */
function scopeRules(nodes) {
	const out = [];
	for (const node of nodes) {
		if (node.decl !== undefined) continue;
		if (node.prelude.startsWith("@utility")) out.push(node);
		else if (node.prelude.startsWith("@layer") || node.prelude.startsWith("@media") || node.prelude.startsWith("@supports"))
			out.push({ prelude: node.prelude, children: scopeRules(node.children) });
		else if (!node.prelude.startsWith("@")) {
			const selectors = [...new Set(splitSelectors(node.prelude).flatMap(scopeSelector))];
			out.push({ prelude: selectors.join(", "), children: node.children });
		}
	}
	return out;
}

/**
 * @param {{ theme: string, kit: string, appCss: string, tailwindTheme: string, header: string }} input
 * @returns {string}
 */
export function previewCss({ theme, kit, appCss, tailwindTheme, header }) {
	const themeNodes = parseCss(theme);
	const find = (pred) => themeNodes.filter((node) => node.prelude !== undefined && pred(node.prelude));
	const bare = declMap(find((p) => p === "@theme").flatMap((n) => n.children));
	const inline = declMap(find((p) => p === "@theme inline").flatMap((n) => n.children));
	const light = declMap(find((p) => p === ":root").flatMap((n) => n.children));
	const dark = declMap(find((p) => p.startsWith(":is(.dark")).flatMap((n) => n.children));
	if (!bare["--radius"] || !Object.keys(light).length || !Object.keys(dark).length) throw new Error("theme.css: expected @theme --radius, :root and the dark block");

	const chatTheme = new Set(
		parseCss(appCss)
			.filter((node) => node.prelude?.startsWith("@theme"))
			.flatMap((node) => Object.keys(declMap(node.children)))
	);
	const fontSans = declMap(parseCss(tailwindTheme).find((node) => node.prelude?.includes("@theme"))?.children ?? [])["--font-sans"];
	if (!fontSans) throw new Error("tailwindcss/theme.css: no --font-sans default");

	const resolve = (value, palette) => value.replace(/^var\((--[a-z0-9-]+)\)$/, (_, name) => palette[name] ?? (() => { throw new Error(`theme.css: ${name} has no value`); })());
	const colours = Object.entries(inline).filter(([name]) => name.startsWith("--color-"));
	const radii = Object.entries(inline).filter(([name]) => name.startsWith("--radius"));
	const missing = colours.filter(([name]) => !chatTheme.has(name)).map(([name]) => name);
	const scoped = (palette) =>
		colours.flatMap(([name, value]) => {
			const literal = resolve(value, palette);
			return missing.includes(name) ? [`--ui8kit-${name.slice(2)}: ${literal}`, `${name}: ${literal}`] : [`${name}: ${literal}`];
		});

	const lines = [
		header,
		missing.length
			? `/* Kit colours the chat theme has no utility for: they resolve to the kit value inside ${SCOPE} only. */\n@theme inline {\n${missing.map((name) => `\t${name}: var(--ui8kit-${name.slice(2)});`).join("\n")}\n}`
			: "",
		`${SCOPE} {\n${[
			`--radius: ${bare["--radius"]}`,
			...radii.map(([name, value]) => `${name}: ${value}`),
			...scoped(light),
			`--font-sans: ${fontSans.replace(/\s+/g, " ")}`,
			"font-family: var(--font-sans)",
			"color-scheme: light"
		].map((line) => `\t${line};`).join("\n")}\n}`,
		`${DARK} {\n${[...scoped(dark), "color-scheme: dark"].map((line) => `\t${line};`).join("\n")}\n}`,
		`@layer base {\n\t${SCOPE}, ${SCOPE} * {\n\t\tborder-color: var(--color-border);\n\t\toutline-color: color-mix(in oklab, var(--color-ring) 50%, transparent);\n\t}\n\t${SCOPE} {\n\t\tbackground-color: var(--color-background);\n\t\tcolor: var(--color-foreground);\n\t}\n}`,
		serialize(scopeRules(parseCss(kit)))
	];
	return `${lines.filter(Boolean).join("\n\n")}\n`;
}
