// Compare the DSH-shipped cordis preset with this repo's snapshot (cordis.patch.yml).
// Drift means the upstream preset gained/removed/changed rows since our snapshot was taken.
// Exit codes: 0 = no structural drift, 2 = drift found, 1 = error.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const repo = process.env.CREATOR_REPO || "C:\\workspaces\\dsh-diudiu-creator";
const requireFromRepo = createRequire(join(repo, "package.json"));
const yaml = requireFromRepo("js-yaml");

const JsType = new yaml.Type("tag:yaml.org,2002:js", {
	kind: "scalar",
	construct: (v) => ({ $js: v }),
});
const schema = yaml.DEFAULT_SCHEMA.extend([JsType]);

const dsh = join(
	process.env.LOCALAPPDATA,
	"Programs",
	"DeepSeek Harness",
	"resources",
	"runtime",
	"cli",
	"bin",
	"dsh.cmd",
);
const dump = execFileSync(
	"powershell.exe",
	["-NoProfile", "-NonInteractive", "-Command", `& "${dsh}" --profile web --dump-default-config`],
	{ encoding: "utf8", maxBuffer: 128 * 1024 * 1024 },
).replace(/^\uFEFF/, "");

const shippedEntries = yaml.load(dump, { schema });
const ourEntries = yaml.load(readFileSync(join(repo, "cordis.patch.yml"), "utf8"), { schema });
const shipped = (Array.isArray(shippedEntries) ? shippedEntries : []).find((e) => e && e.id === "preset-cordis");
const ours = (Array.isArray(ourEntries) ? ourEntries : []).find((e) => e && e.id === "preset-cordis");
if (!shipped || !ours) {
	console.error("could not find preset-cordis in the shipped dump or in cordis.patch.yml");
	process.exit(1);
}

const shippedRows = shipped.config.plugins || [];
const ourRows = ours.config.plugins || [];
const shippedById = new Map(shippedRows.map((r) => [r.id, r]));
const ourById = new Map(ourRows.map((r) => [r.id, r]));

const INTENTIONAL_DEVIATIONS = {
	// The preset deliberately drops the app.asar-scoped skill root (the whole point of the package).
	"skill-filesystem": new Set(["config"]),
	// The preset deliberately tightens the shipped thresholds (see README/CHANGELOG).
	"tool-result-pruner": new Set(["config"]),
	// The preset deliberately pins backgroundMode for both subagent rows.
	"tool-subagent": new Set(["backgroundMode"]),
	"tool-subagent-fork": new Set(["backgroundMode"]),
};

const findings = [];
function diff(a, b, path, rowId) {
	if (a && typeof a === "object" && !Array.isArray(a) && typeof a.id === "string" && b && a.id === b.id) {
		rowId = a.id;
	}
	if (a === b) return;
	const ignored = INTENTIONAL_DEVIATIONS[rowId] || new Set();
	if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
		findings.push(`${path}: shipped=${JSON.stringify(a)} ours=${JSON.stringify(b)}`);
		return;
	}
	if (Array.isArray(a) !== Array.isArray(b)) {
		findings.push(`${path}: type mismatch`);
		return;
	}
	const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
	for (const key of keys) {
		if (ignored.has(key)) continue;
		const next = `${path}.${key}`;
		if (!(key in a)) {
			findings.push(`${next}: only in ours (${JSON.stringify(b[key])})`);
			continue;
		}
		if (!(key in b)) {
			findings.push(`${next}: only in shipped (${JSON.stringify(a[key])})`);
			continue;
		}
		diff(a[key], b[key], next, rowId);
	}
}

for (const id of shippedById.keys()) {
	if (!ourById.has(id)) findings.push(`row "${id}": missing in ours (shipped has it)`);
}
for (const id of ourById.keys()) {
	if (!shippedById.has(id)) findings.push(`row "${id}": extra in ours (shipped dropped it)`);
}
for (const [id, shippedRow] of shippedById) {
	const ourRow = ourById.get(id);
	if (!ourRow) continue;
	diff(shippedRow, ourRow, `row "${id}"`, id);
}

if (findings.length === 0) {
	console.log(`no drift: ${shippedRows.length} rows match (intentional deviations ignored)`);
	process.exit(0);
}
console.log(`drift: ${findings.length} difference(s) between shipped cordis preset and our snapshot`);
for (const f of findings) console.log("  - " + f);
process.exit(2);
