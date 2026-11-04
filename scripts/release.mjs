#!/usr/bin/env node
/**
 * 本机发布：用当前登录的 npm 账号把本包发到 npmjs。
 *
 * 本仓库不再走 GitHub Actions 发布（tag 触发的 publish 工作流历史 3 次全部失败于鉴权，
 * 2026-11-04 起改成本机发布），所以这里把「校验 → 推送 → 发布 → 打 tag」串成一条命令：
 *
 *   npm run release            # 真发布
 *   npm run release -- --dry-run   # 只跑校验，不推送、不发布、不打 tag
 *
 * 前置条件：git 工作区干净、在 main 上、package.json 版本号还没发过、tag 还不存在、
 * 本机已 `npm login`（`npm whoami --registry https://registry.npmjs.org` 有输出）。
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const REGISTRY = "https://registry.npmjs.org";
const DRY_RUN = process.argv.includes("--dry-run");
const isWin = process.platform === "win32";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const tagName = `v${pkg.version}`;

function fail(message) {
	console.error(`\nrelease: ${message}`);
	process.exit(1);
}

function step(message) {
	console.log(`\n=== ${message}${DRY_RUN ? " (dry-run)" : ""}`);
}

function execCapture(command, args) {
	return execFileSync(command, args, {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();
}

function execInherit(command, args) {
	execFileSync(command, args, { stdio: "inherit" });
}

// Windows 上不能直接 spawn npm.cmd（CVE-2024-27980），统一走 cmd.exe。
function npm(args, { capture = false } = {}) {
	if (isWin) {
		const line = "npm " + args.join(" ");
		if (capture) return execCapture(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", line]);
		execInherit(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", line]);
		return "";
	}
	if (capture) return execCapture("npm", args);
	execInherit("npm", args);
	return "";
}

function git(args, { capture = true } = {}) {
	if (capture) return execCapture("git", args);
	execInherit("git", args);
	return "";
}

// ---- 0) 环境 ----
const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor < 20) {
	fail(`需要 Node >= 20（当前 ${process.versions.node}）。PATH 上的 node 太旧时用 nvm 里的 22：` +
		`"%APPDATA%\\nvm\\v22.22.3\\node.exe" scripts/release.mjs`);
}

// ---- 1) 仓库状态 ----
step("检查仓库状态");
const dirty = git(["status", "--porcelain"]);
if (dirty) fail("工作区不干净，先提交或 stash：\n" + dirty);
const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
if (branch !== "main") fail(`当前在 ${branch} 分支，发布会用 main`);
let tagExists = true;
try {
	git(["rev-parse", "-q", "--verify", `refs/tags/${tagName}`]);
} catch {
	tagExists = false;
}
if (tagExists) fail(`tag ${tagName} 已存在，先升版本号`);
console.log(`  仓库干净，分支 ${branch}，准备发布 ${pkg.name}@${pkg.version}`);

// ---- 2) 版本是否已发布 ----
step("检查 npm 上是否已有该版本");
let published = "";
try {
	published = npm(["view", `${pkg.name}@${pkg.version}`, "version", "--registry", REGISTRY], {
		capture: true,
	});
} catch {
	published = "";
}
if (published && published.split(/\r?\n/).includes(pkg.version)) {
	fail(`${pkg.name}@${pkg.version} 已经发布过，先升版本号`);
}
console.log("  npm 上还没有这个版本");

// ---- 3) 本机是否已登录 ----
let whoami = "";
try {
	whoami = npm(["whoami", "--registry", REGISTRY], { capture: true });
} catch {
	whoami = "";
}
if (!whoami) fail("本机没有登录 npm：先运行 npm login --registry https://registry.npmjs.org");
console.log(`  npm 账号：${whoami}`);

// ---- 4) 校验 ----
step("结构测试");
execInherit(process.execPath, ["--test", "test/patch.test.js"]);
step("打包守卫");
execInherit(process.execPath, ["scripts/check-pack.mjs"]);

if (DRY_RUN) {
	step("dry-run 结束");
	console.log(`  校验通过；真发布会：git push origin main → npm publish → git tag ${tagName} → git push origin ${tagName}`);
	process.exit(0);
}

// ---- 5) 推送 main ----
step("推送 main");
git(["push", "origin", "main"], { capture: false });

// ---- 6) 发布 ----
step(`npm publish ${pkg.name}@${pkg.version}`);
npm(["publish", "--registry", REGISTRY, "--access", "public"]);

// ---- 7) 打 tag 并推送 ----
step(`打 tag ${tagName}`);
git(["tag", "-a", tagName, "-m", `${tagName}: ${pkg.name}@${pkg.version}`], { capture: false });
git(["push", "origin", tagName], { capture: false });

step("完成");
console.log(`  ${pkg.name}@${pkg.version} 已发布，tag ${tagName} 已推送`);
