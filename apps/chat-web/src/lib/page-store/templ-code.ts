/**
 * Page -> the files a Go templ export writes on top of the pinned starter (ADR 0069; registry/templ, written by
 * scripts/templ-snapshot.mjs): internal/page/page.json (the page's blocks with the props `renderBlock` gives them, the
 * pictures as /static/images/ files), internal/page/sections_gen.go (byte for byte what `go generate ./internal/page`
 * writes from the lock), the narrowed ui/kit lock, the skin as `:root` rules (the site's CSP forbids inline styles) and
 * the chosen preset in the Makefile. The starter's Layout draws the header (section navigation) and the footer, so the
 * page's header and footer blocks are skipped.
 */
import { renderBlock, type RegistrySkin } from "@buildytech/builder-core";
import type { PageV2 } from "@buildytech/page-contract";
import { CUSTOM_SKIN_BASE_CSS, type CustomSkinRender } from "../theme/custom-skin.ts";
import { propsWithUrls, type LocalImages } from "./pack-images.ts";
import { srcsetKeysOf } from "./svelte-code.ts";

export const TEMPL_PRESETS = ["blog", "corporate", "shop"] as const;
export type TemplPreset = (typeof TEMPL_PRESETS)[number];

export const PAGE_JSON = "internal/page/page.json";
export const SECTIONS_GEN = "internal/page/sections_gen.go";
export const KIT_LOCK = "ui/kit/ui8kit.lock.json";
export const THEME_CSS = "ui/styles/theme.css";
export const APP_CSS = "internal/web/static/app.css";
export const MAKEFILE = "Makefile";
export const STATIC_IMAGES = "internal/web/static/images";
/** page.json format (internal/page/page.go reads only this one). */
const TEMPL_PAGE_FORMAT = "buildy.templ-page.v1";
/** Blocks the starter's Layout draws itself (its header carries the section navigation). */
const LAYOUT_ITEMS = new Set(["header-simple", "footer-simple"]);

/** registry/templ/snapshot.json. */
export type TemplSnapshot = {
	starter: { repo: string; commit: string };
	cli: string;
	registry: string;
	tailwind: string;
	go: string;
	/** catalog blocks added into ui/kit/blocks */
	blocks: string[];
	/** registry blocks of the starter itself (kept in every export) */
	starterBlocks: string[];
	/** files with the executable bit (scripts/*.sh) */
	executables: string[];
	/** path under registry/templ/starter -> sha256 */
	files: Record<string, string>;
};

type SkippedBlock = { id: string; item: string; reason: string };
type TemplBlock = { id: string; item: string; variant: string; props: Record<string, unknown> };

const fileName = (path: string): string => path.slice(path.lastIndexOf("/") + 1);
/** Where a downloaded picture goes in the project, and the URL the site serves it at (internal/web/static, embedded). */
export const templImagePath = (path: string): string => `${STATIC_IMAGES}/${fileName(path)}`;
const templImageUrl = (path: string): string => `/static/images/${fileName(path)}`;

/** page.json of the export and the blocks it leaves to the starter. */
export function templPageDoc(page: PageV2, preset: TemplPreset, images: LocalImages | null): { text: string; items: string[]; skipped: SkippedBlock[] } {
	const blocks: TemplBlock[] = [];
	const skipped: SkippedBlock[] = [];
	for (const block of page.blocks) {
		if (LAYOUT_ITEMS.has(block.item)) {
			skipped.push({ id: block.id, item: block.item, reason: "the starter's Layout draws the header (section navigation) and the footer" });
			continue;
		}
		const render = renderBlock(block);
		if (!render) throw new Error(`page block ${block.id}: ${block.item} is not a registry item`);
		blocks.push({ id: block.id, item: render.item, variant: render.variant, props: propsWithUrls(render.props, images, templImageUrl, srcsetKeysOf(render.item)) });
	}
	const doc = { format: TEMPL_PAGE_FORMAT, id: page.id, slug: page.slug, title: page.title, locale: page.locale, preset, seo: page.seo ?? {}, blocks };
	return { text: `${JSON.stringify(doc, null, 2)}\n`, items: [...new Set(blocks.map((block) => block.item))].sort(), skipped };
}

type Lock = { items: Record<string, { name: string; type: string; files: Record<string, string> }> } & Record<string, unknown>;

