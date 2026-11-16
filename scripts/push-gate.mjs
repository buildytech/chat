/** Owner delivery gate. No stash, commit, force, or history rewrite. */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
function run(command, args, capture = false, shell = false, cwd = root) {
	const result = spawnSync(command, args, { cwd, encoding: "utf8", stdio: capture ? "pipe" : "inherit", shell });
	if (result.error || result.status !== 0) throw new Error(`${command} failed (${result.status ?? result.error?.code})`);
	return capture ? result.stdout.trim() : "";
}
const git = (...args) => run("git", args, true);
function clean() {
	if (git("status", "--porcelain", "--untracked-files=all")) throw new Error("Working tree must be clean, including untracked files. Save work explicitly; the gate never stashes it.");
}
function npm(script) {
	const cli = process.env.npm_execpath;
	if (cli) run(process.execPath, [cli, "run", script]);
	else run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", script], false, process.platform === "win32");
}

try {
	const args = process.argv.slice(2);
	if (args.some((arg) => arg !== "--check-only") || args.length > 1) throw new Error("Usage: push-gate.sh [--check-only]");
	if (Number(process.versions.node.split(".")[0]) !== 22) throw new Error("Use the project's Node 22 runtime.");
	if (git("branch", "--show-current") !== "main") throw new Error("Delivery requires branch main.");
	clean();
	const head = git("rev-parse", "HEAD");
	run("git", ["fetch", "origin", "main"]);
	run("git", ["merge-base", "--is-ancestor", "origin/main", head]);
	npm("bundle:runtime");
	clean(); // A stale generated bundle requires a new reviewed commit.
	for (const entry of ["api/runtime/v1/run.ts", "api/runtime/v1/status.ts"]) run(process.execPath, ["--experimental-strip-types", "--check", entry]);
	npm("schema:check");
	// ESLint resolves the web tsconfig before the workspace's later svelte-check step.
	run(process.execPath, [resolve(root, "node_modules/@sveltejs/kit/svelte-kit.js"), "sync"], false, false, resolve(root, "apps/chat-web"));
	npm("verify"); // Tests, coverage, secrets, audit, check, build, no-trace and headless.
	clean();
	if (git("rev-parse", "HEAD") !== head || git("branch", "--show-current") !== "main") throw new Error("HEAD or branch changed during verification.");
	if (args.includes("--check-only")) console.log(`push gate: verified ${head}; no push requested`);
	else run("git", ["push", "origin", "HEAD:main"]);
} catch (error) {
	console.error(`push gate: ${error instanceof Error ? error.message : "failed"}`);
	process.exitCode = 1;
}
