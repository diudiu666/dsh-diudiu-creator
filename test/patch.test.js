/**
 * Structural checks for the bundle patch. These run without a DSH installation:
 * they verify that the YAML dialect in the patch is parseable, that the preset
 * row keeps its stable ids, and that the shipped package actually names the
 * patch file.
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

const insert = patch?.[0]?.insert;
const row = insert?.[0];
const preset = row?.config;

test("the package declares the patch as its bundle layer", () => {
	assert.equal(pkg.dsh?.bundle?.patch, "./cordis.patch.yml");
	assert.ok(pkg.files?.includes("cordis.patch.yml"), "files must ship the patch");
	assert.equal(pkg.dsh?.engines?.dsh, ">=0.2.0-rc.1");
});

test("the patch is one insert list holding exactly one preset row", () => {
	assert.ok(Array.isArray(patch), "top level is a patch list");
	assert.equal(patch.length, 1);
	assert.ok(Array.isArray(insert), "new rows must arrive through insert:");
	assert.equal(insert.length, 1);
	assert.equal(row.id, "preset-cordis-skills");
	assert.equal(row.name, "@deepseek-ai/dsh-agent-preset");
});

test("the preset keeps its stable identity", () => {
	assert.equal(preset.id, "cordis-skills");
	assert.match(preset.name, /创造模式/);
	assert.equal(typeof preset.order, "number");
	assert.ok(preset.description.length > 10);
});

test("every plugin row has an id and a name, groups hold a list", () => {
	assert.ok(Array.isArray(preset.plugins) && preset.plugins.length > 10);
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
});

test("the tools that make this preset a creator mode are present", () => {
	const ids = preset.plugins.map((p) => p.id);
	for (const id of ["tool-fs", "tool-fs-search", "tool-web", "tool-cordis", "tool-skill", "tool-todo"]) {
		assert.ok(ids.includes(id), `expected row ${id}`);
	}
	const groups = preset.plugins.filter((p) => p.group === true).map((p) => p.id);
	assert.deepEqual(groups.sort(), ["compaction", "delegation", "planning"]);
});

test("platform-conditional rows use the !!js tag instead of being hardcoded", () => {
	const bash = preset.plugins.find((p) => p.id === "tool-bash");
	const pwsh = preset.plugins.find((p) => p.id === "tool-pwsh");
	assert.equal(typeof bash.disabled?.$js, "string");
	assert.equal(typeof pwsh.disabled?.$js, "string");
});
