import type { RegistrySkin } from "@buildytech/builder-core";
import { renderStyleText, type CustomSkinRender } from "../theme/custom-skin.ts";
import { INSTALL_ROOT } from "./svelte-code.ts";
import type { PackFile } from "./pack.ts";
import { IMAGES_DIR, type LocalImages } from "./pack-images.ts";

/**
 * npm packages of the exported project, pinned to the exact versions the chat builds with (a unit test compares them
 * with node_modules). Runtime: svelte plus the registry's npm dependencies; tooling: what vite.config.ts uses.
 */
export const PACK_DEPENDENCIES = { clsx: "2.1.1", lucide: "1.72.0", svelte: "5.57.3", "tailwind-merge": "3.7.0" } as const;
export const PACK_DEV_DEPENDENCIES = {
	"@sveltejs/vite-plugin-svelte": "6.2.4",
	"@tailwindcss/vite": "4.3.4",
	tailwindcss: "4.3.4",
	vite: "7.3.7"
} as const;

/** The file of the exported project that carries the Custom Skin config (Stock's Export format, re-importable). */
export const THEME_FILE = "theme.json";
/** Stock's base rules under a themed render (CUSTOM_SKIN_BASE_CSS), imported after the skin when a Custom Skin is on. */
export const CUSTOM_SKIN_CSS = `${INSTALL_ROOT}/custom-skin.css`;

const attr = (value: string): string => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** The README of the exported project: how to run it, what each folder is, the skin and Custom Skin notes. */
function picturesNote(images: LocalImages | null): string {
	if (!images || (!images.local.length && !images.remote.length)) return "";
	const local = images.local.length ? `- Pictures: \`${IMAGES_DIR}/\` holds the ${images.local.length} picture(s) of the page, downloaded with the export; each section imports its files, so Vite fingerprints them into \`dist/assets/\` and resolves them under any \`base\`. Replace a file in place to change a picture.\n` : "";
	const remote = images.remote.length ? `- ${images.remote.length} picture(s) could not be downloaded and still load from their remote address (\`manifest.json\` \`images.remote\` lists them and why).\n` : "";
	return local + remote;
}