/** The kit lock without the catalog blocks the page does not use (same format as the CLI writes). */
export function narrowLock(lockText: string, drop: ReadonlySet<string>): string {
	const lock: Lock = JSON.parse(lockText);
	const items = Object.fromEntries(Object.entries(lock.items).filter(([, item]) => !(item.type === "registry:block" && drop.has(item.name))));
	return `${JSON.stringify({ ...lock, items }, null, 2)}\n`;
}

const SIGNATURE = /^templ ([A-Z][A-Za-z0-9]*)\(p ([A-Z][A-Za-z0-9]*Props)\)/m;
const goQuote = (s: string): string => JSON.stringify(s);
const compareBytes = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** internal/page/sections_gen.go exactly as internal/page/gen writes it (gofmt-ed) for this lock and these block sources. */
export function sectionsGo(lockText: string, blockSource: (item: string) => string | undefined): string {
	const lock: Lock = JSON.parse(lockText);
	const names = Object.values(lock.items)
		.filter((item) => item.type === "registry:block" && `blocks/${item.name}.templ` in item.files)
		.map((item) => item.name)
		.sort(compareBytes);
	const cases = names.map((name) => {
		const match = SIGNATURE.exec(blockSource(name) ?? "");
		if (!match || `${match[1]}Props` !== match[2]) throw new Error(`blocks/${name}.templ: no \`templ X(p XProps)\` component`);
		return `\tcase ${goQuote(name)}:\n\t\tvar p blocks.${match[2]}\n\t\tif err := json.Unmarshal(props, &p); err != nil {\n\t\t\treturn nil, err\n\t\t}\n\t\treturn blocks.${match[1]}(p), nil\n`;
	});
	const blocksImport = names.length ? '\n\t"github.com/ui8kit/codegen/generated/templ/blocks"' : "";
	return (
		"// Code generated by internal/page/gen (go generate ./internal/page) from ui/kit/ui8kit.lock.json. DO NOT EDIT.\n\n" +
		`package page\n\nimport (\n\t"encoding/json"\n\t"fmt"\n\n\t"github.com/a-h/templ"${blocksImport}\n)\n\n` +
		"// component is the templ block of a registry item with its props (page.json).\n" +
		"func component(item string, props json.RawMessage) (templ.Component, error) {\n\tswitch item {\n" +
		cases.join("") +
		'\t}\n\treturn nil, fmt.Errorf("%q is not a registry block of ui/kit (ui8kit add it, then go generate)", item)\n}\n'
	);
}

/** A registry skin's CSS for the page root: its `[data-skin="<id>"]` scope becomes `:root` (no attribute on <html> needed). */
/** A registry skin's rules for the whole site: its comments dropped, `[data-skin]` (also under a dark ancestor) is :root. */
export const rootSkinCss = (css: string): string =>
	css
		.replace(/\/\*[\s\S]*?\*\/\n?/g, "")
		.replace(/:is\(([^()]*)\) \[data-skin="[^"]+"\]/g, ":root:is($1)")
		.replace(/:root\[data-skin="[^"]+"\]/g, ":root")
		.replace(/\[data-skin="[^"]+"\]/g, ":root");

/**
 * The skin of the export as plain CSS for ui/styles/theme.css (and appended to the built app.css): the registry skin
 * scoped to :root, then a Custom Skin's variables as one :root rule and Stock's base rules. "" when the page has none.
 */
export function templSkinCss(skin: RegistrySkin | null, skinCss: string | null, custom: CustomSkinRender | null): string {
	const parts: string[] = [];
	if (skin && skinCss) parts.push(`/* Skin ${skin.title} (registry item ${skin.item}), scoped to :root. */\n${rootSkinCss(skinCss).trimEnd()}\n`);
	if (custom) {
		const decls = custom.style.map(([prop, value]) => `  ${prop.trim()}: ${value.trim()};`).join("\n");
		parts.push(`/* Custom Skin (theme.json, magazine-theme v2, ${custom.mode} mode): its root variables. */\n:root {\n${decls}\n}\n${CUSTOM_SKIN_BASE_CSS}`);
	}
	return parts.length ? `\n/* ---- BuildY Chat skin (export): as :root rules, the site's CSP forbids inline styles. ---- */\n${parts.join("\n")}` : "";
}

/** The Makefile with `PRESET ?= <preset>` (make run). */
export function makefileWithPreset(text: string, preset: TemplPreset): string {
	if (!/^PRESET \?= [a-z]+$/m.test(text)) throw new Error("starter Makefile has no `PRESET ?= <preset>` line");
	return text.replace(/^PRESET \?= [a-z]+$/m, `PRESET ?= ${preset}`);
}
