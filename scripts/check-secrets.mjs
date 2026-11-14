/**
 * Secret scan of the full git history and of the staged changes (gitleaks, pinned release, sha256 checked).
 *   node scripts/check-secrets.mjs           history + staged
 *   GITLEAKS_BIN=/path node scripts/check-secrets.mjs   use an installed binary
 * The binary is downloaded once into .cache/gitleaks (git-ignored). Findings are printed redacted (rule, file, line, commit);
 * the secret value never reaches the output. Allowed false positives live in .gitleaks.toml with the reason.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VERSION = "8.30.1";
const SHA256 = "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb"; // gitleaks_8.30.1_linux_x64.tar.gz
const dir = join(root, ".cache", "gitleaks");
const bin = process.env.GITLEAKS_BIN || join(dir, `gitleaks-${VERSION}`);

async function ensureBinary() {
	if (existsSync(bin)) return;
	if (process.platform !== "linux" || process.arch !== "x64") throw new Error(`no pinned gitleaks build for ${process.platform}/${process.arch}: install gitleaks ${VERSION} and set GITLEAKS_BIN`);
	mkdirSync(dir, { recursive: true });
	const url = `https://github.com/gitleaks/gitleaks/releases/download/v${VERSION}/gitleaks_${VERSION}_linux_x64.tar.gz`;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`gitleaks download failed: HTTP ${res.status}`);
	const data = Buffer.from(await res.arrayBuffer());
	const sum = createHash("sha256").update(data).digest("hex");
	if (sum !== SHA256) throw new Error(`gitleaks archive checksum mismatch (${sum})`);
	const tgz = join(dir, "gitleaks.tar.gz");
	writeFileSync(tgz, data);
	const untar = spawnSync("tar", ["xzf", tgz, "-C", dir, "gitleaks"], { stdio: "inherit" });
	if (untar.status !== 0) throw new Error("could not unpack gitleaks");
	spawnSync("mv", [join(dir, "gitleaks"), bin]);
	chmodSync(bin, 0o755);
}

function scan(label, args) {
	const run = spawnSync(bin, [...args, "--config", ".gitleaks.toml", "--redact=100", "--no-banner", "--exit-code", "1", "."], { cwd: root, encoding: "utf8" });
	const text = `${run.stdout}${run.stderr}`;
	const found = /leaks found: (\d+)/.exec(text)?.[1] ?? "0";
	if (run.status === 0) {
		console.log(`secrets: ${label}: no leaks`);
		return true;
	}
	console.log(`secrets: ${label}: ${found} finding(s)`);
	// Redacted report only: rule, file, line, commit.
	const report = join(dir, "report.json");
	spawnSync(bin, [...args, "--config", ".gitleaks.toml", "--redact=100", "--no-banner", "--report-format", "json", "--report-path", report, "."], { cwd: root });
	if (existsSync(report)) for (const f of JSON.parse(readFileSync(report, "utf8"))) console.log(`  ${f.RuleID} ${f.File}:${f.StartLine} ${String(f.Commit ?? "staged").slice(0, 8)}`);
	return false;
}

await ensureBinary();
const history = scan("history", ["git"]);
const staged = scan("staged changes", ["git", "--staged"]);
if (!(history && staged)) {
	console.log("secrets: review each finding; rotate a real credential, or allow a reviewed false positive in .gitleaks.toml");
	process.exit(1);
}
