/**
 * Structural checks for the bundle patch. These run without a DSH installation:
 * they verify that the YAML dialect in the patch is parseable, that the preset
 * keeps the ids the registry and dsh-ops key off, and that the shipped package
 * actually names the patch file.
 *
 * The `!!js` tag is DSH's "evaluate this expression at load time" scalar. For
 * parsing purposes it is kept as a tagged placeholder; the real evaluation is
 * exercised by `dsh --dump-config` when the bundle is installed.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

// js-yaml resolves the `!!js` shorthand to this canonical tag; registering the
// shorthand string itself does not work (js-yaml matches tags literally).
const JsExpression = new yaml.Type("tag:yaml.org,2002:js", {
	kind: "scalar",
	construct: (value) => ({ $js: value }),
});
const schema = yaml.DEFAULT_SCHEMA.extend([JsExpression]);

const patch = yaml.load(readFileSync(join(root, "cordis.patch.yml"), "utf8"), { schema });

const override = patch.find((entry) => entry.id === "preset-cordis");
const preset = override?.config;

test("the package declares the patch as its bundle layer", () => {
	assert.equal(pkg.dsh?.bundle?.patch, "./cordis.patch.yml");
	assert.ok(pkg.files?.includes("cordis.patch.yml"), "files must ship the patch");
	assert.equal(pkg.version, "0.2.5");
	assert.equal(pkg.dsh?.engines?.dsh, ">=0.2.1-rc.1 <0.3.0");
});

test("the patch rewrites the shipped cordis row in place", () => {
	assert.ok(Array.isArray(patch), "top level is a patch list");
	assert.equal(patch.length, 1);
	assert.ok(override, "an id-targeted entry must target preset-cordis");
	assert.equal(override.insert, undefined, "the override carries no insert list");
	assert.ok(!patch.some((entry) => Array.isArray(entry.insert)), "0.2.0 inserts no preset of its own");
	assert.equal(preset.id, "cordis", "the preset id must stay cordis for dsh-ops mode matching");
});

test("the preset keeps its display identity", () => {
	assert.match(preset.name, /创造模式/);
	assert.equal(typeof preset.order, "number");
	assert.ok(preset.description.length > 10);
});

test("every plugin row has an id and a name, groups hold a list", () => {
	assert.ok(Array.isArray(preset.plugins) && preset.plugins.length > 20);
	const ids = preset.plugins.map((p) => p.id);
	assert.equal(new Set(ids).size, ids.length, "plugin ids must be unique inside one preset");
	for (const plugin of preset.plugins) {
		assert.equal(typeof plugin.id, "string", `row ${JSON.stringify(plugin).slice(0, 60)} needs an id`);
		assert.equal(typeof plugin.name, "string", `row ${plugin.id} needs a name`);
		if (plugin.group === true) {
			assert.ok(Array.isArray(plugin.config), `group ${plugin.id} holds its children in config`);
		}
	}
});

test("the skill filesystem row drops the app.asar-scoped customSkillDirs", () => {
	const row = preset.plugins.find((p) => p.id === "skill-filesystem");
	assert.ok(row, "skill-filesystem row is present");
	assert.equal(row.name, "@deepseek-ai/dsh-skill-filesystem");
	assert.equal(row.config, undefined, "no config means the default skill roots are used");
	assert.ok(!JSON.stringify(preset).includes("customSkillDirs"), "the broken root must not come back");
});

test("the preset tracks the shipped cordis rows it has to keep in sync", () => {
	const ids = preset.plugins.map((p) => p.id);
	for (const id of [
		"persona",
		"agent-instructions",
		"time-context",
		"tool-fs",
		"tool-fs-search",
		"tool-schedule",
		"tool-web",
		"tool-cordis",
		"tool-skill",
		"tool-todo",
		"present",
		"tool-plugin-manager",
		"tool-plugin-market",
	]) {
		assert.ok(ids.includes(id), `expected row ${id}`);
	}
	// 0.2.2-rc.1 ships `applyPatch: false` on tool-fs; the copy must stay faithful,
	// otherwise `dsh --dump-config` drift checks flag the row on every run.
	const fsRow = preset.plugins.find((p) => p.id === "tool-fs");
	assert.deepEqual(fsRow?.config, { applyPatch: false }, "tool-fs must mirror the shipped applyPatch:false");

	const groups = preset.plugins.filter((p) => p.group === true).map((p) => p.id);
	assert.deepEqual(groups.sort(), ["compaction", "delegation", "planning"]);
});

test("presets this project no longer ships stay gone", () => {
	const ids = preset.plugins.map((p) => p.id);
	for (const id of ["tool-subagent-codex", "tool-subagent-claude-code", "tool-ralph"]) {
		assert.ok(!ids.includes(id), `row ${id} was removed upstream; do not reintroduce it`);
	}
	// 0.2.2 folds `list_agents` into dsh-tool-subagent-control and drops the
	// `./list-agents` export, so a row naming that subpath fails to import and
	// takes the whole preset down. It lives in the delegation group.
	for (const group of preset.plugins.filter((p) => p.group === true)) {
		const childIds = group.config.map((p) => p.id);
		assert.ok(
			!childIds.includes("tool-subagent-list-agents"),
			"tool-subagent-list-agents targets a removed subpath export; list_agents now ships inside tool-subagent-control",
		);
	}
});

test("the subagent rows use the 0.2.2 config keys", () => {
	// dsh-tool-subagent's schema in 0.2.2-rc.1: provider, toolName,
	// modelSelection, modelDiscovery, agentOptions. `modelSelectionSettings` was
	// renamed and `backgroundMode` no longer exists, so passing either silently
	// loses the subagent model picker.
	const delegation = preset.plugins.find((p) => p.id === "delegation");
	const rows = new Map(delegation.config.map((p) => [p.id, p]));
	for (const id of ["tool-subagent", "tool-subagent-fork"]) {
		const config = rows.get(id)?.config ?? {};
		assert.equal(config.modelSelectionSettings, undefined, `${id}: modelSelectionSettings is the old key`);
		assert.equal(config.backgroundMode, undefined, `${id}: backgroundMode no longer exists in 0.2.2`);
		assert.equal(
			Object.keys(config).some((key) => !["provider", "toolName", "modelSelection", "modelDiscovery", "agentOptions"].includes(key)),
			false,
			`${id}: unexpected config key (schema is strict about meaning, lax about unknown keys)`,
		);
	}
	assert.equal(rows.get("tool-subagent").config.modelSelection, true);
	assert.equal(rows.get("tool-subagent").config.modelDiscovery, true);
});

test("the tool result pruner is tighter than the shipped default", () => {
	const compaction = preset.plugins.find((p) => p.id === "compaction");
	const pruner = compaction.config.find((p) => p.id === "tool-result-pruner");
	assert.equal(pruner.config.thresholdChars, 4096);
	assert.equal(pruner.config.headChars, 2048);
	assert.equal(pruner.config.tailChars, 1024);
});

test("platform-conditional rows use the !!js tag instead of being hardcoded", () => {
	const bash = preset.plugins.find((p) => p.id === "tool-bash");
	const pwsh = preset.plugins.find((p) => p.id === "tool-pwsh");
	assert.equal(typeof bash.disabled?.$js, "string");
	assert.equal(typeof pwsh.disabled?.$js, "string");
	const manager = preset.plugins.find((p) => p.id === "tool-plugin-manager");
	assert.equal(typeof manager.disabled?.$js, "string");
});
