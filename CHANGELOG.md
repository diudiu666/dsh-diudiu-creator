# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.3] — 2026-11-04

### Removed

- **从公开仓库和 npm 包里移除本机的维护与发布流程**：`maintenance/`（周维护脚本、
  维护提示词、会话归档、token 提醒）和 `scripts/release.mjs`（本机发布脚本）。
  原因：公开仓库会把这些东西连同维护者本机路径、发布链路一起暴露出去，别人可以直接
  照搬。它们现在只存在于维护者本机 `%USERPROFILE%\.dsh\creator-maintenance\`。
- npm 包的 `files` 回到 `cordis.patch.yml` + `README.md` 两项；`check-pack` 恢复成只校验
  `package.json` / `cordis.patch.yml` / `README.md`，且 `scripts/`、`test/`、`.github/`
  不进 tarball。
- 发布仍由维护者在本地用已登录的 npm 账号执行，不再走 GitHub Actions（也删掉了
  tag 触发的 `publish` 工作流）。

> 说明：`0.2.1` 和 `0.2.2` 的 tarball 里曾经包含上述脚本，内容以本版本为准。

## [0.2.2] — 2026-11-04

### Changed

- **发布改成本机 npm 账号，不再走 GitHub Actions**：删除 tag 触发的
  `.github/workflows/publish.yml`。该工作流历史 3 次运行（v0.2.0 ×2、v0.2.1）全部在
  `npm publish` 这一步失败，而 tag/版本一致性、`npm test`、`npm run pack:check` 都是
  success——是凭据问题，不是构建问题。
- 新增 `npm run release`（`scripts/release.mjs`）：工作区干净 + 在 `main` + 版本没发过 +
  tag 不存在 + `npm whoami` 有登录 → 跑结构测试与打包守卫 → push `main` →
  `npm publish --registry https://registry.npmjs.org --access public` → 打注解 tag 并推送。
  加 `-- --dry-run` 只校验不发布。
- 维护自动化同步：`maintenance/maintenance-prompt.md` 第 4 步改为在本机发布；
  `token-reminder.ps1` 的提醒文案改指本机 npm 凭据，不再提 GitHub Actions secret。

## [0.2.1] — 2026-11-04

### Added

- **`maintenance/` 模板目录**：把本机那套周维护自动化纳入版本管理——`weekly.ps1`
  （归档 → 漂移检查 → 无头维护/发布）、`archive-sessions.ps1`、`check-drift.mjs`、
  `maintenance-prompt.md`、`register-tasks.ps1`、`notify.ps1`、`token-reminder.ps1`、
  `token-rotated.ps1`，以及 `npm-token.example.json` 与安装说明。
  运行时数据（API key、`npm-token.json`、`log/`、`weeks/`）不入库，`check-pack` 现在会
  拒绝把它们打进 tarball。

### Fixed

- **周维护不再无限制造「未分组」会话**：无头模式每次运行都会新建会话，而 CLI 会话不会
  登记进 `workspace.json` 的 `sessionIds`，GUI 侧栏只能显示为「未分组」（2026-11-04 一天
  就堆了 7 个）。`weekly.ps1` 改为首次运行后把 session id 写进 `weekly-session.txt`，
  之后用 `--session-id` 续用同一会话；会话不存在时回退新建并重记，只在 `exit=0` 时记录。

## [0.2.0] — 2026-11-04

### Changed

- **预设 id 从 `cordis-skills` 改回内置 id `cordis`**：不再插入一份自造 id 的副本，
  而是用 id-targeted patch **原地改写**内置 `preset-cordis` 行（`config.id: cordis`、
  `name: 创造模式`）。原因：dsh-ops 的文件工具按预设 id 发布
  （`modes/detect.js#modeOf` 只认 minimal/standard/ptc/cordis），自造 id 永远匹配不
  到模式行，导致「创造模式」拿不到 `ops_read_files` / `ops_grep` / `ops_bash` 与
  `ops_discover_tools` 按需发现，用户只能在两个预设之间来回切。
- 预设正文同步到 **DSH 0.2.1-rc.5** 的内置 cordis 快照：新增 `time-context`
  （模型能看到当前时间）、`tool-schedule`、`tool-plugin-market`；plan-mode 段换成
  上游文案。
- `tool-result-pruner` 阈值收紧到 `4096 / 2048 / 1024`（上游 `8192 / 4096 / 1024`），
  长会话里大工具输出更早被裁剪。
- `engines.dsh` 提升到 `>=0.2.1-rc.1 <0.3.0`（新引用的三个包都在 0.2.1 里）。

### Fixed

- `npm test` 改成显式文件路径 `node --test test/patch.test.js`：Node 22 的 test runner
  不再把目录参数（`node --test test`）递归展开，会报 `Cannot find module ...\test`，
  导致 CI 的 Node 22 任务失败、`publish` 流程在测试步骤中断（0.2.0 的首次 tag 发布即因此失败）。

### Removed

- **`cordis-skills` 预设整体删除**：本包只保留「接管内置行」这一条路，不再提供自造 id
  的副本或兼容别名。0.1.x 创建的会话因此无法再恢复（registry 找不到 id 会抛
  `agent-preset/not-found`）；需要旧会话内容时直接读
  `%USERPROFILE%\.dsh\sessions\` 下的会话文件。
- 上游已删除、本包一直带着的 `disabled: true` 僵尸行：`tool-subagent-codex`、
  `tool-subagent-claude-code`、`tool-ralph`。
- README 里"自造 id + 手写内联预设冲突"的旧说明，改成"接管内置行的冲突说明"。

### Migration

- profile 的 `agent-preset-registry` 需要把 `default` / `selectedDefault` 从
  `cordis-skills` 改成 `cordis`，否则新会话会报找不到预设。

## [0.1.0] — 2026-10-26

### Added

- First release: a bundle patch that inserts the **创造模式** agent preset
  (`id: cordis-skills`), a faithful copy of the shipped `cordis` preset whose
  only difference is that the `skill-filesystem` row no longer sets
  `customSkillDirs`. That key resolved to
  `createRequire(app.asar baseUrl).resolve('@deepseek-ai/dsh-agent-preset/package.json') + 'skills'`,
  a path inside `app.asar` that never exists, so skill discovery came up empty
  and every skill answered "unknown or no longer available". Dropping the key
  restores the default roots (project roots rank 100/200, user root rank 400).
- Structural tests (`node --test`) for the patch, the preset identity, the group
  rows and the `!!js` platform conditions, plus a packaging guard.
