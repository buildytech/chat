/**
 * Bundle Vercel Functions without esbuild (lockfile esbuild is a Vite transitive).
 * 53f97e5 crash: ERR_MODULE_NOT_FOUND
 *   /var/task/node_modules/@buildytech/xai-runtime/src/http.ts
 *   imported from /var/task/api/runtime/v1/status.js
 *
 * Vercel Other transpiles the entry file only. This script inlines the workspace
 * graph (builder-core, page-contract, catalog JSON) into that entry.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const entryRel = "apps/xai-runtime/src/vercel-fetch.ts";
const EXTERNAL = new Set(["ai", "@ai-sdk/openai", "zod"]);
/**
 * npm modules the bundle imports statically (hoisted to the top of the entry as ESM default imports; Vercel traces them
 * into the function). The props gate validates synchronously, so its validator cannot be a dynamic import.
 */
const STATIC_EXTERNAL = new Map([["ajv/dist/2020.js", "__ext_ajv2020"]]);

function posix(p) {
	return p.replaceAll("\\", "/");
}

function packageSrc(name, subpath = ".") {
	const pkg = JSON.parse(readFileSync(join(root, "packages", name, "package.json"), "utf8"));
	const exp = pkg.exports?.[subpath] ?? (subpath === "." ? pkg.main : undefined);
	if (!exp) throw new Error(`packages/${name} exports no ${subpath}`);
	const file = typeof exp === "string" ? exp : exp?.default ?? "./src/index.ts";
	return posix(join("packages", name, file.replace(/^\.\//, "")));
}

function resolveSpec(fromRel, spec) {
	if (EXTERNAL.has(spec)) return { external: spec };
	if (spec === "@buildytech/builder-core") return { id: packageSrc("builder-core") };
	if (spec === "@buildytech/page-contract") return { id: packageSrc("page-contract") };
	if (spec === "@buildytech/builder-core/props-gate") return { id: packageSrc("builder-core", "./props-gate") };
	if (STATIC_EXTERNAL.has(spec)) return { staticExternal: STATIC_EXTERNAL.get(spec) };
	if (spec.startsWith("@buildytech/xai-runtime")) {
		throw new Error(`Do not import ${spec} from ${fromRel}; use a relative path`);
	}
	if (spec.startsWith(".")) {
		const base = join(root, dirname(fromRel), spec);
		const rel = posix(relative(root, base));
		if (existsSync(join(root, rel))) return { id: rel };
		throw new Error(`Cannot resolve ${spec} from ${fromRel}`);
	}
	throw new Error(`Unsupported import ${spec} in ${fromRel}`);
}

function skipWsAndComments(src, i) {
	while (i < src.length) {
		if (src[i] === " " || src[i] === "\t" || src[i] === "\n" || src[i] === "\r") {
			i += 1;
			continue;
		}
		if (src[i] === "/" && src[i + 1] === "/") {
			i += 2;
			while (i < src.length && src[i] !== "\n") i += 1;
			continue;
		}
		if (src[i] === "/" && src[i + 1] === "*") {
			i += 2;
			while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i += 1;
			i += 2;
			continue;
		}
		break;
	}
	return i;
}

function readString(src, i) {
	const q = src[i];
	i += 1;
	while (i < src.length) {
		if (src[i] === "\\") {
			i += 2;
			continue;
		}
		if (src[i] === q) return i + 1;
		i += 1;
	}
	return i;
}

function readStatement(src, start) {
	let i = start;
	let depth = 0;
	while (i < src.length) {
		const c = src[i];
		if (c === '"' || c === "'" || c === "`") {
			i = readString(src, i);
			continue;
		}
		if (c === "/" && src[i + 1] === "/") {
			while (i < src.length && src[i] !== "\n") i += 1;
			continue;
		}
		if (c === "/" && src[i + 1] === "*") {
			i += 2;
			while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i += 1;
			i += 2;
			continue;
		}
		if (c === "{" || c === "(" || c === "[") depth += 1;
		else if (c === "}" || c === ")" || c === "]") depth -= 1;
		else if (c === ";" && depth <= 0) return i + 1;
		else if (c === "\n" && depth <= 0 && src.slice(start, i).includes("from ")) {
			const look = skipWsAndComments(src, i + 1);
			if (src.startsWith("with ", look) || src[look] === ";") {
				i += 1;
				continue;
			}
			return i + 1;
		}
		i += 1;
	}
	return src.length;
}

function isTypeOnlyBraceList(inner) {
	const parts = inner.split(",").map((p) => p.trim()).filter(Boolean);
	return parts.length > 0 && parts.every((p) => p.startsWith("type ") || p.startsWith("type\t"));
}

function valueNamesFromBraceList(inner) {
	return inner
		.split(",")
		.map((p) => p.trim())
		.filter(Boolean)
		.filter((p) => !p.startsWith("type ") && !p.startsWith("type\t"))
		.map((p) => {
			const as = p.split(/\s+as\s+/);
			return (as[1] ?? as[0]).trim();
		})
		.filter((n) => n && n !== "type");
}

function parseFromSpec(stmt) {
	const m = stmt.match(/\bfrom\s+["']([^"']+)["']/);
	return m ? m[1] : null;
}

function transformModule(id, source) {
	let i = 0;
	const prelude = [];
	const exportsAssign = [];
	let body = "";
	let defaultExpr = null;

	while (i < source.length) {
		i = skipWsAndComments(source, i);
		if (i >= source.length) break;
		const slice = source.slice(i);
		if (/^import\b/.test(slice) || /^export\b/.test(slice)) {
			const decl = slice.match(
				/^export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/
			);
			if (decl) {
				exportsAssign.push(`exports[${JSON.stringify(decl[1])}] = ${decl[1]};`);
				i += "export".length;
				while (i < source.length && (source[i] === " " || source[i] === "\t")) i += 1;
				continue;
			}
			const end = readStatement(source, i);
			const stmt = source.slice(i, end).trim();
			i = end;
			if (/^import\s+type\b/.test(stmt) || /^export\s+type\b/.test(stmt)) continue;
			const spec = parseFromSpec(stmt);
			if (spec && EXTERNAL.has(spec)) {
				throw new Error(`${id}: static import of ${spec} is not allowed; use dynamic import`);
			}
			if (/^import\s+["']/.test(stmt)) continue;
			if (spec) {
				const resolved = resolveSpec(id, spec);
				if (resolved.external) continue;
				if (resolved.staticExternal) {
					const name = stmt.match(/^import\s+(\w+)\s+from/)?.[1];
					if (!name) throw new Error(`${id}: ${spec} needs a default import`);
					prelude.push(`const ${name} = ${resolved.staticExternal};`);
					continue;
				}
				if (/^export\b/.test(stmt)) {
					const brace = stmt.match(/export\s+\{([^}]*)\}/);
					if (brace) {
						for (const name of valueNamesFromBraceList(brace[1])) {
							prelude.push(`exports[${JSON.stringify(name)}] = __req(${JSON.stringify(resolved.id)})[${JSON.stringify(name)}];`);
						}
					}
					continue;
				}
				if (/^import\s+\w/.test(stmt) && !/import\s*\{/.test(stmt)) {
					const name = stmt.match(/^import\s+(\w+)/)[1];
					prelude.push(`const ${name} = __req(${JSON.stringify(resolved.id)}).default;`);
					continue;
				}
				const brace = stmt.match(/import\s+\{([^}]*)\}/);
				if (brace) {
					const names = valueNamesFromBraceList(brace[1]);
					if (names.length === 0) continue;
					prelude.push(`const { ${names.join(", ")} } = __req(${JSON.stringify(resolved.id)});`);
					continue;
				}
				throw new Error(`Unhandled import in ${id}: ${stmt.slice(0, 120)}`);
			}
			if (/^export\s+default\b/.test(stmt)) {
				const rest = stmt.replace(/^export\s+default\s+/, "").replace(/;?\s*$/, "");
				defaultExpr = rest;
				body += `const __default = ${rest};\n`;
				exportsAssign.push(`exports.default = __default;`);
				continue;
			}
			const named = stmt.match(/^export\s+\{([^}]*)\}\s*;?$/);
			if (named) {
				for (const name of valueNamesFromBraceList(named[1])) {
					exportsAssign.push(`exports[${JSON.stringify(name)}] = ${name};`);
				}
				continue;
			}
			throw new Error(`Unhandled export in ${id}: ${stmt.slice(0, 160)}`);
		}
		const nextImport = source.slice(i).search(/(?:^|\n)(?:import|export)\b/);
		if (nextImport === -1) {
			body += source.slice(i);
			break;
		}
		const abs = i + (source[i + nextImport] === "\n" ? nextImport + 1 : nextImport);
		body += source.slice(i, abs);
		i = abs;
	}

	if (defaultExpr && !exportsAssign.some((l) => l.includes("exports.default"))) {
		exportsAssign.push(`exports.default = __default;`);
	}
	return `${prelude.join("\n")}\n${body}\n${exportsAssign.join("\n")}\n`.replaceAll(
		/\breadonly\s+/g,
		""
	);
}

function collect(startId) {
	const order = [];
	const seen = new Set();
	function walk(id) {
		if (seen.has(id)) return;
		seen.add(id);
		if (id.endsWith(".json")) {
			order.push(id);
			return;
		}
		const src = readFileSync(join(root, id), "utf8");
		let i = 0;
		while (i < src.length) {
			i = skipWsAndComments(src, i);
			if (i >= src.length) break;
			if (/^import\b/.test(src.slice(i)) || /^export\b/.test(src.slice(i))) {
				const end = readStatement(src, i);
				const stmt = src.slice(i, end);
				i = end;
				if (/^import\s+type\b/.test(stmt.trim()) || /^export\s+type\b/.test(stmt.trim())) continue;
				const spec = parseFromSpec(stmt);
				if (!spec || EXTERNAL.has(spec)) continue;
				const resolved = resolveSpec(id, spec);
				if (resolved.id) walk(resolved.id);
				continue;
			}
			const rest = src.slice(i);
			const next = rest.search(/(?:^|\n)(?:import|export)\b/);
			if (next === -1) break;
			i += rest[next] === "\n" ? next + 1 : next;
		}
		order.push(id);
	}
	walk(startId);
	return order;
}

const ids = collect(entryRel);
if (!ids.some((id) => id.endsWith("catalog/snapshot.json"))) {
	throw new Error("bundle graph missing catalog/snapshot.json");
}
if (!ids.some((id) => id.endsWith("apps/xai-runtime/src/http.ts"))) {
	throw new Error("bundle graph missing http.ts");
}

const factories = [];
for (const id of ids) {
	if (id.endsWith(".json")) {
		const json = readFileSync(join(root, id), "utf8");
		JSON.parse(json);
		factories.push(
			`__def(${JSON.stringify(id)}, function (exports) {\n  exports.default = ${json.trim()};\n});`
		);
		continue;
	}
	const transformed = transformModule(id, readFileSync(join(root, id), "utf8"));
	factories.push(`__def(${JSON.stringify(id)}, function (exports) {\n${transformed}\n});`);
}

const header = `// @ts-nocheck
/* Bundled Vercel Function entry. Do not import workspace .ts at runtime. */
${[...STATIC_EXTERNAL].map(([spec, name]) => `import ${name} from ${JSON.stringify(spec)};`).join("\n")}
const __mods = Object.create(null);
function __def(id, factory) {
	__mods[id] = { factory, exports: undefined };
}
function __req(id) {
	const rec = __mods[id];
	if (!rec) throw new Error("missing bundled module " + id);
	if (rec.exports) return rec.exports;
	const exports = {};
	rec.exports = exports;
	rec.factory(exports);
	return exports;
}
`;

const footer = `
const __entry = __req(${JSON.stringify(entryRel)});
export const config = __entry.config;
export default __entry.default;
`;

const outDir = join(root, "api/runtime/v1");
mkdirSync(outDir, { recursive: true });
const bundled = `${header}\n${factories.join("\n\n")}\n${footer}`;
for (const name of ["status.ts", "run.ts"]) {
	writeFileSync(join(outDir, name), bundled);
}
process.stdout.write(`bundled ${ids.length} modules -> api/runtime/v1/status.ts and run.ts\n`);
