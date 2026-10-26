/**
 * Packaging guard: the published tarball must contain the patch and the README,
 * and must not contain the test suite or CI config.
 *
 * Run: node scripts/check-pack.mjs
 */
import { execFileSync } from "node:child_process";

const REQUIRED = ["package.json", "cordis.patch.yml", "README.md"];
const FORBIDDEN_PREFIXES = ["test/", ".github/", "scripts/"];

const npmArgs = ["pack", "--dry-run", "--json"];
// Node refuses to spawn a .cmd directly on Windows (CVE-2024-27980), and
// `shell: true` triggers DEP0190 — so go through cmd.exe.
const raw =
	process.platform === "win32"
		? execFileSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", "npm pack --dry-run --json"], {
				encoding: "utf8",
			})
		: execFileSync("npm", npmArgs, { encoding: "utf8" });

const files = new Set(JSON.parse(raw)[0].files.map((f) => f.path));
const missing = REQUIRED.filter((p) => !files.has(p));
if (missing.length > 0) {
	console.error("check-pack: missing from the tarball:\n  " + missing.join("\n  "));
	process.exit(1);
}
const stray = [...files].filter((p) => FORBIDDEN_PREFIXES.some((prefix) => p.startsWith(prefix)));
if (stray.length > 0) {
	console.error(`check-pack: dev-only files leaked into the tarball: ${stray.join(", ")}`);
	process.exit(1);
}
console.log(`check-pack: ok (${files.size} files)`);
