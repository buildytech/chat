/**
 * The Go templ export (ADR 0069): the pinned fastygo/starter of registry/templ with the page as its home page. Every
 * starter file comes from the snapshot unchanged except the ones templ-code.ts writes (page.json, sections_gen.go, the
 * narrowed kit lock, the skin in theme.css and in the built app.css, the Makefile preset); the catalog blocks the page does
 * not use are left out. manifest.json and GENERATOR.json share the pack format of the Svelte export (buildy.pack.v1).
 */
import { registrySkin } from "@buildytech/builder-core";
import chatPackage from "../../../package.json" with { type: "json" };
import { configText, renderCustomSkin } from "../theme/custom-skin.ts";
import { parsePage, type CreatorPage } from "./page.ts";
import { PACK_FORMAT, sha256Text, type PackEntry, type PackOptions, type RegistryReader } from "./pack.ts";
import { THEME_FILE } from "./pack-scaffold.ts";
import { imageFiles, imagesManifest } from "./pack-images.ts";
import {
	APP_CSS, KIT_LOCK, MAKEFILE, PAGE_JSON, SECTIONS_GEN, STATIC_IMAGES, THEME_CSS, makefileWithPreset, narrowLock, sectionsGo, templImagePath, templPageDoc, templSkinCss,
	type TemplPreset, type TemplSnapshot
} from "./templ-code.ts";

/** Reads starter files by path relative to registry/templ/starter: text, or bytes for binary files (fonts). */
export type StarterReader = (paths: string[]) => Promise<Record<string, string | Uint8Array>>;
type TemplPackOptions = PackOptions & { preset: TemplPreset };

const blockFiles = (item: string): string[] => [`ui/kit/blocks/${item}.templ`, `ui/kit/blocks/${item}_templ.go`];
const text = (value: string | Uint8Array | undefined, path: string): string => {
	if (typeof value !== "string") throw new Error(`templ snapshot has no text file ${path}`);
	return value;
};

/** Paths of the snapshot the export keeps: everything except the catalog blocks the page does not use. */
function keptPaths(snapshot: TemplSnapshot, items: readonly string[]): { paths: string[]; drop: Set<string> } {
	const drop = new Set(snapshot.blocks.filter((item) => !items.includes(item) && !snapshot.starterBlocks.includes(item)));
	const dropped = new Set([...drop].flatMap(blockFiles));
	return { paths: Object.keys(snapshot.files).filter((path) => !dropped.has(path)), drop };
}

/** The manifest's picture report with the project paths of the templ export. */
function templImagesManifest(images: TemplPackOptions["images"]): Record<string, unknown> | null {
	const report = imagesManifest(images ?? null, templImagePath, STATIC_IMAGES);
	if (!report) return null;
	return { ...report, remoteNote: "remote pictures show the block's placeholder: the site serves pictures from itself only (CSP img-src 'self')" };
}

/** The whole Go templ project of the page. */
export async function packTemplZipFiles(page: CreatorPage, snapshot: TemplSnapshot, readStarter: StarterReader, readRegistry: RegistryReader, options: TemplPackOptions): Promise<PackEntry[]> {
	const valid = parsePage(page);
	const custom = options.theme ? renderCustomSkin(options.theme) : null;
	const skin = registrySkin(custom ? custom.skin : options.skin);
	const images = options.images ?? null;
	const pageDoc = templPageDoc(valid, options.preset, images);
	const { paths, drop } = keptPaths(snapshot, pageDoc.items);
	const starter = await readStarter(paths);
	for (const path of paths) if (starter[path] === undefined) throw new Error(`templ snapshot has no ${path}`);
	const skinCss = skin ? ((await readRegistry([skin.file]))[skin.file] ?? null) : null;
	const css = templSkinCss(skin, skinCss, custom);
	const lock = narrowLock(text(starter[KIT_LOCK], KIT_LOCK), drop);
	const own: Record<string, string> = {
		[KIT_LOCK]: lock,
		[MAKEFILE]: makefileWithPreset(text(starter[MAKEFILE], MAKEFILE), options.preset),
		[THEME_CSS]: text(starter[THEME_CSS], THEME_CSS) + css,
		[APP_CSS]: text(starter[APP_CSS], APP_CSS) + css,
		[PAGE_JSON]: pageDoc.text,
		[SECTIONS_GEN]: sectionsGo(lock, (item) => { const source = starter[`ui/kit/blocks/${item}.templ`]; return typeof source === "string" ? source : undefined; })
	};
	const entries: PackEntry[] = paths.map((path) => {
		const file = own[path] ?? starter[path]!;
		if (typeof file !== "string") return { path, bytes: file };
		return snapshot.executables.includes(path) ? { path, content: file, executable: true } : { path, content: file };
	});
	entries.push({ path: PAGE_JSON, content: own[PAGE_JSON]! }, { path: SECTIONS_GEN, content: own[SECTIONS_GEN]! });
	for (const image of images?.local ?? []) for (const file of imageFiles(image)) entries.push({ path: templImagePath(file.path), bytes: file.bytes });
	if (options.theme) entries.push({ path: THEME_FILE, content: `${configText(options.theme)}\n` });
	if (options.contract) entries.push({ path: "brand.contract.json", content: `${JSON.stringify(options.contract, null, 2)}\n` });
	const common = { ...PACK_FORMAT, framework: "templ", preset: options.preset, starter: snapshot.starter };
	const generator = {
		...common,
		name: "@buildytech/chat-web/templ-pack",
		emitter: "templPageDoc",
		packApi: "packTemplZipFiles",
		packageVersion: chatPackage.version,
		pageJsonSha256: sha256Text(pageDoc.text),
		registryItems: pageDoc.items,
		registry: snapshot.registry,
		cli: snapshot.cli,
		contract:
			"fastygo/starter (Go + PocketBase + templ) at the pinned commit with internal/page: page.json holds the page's registry blocks with the props renderBlock gives them, sections_gen.go (go generate ./internal/page) maps each ui/kit registry block to its templ component, HomeScreen renders them inside the starter's Layout"
	};
	entries.push({ path: "GENERATOR.json", content: `${JSON.stringify(generator, null, 2)}\n` });
	const pictures = templImagesManifest(images);
	const manifest = {
		...common,
		id: valid.id,
		slug: valid.slug,
		title: valid.title,
		status: valid.status,
		locale: valid.locale,
		seo: valid.seo,
		skin: skin?.id ?? null,
		...(options.theme && custom ? { customSkin: { file: THEME_FILE, format: options.theme.format, version: options.theme.version, defaultMode: custom.mode, modes: ["light", "dark"], fonts: custom.fonts, note: "fonts are not linked: the site loads fonts from itself only; self-host them in ui/styles/fonts.css" } } : {}),
		...(pageDoc.skipped.length ? { skipped: pageDoc.skipped } : {}),
		files: [...entries.map((entry) => entry.path), "manifest.json"],
		...(pictures ? { images: pictures } : {}),
		generator: { name: generator.name, emitter: generator.emitter, pageJsonSha256: generator.pageJsonSha256 }
	};
	entries.push({ path: "manifest.json", content: `${JSON.stringify(manifest, null, 2)}\n` });
	return entries;
}