function readmeText(safeTitle: string, skin: RegistrySkin | null, custom: CustomSkinRender | null, images: LocalImages | null): string {
	return `# ${safeTitle}

Svelte 5 + Vite + Tailwind CSS 4 page exported from BuildY.

\`\`\`sh
npm i && npm run dev
\`\`\`

\`npm run build\` writes the static site to \`dist/\`.

- \`${INSTALL_ROOT}/App.svelte\` composes the sections in \`${INSTALL_ROOT}/sections/\`; each section is one UI8Kit registry block with its props.
- Everything else under \`${INSTALL_ROOT}/\` (blocks, components, compose, kit, icons, utils, styles, presets) and
  \`ui8kit.config.json\` / \`ui8kit.lock.json\` are exactly what \`npx ui8kit init\` + \`npx ui8kit add\` write for
  the items in \`GENERATOR.json\` (\`registryItems\`). Check them with \`npx ui8kit check\`; do not edit them.
- Dark theme: \`class="dark"\` or \`data-theme="dark"\` on \`<html>\`.
${skin ? `- Skin: ${skin.title} (\`npx ui8kit add ${skin.item}\`): \`${skin.file}\` is imported in \`${INSTALL_ROOT}/main.ts\` and \`<html data-skin="${skin.id}">\` turns it on. Remove both lines for the default theme.\n` : ""}${custom ? `- Custom Skin: \`${THEME_FILE}\` is the theme as the Stock theme editor exports it (format magazine-theme, version 2; import it again in BuildY Settings or in Stock). \`index.html\` carries what it sets on \`<html>\`: ${skin ? "the base skin above, " : ""}the density attributes, the inline variables (radius, fonts, per-element tokens, type scale) and the Google Fonts links. \`${CUSTOM_SKIN_CSS}\` carries the palette for both modes: light by default, dark under \`class="dark"\` or \`data-theme="dark"\` on \`<html>\` (the page follows the system's setting).\n` : ""}${picturesNote(images)}`;
}

export function scaffold(slug: string, title: string, skin: RegistrySkin | null, custom: CustomSkinRender | null = null, images: LocalImages | null = null): PackFile[] {
	// A skin is on with its CSS after the styles entry and data-skin on <html> (what `npx ui8kit add theme-<skin>` prints).
	// A Custom Skin adds what Stock puts on its root: density attributes, the inline variables, fonts; both modes live in custom-skin.css.
	const htmlAttrs = custom
		? [...Object.entries(custom.attrs).map(([name, value]) => ` ${name}="${attr(value)}"`), ` style="${attr(renderStyleText(custom))}"`].join("")
		: skin
			? ` data-skin="${skin.id}"`
			: "";
	// Dark theme follows the system; a Custom Skin carries both modes (custom-skin.css) and can pin light with data-theme="light".
	const script = `		<script>
			// Dark theme follows the system; set class="dark" (or data-theme="dark") on <html> to force it${custom ? ', data-theme="light" to pin light' : ""}.
			if (matchMedia("(prefers-color-scheme: dark)").matches${custom ? ' && document.documentElement.dataset.theme !== "light"' : ""}) document.documentElement.classList.add("dark");
		</script>
`;
	const fontLinks = custom ? `		<!-- Custom Skin (theme.json, magazine-theme v2): fonts it names. Its light and dark palettes are both in ${CUSTOM_SKIN_CSS}. -->\n${custom.fonts.map((href) => `		<link rel="stylesheet" href="${attr(href)}" />`).join("\n")}\n` : "";
	const modeScript = fontLinks + script;
	const skinImport =
		(skin ? `// Skin ${skin.title} (registry item ${skin.item}): brand tokens only, on with data-skin on <html>.\nimport "./${skin.file.slice(`${INSTALL_ROOT}/`.length)}";\n` : "") +
		(custom ? `// Custom Skin (theme.json): Stock's base rules and the palette of both modes (light, and dark under .dark); the other tokens are inline on <html> in index.html.\nimport "./${CUSTOM_SKIN_CSS.slice(`${INSTALL_ROOT}/`.length)}";\n` : "");
	const safeTitle = title.replace(/[<>&"]/g, "");
	const pkg = {
		name: `${slug.replace(/[^a-z0-9-]/gi, "-").toLowerCase() || "page"}`,
		private: true,
		version: "0.0.0",
		type: "module",
		scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
		dependencies: PACK_DEPENDENCIES,
		devDependencies: PACK_DEV_DEPENDENCIES
	};
	return [
		{
			path: "index.html",
			content: `<!doctype html>
<html lang="en"${htmlAttrs}>
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>${safeTitle}</title>
${modeScript}	</head>
	<body>
		<div id="app"></div>
		<script type="module" src="/${INSTALL_ROOT}/main.ts"></script>
	</body>
</html>
`
		},
		{
			path: `${INSTALL_ROOT}/main.ts`,
			content: `import { mount } from "svelte";
// The registry's global CSS (ui8kit.config.json globalCss): theme tokens, kit CSS, Tailwind @source of src/.
import "./styles/index.css";
${skinImport}import App from "./App.svelte";

mount(App, { target: document.getElementById("app")! });
`
		},
		{
			path: "vite.config.ts",
			content: `import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";

// Aliases of ui8kit.config.json; the registry files import each other by relative paths.
export default defineConfig({
	plugins: [tailwindcss(), svelte()],
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./${INSTALL_ROOT}", import.meta.url))
		}
	}
});
`
		},
		{ path: "package.json", content: `${JSON.stringify(pkg, null, 2)}\n` },
		{ path: "README.md", content: readmeText(safeTitle, skin, custom, images) }
	];
}
