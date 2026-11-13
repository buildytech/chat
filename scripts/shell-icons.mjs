/**
 * Writes the shell icon registry: only the Tabler glyphs the chat shell uses.
 * Filled when Tabler has that drawing, otherwise the outline glyph of the same name.
 * Run: node scripts/shell-icons.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "apps/chat-web/src/lib/shell-icons");
const version = "3.51.0";
const base = `https://cdn.jsdelivr.net/npm/@tabler/icons-svelte@${version}/dist/icons`;

/** Local component name -> Tabler icon id (filled preferred). */
const icons = {
	ArrowUp: "arrow-big-up-filled",
	ArrowDown: "arrow-big-down-filled",
	ArrowLeft: "arrow-big-left-filled",
	ArrowRight: "arrow-big-right-filled",
	Send: "send-filled",
	X: "x-filled",
	Check: "check-filled",
	ChevronDown: "caret-down-filled",
	ChevronUp: "caret-up-filled",
	ChevronLeft: "caret-left-filled",
	ChevronRight: "caret-right-filled",
	SquareRoundedLetterB: "square-rounded-letter-b-filled",
	Circle: "circle-filled",
	Search: "search-filled",
	Settings: "settings-filled",
	Trash2: "trash-filled",
	MessageSquarePlus: "message-filled",
	ExternalLink: "external-link-filled",
	Monitor: "device-desktop-filled",
	RefreshCw: "refresh",
	Smartphone: "device-mobile-filled",
	Tablet: "device-tablet-filled",
	Columns2: "columns-2-filled",
	Rows3: "layout-list-filled",
	Blocks: "apps-filled",
	ListTree: "list-filled",
	MessageSquare: "message-filled",
	GripVertical: "grip-vertical",
	Redo2: "arrow-forward-up",
	Undo2: "arrow-back-up",
	FileCode: "file-code-filled",
	Files: "files-filled",
	PanelLeft: "layout-sidebar-filled",
	Copy: "copy-filled",
	Maximize2: "zoom-in-filled",
	Minimize2: "zoom-out-filled",
	PanelRight: "layout-sidebar-right-filled",
	FolderArchive: "archive-filled",
	PanelLeftOpen: "layout-sidebar-left-expand-filled",
	PanelLeftClose: "layout-sidebar-left-collapse-filled",
	RotateCcw: "rotate",
	SlidersHorizontal: "adjustments-horizontal-filled",
	FileText: "file-text-filled",
	Pencil: "pencil-filled",
	Share2: "share",
	ThumbsDown: "thumb-down-filled",
	ThumbsUp: "thumb-up-filled",
	FilePlus: "copy-plus-filled",
	Plus: "plus-filled",
	Layers: "stack-2-filled",
	Paperclip: "paperclip",
	Download: "download-filled",
	Upload: "file-upload-filled",
	FileUp: "file-upload-filled",
	ImageOff: "photo-off",
	Menu: "menu-2-filled",
	Moon: "moon-filled",
	Sun: "sun-filled",
	Lock: "lock-filled"
};

const list = JSON.parse(
	(await (await fetch(`https://cdn.jsdelivr.net/npm/@tabler/icons-svelte@${version}/dist/icons-list.js`)).text())
		.replace(/^export default /, "")
		.replace(/;\s*$/, "")
);
const known = new Set(list);
const missing = Object.entries(icons).filter(([, id]) => !known.has(id));
if (missing.length) {
	console.error(missing.map(([name, id]) => `${name} ${id}`).join("\n"));
	process.exit(1);
}

function esc(value) {
	return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function svg(id, iconNode) {
	const filled = id.endsWith("-filled");
	const open = filled
		? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">`
		: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`;
	const body = iconNode
		.map(([tag, attrs]) => {
			const rendered = Object.entries(attrs)
				.map(([key, value]) => `${key}="${esc(value)}"`)
				.join(" ");
			return `  <${tag} ${rendered} />`;
		})
		.join("\n");
	return `${open}\n${body}\n</svg>\n`;
}

await mkdir(outDir, { recursive: true });
const written = new Map();
for (const [name, id] of Object.entries(icons)) {
	if (!written.has(id)) {
		const source = await (await fetch(`${base}/${id}.svelte`)).text();
		const match = source.match(/const iconNode = (\[[\s\S]*?\]);/);
		if (!match) throw new Error(`no iconNode in ${id}`);
		const iconNode = JSON.parse(match[1]);
		const file = `${id}.svelte`;
		await writeFile(join(outDir, file), svg(id, iconNode));
		written.set(id, file);
	}
}

const exports = Object.entries(icons)
	.map(([name, id]) => `export { default as ${name} } from "./${written.get(id)}";`)
	.join("\n");
await writeFile(
	join(outDir, "index.ts"),
	`/**\n * BuildY shell icons. Tabler Icons ${version}, MIT.\n * Only the glyphs this shell uses. Page blocks stay on Lucide.\n * A name without "-filled" is the outline glyph: Tabler has no filled drawing for it.\n */\n${exports}\n`
);
console.log(`wrote ${written.size} glyphs, ${Object.keys(icons).length} exports`);
