# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
