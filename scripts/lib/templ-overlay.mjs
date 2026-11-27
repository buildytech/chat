/**
 * The chat's changes on top of the pinned fastygo/starter (scripts/templ-snapshot.mjs): new files from catalog/templ/overlay
 * and exact text patches of starter files. A patch whose anchor is missing fails the snapshot (the starter moved: update
 * the pin and the anchor together). Nothing here touches ui/kit: registry files come only from the CLI.
 */
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const OVERLAY_DIR = "catalog/templ/overlay";

/** [file, find, replace]: each `find` must occur exactly once. */
export const PATCHES = [
	["internal/web/screens/public.templ", '\t"github.com/fastygo/starter/ui/blocks"\n', '\t"github.com/fastygo/starter/internal/page"\n\t"github.com/fastygo/starter/ui/blocks"\n'],
	["internal/web/screens/public.templ", "\t\t@blocks.Hero(h.Hero)\n", "\t\t// The page designed in BuildY Chat (internal/page/page.json) replaces the starter's hero.\n\t\t@page.Blocks()\n"],
	["ui/styles/app.css", '@source "../kit/icons/*.templ";\n', '@source "../kit/icons/*.templ";\n@source "../kit/blocks";\n'],
	["internal/web/static/static.go", "//go:embed app.css app.js favicon.svg fonts\n", "//go:embed app.css app.js favicon.svg fonts all:images\n"],
	["cmd/site/commands.go", '\t"github.com/fastygo/starter/internal/content"\n', '\t"github.com/fastygo/starter/internal/content"\n\t"github.com/fastygo/starter/internal/page"\n'],
	["cmd/site/commands.go", "\t\t\tif p == \"\" {\n\t\t\t\tp = cfg.Preset\n\t\t\t}\n", "\t\t\tif p == \"\" {\n\t\t\t\tp = cfg.Preset\n\t\t\t}\n\t\t\tif p == \"\" && rec == nil {\n\t\t\t\tp = page.Preset() // the preset chosen in the BuildY Chat export\n\t\t\t}\n"],
	[
		"scripts/verify.sh",
		'step "privacy check (PRIVACY.md)"\n',
		'step "go generate ./internal/page is committed"\ngo generate ./internal/page\nif ! git diff --quiet -- internal/page/sections_gen.go; then\n  echo "internal/page/sections_gen.go differs from ui/kit/ui8kit.lock.json; run go generate ./internal/page and commit"; exit 1\nfi\n\nstep "privacy check (PRIVACY.md)"\n'
	],
	[
		"AGENTS.md",
		"internal/web/screens/  page templates (layout, public, shop, cabinet) built from blocks\n",
		"internal/web/screens/  page templates (layout, public, shop, cabinet) built from blocks\ninternal/page/         the home page from BuildY Chat: page.json (registry blocks + props), sections_gen.go (go generate)\n"
	]
];

/** Copies the overlay files into dir and applies the patches. */
export function applyOverlay(root, dir) {
	cpSync(join(root, OVERLAY_DIR), dir, { recursive: true });
	for (const [file, find, replace] of PATCHES) {
		const path = join(dir, file);
		if (!existsSync(path)) throw new Error(`overlay: ${file} is not in the starter`);
		const text = readFileSync(path, "utf8");
		const at = text.indexOf(find);
		if (at < 0 || text.indexOf(find, at + 1) >= 0) throw new Error(`overlay: the anchor of ${file} is missing or not unique: ${JSON.stringify(find.slice(0, 60))}`);
		writeFileSync(path, text.slice(0, at) + replace + text.slice(at + find.length));
	}
}
