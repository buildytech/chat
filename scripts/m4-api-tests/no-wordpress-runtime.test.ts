/**
 * Guard the browser-first baseline: this repo must not grow a WordPress runtime.
 * Domain Page status `published` and GitHub release type `published` are allowed.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "../..");

const SKIP_DIRS = new Set([
	".git",
	"node_modules",
	"build",
	"dist",
	".svelte-kit",
	".vite",
	"coverage"
]);

const SKIP_REL = new Set([
	".project/adr",
	"design/fig-ref/ARCH.md",
	"scripts/m4-api-tests/no-wordpress-runtime.test.ts"
]);

const RUNTIME_EXTS = new Set([
	".ts",
	".js",
	".mjs",
	".svelte",
	".json",
	".yml",
	".yaml",
	".php",
	".sh"
]);

const FORBIDDEN = [
	/adapters\/wordpress/,
	/@buildytech\/adapter-wordpress/,
	/X-WP-Nonce/,
	/wp-json/,
	/wp_rest/,
	/wpRestNonce/,
	/__BUILDYTECH_SI_CHAT__/,
	/build:wp-embed/,
	/vite\.config\.wp-embed/,
	/wp-embed\.(js|ts|css)/,
	/wp-admin/,
	/buildytech-si-chat/,
	/createWordpressPorts/
];

function skipPath(rel: string): boolean {
	if (SKIP_REL.has(rel)) return true;
	for (const prefix of SKIP_REL) {
		if (rel === prefix || rel.startsWith(`${prefix}/`)) return true;
	}
	return false;
}

function walk(dir: string, acc: string[]): void {
	for (const name of readdirSync(dir)) {
		if (SKIP_DIRS.has(name)) continue;
		const full = join(dir, name);
		const rel = relative(REPO, full);
		if (skipPath(rel)) continue;
		const st = statSync(full);
		if (st.isDirectory()) {
			walk(full, acc);
			continue;
		}
		if (RUNTIME_EXTS.has(extname(name)) || name === "package.json" || name === "package-lock.json") {
			acc.push(full);
		}
	}
}

describe("no WordPress runtime", () => {
	it("does not keep adapters/wordpress", () => {
		assert.equal(existsSync(join(REPO, "adapters/wordpress")), false);
	});

	it("workspaces and chat-web scripts omit WordPress packages", () => {
		const root = JSON.parse(readFileSync(join(REPO, "package.json"), "utf8")) as {
			workspaces?: string[];
		};
		assert.ok(Array.isArray(root.workspaces));
		assert.equal(root.workspaces?.includes("adapters/wordpress"), false);

		const web = JSON.parse(readFileSync(join(REPO, "apps/chat-web/package.json"), "utf8")) as {
			scripts?: Record<string, string>;
		};
		assert.equal(web.scripts?.["build:wp-embed"], undefined);
	});

	it("runtime sources have no WP REST/nonce/embed coupling", () => {
		const files: string[] = [];
		walk(REPO, files);
		const hits: string[] = [];
		for (const file of files) {
			const text = readFileSync(file, "utf8");
			for (const re of FORBIDDEN) {
				if (re.test(text)) {
					hits.push(`${relative(REPO, file)} ~ ${re}`);
				}
			}
		}
		assert.deepEqual(hits, []);
	});
});
