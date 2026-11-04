# dsh-diudiu-creator

给 **DSH** 增加一个 agent 预设 **「创造模式」**。它不是另起一个预设，而是**原地修好内置 `cordis` 预设**，所以：

- 预设 id 仍然是 `cordis`，但 `skill-filesystem` 不再指向 `app.asar` 内部路径，技能根回落到默认值（项目技能根 `100/200`、用户根 `<DSH_HOME>/skills` `400`）；
- 因为 id 还是 `cordis`，装了 **dsh-ops** 的机器上，「创造模式」会**自动**接上 dsh-ops 的 cordis 模式与 discovery，不需要再切到 `standard` 预设。

> 0.1.x 曾经用 `cordis-skills` 这个自造 id 装一份 cordis 副本。0.2.0 起改成"接管内置行"：预设只剩一个（id `cordis`），`cordis-skills` 已删除。

## 它解决什么问题

### 1. 技能根（0.1.x 以来的原问题）

内置 `cordis` 预设的 `skill-filesystem` 行是这样解析技能根的：

```
createRequire(baseUrl).resolve('@deepseek-ai/dsh-agent-preset/package.json') + 'skills'
```

`baseUrl` 指向 `app.asar` 内部，`createRequire(...).resolve(...)` 装载时直接抛
`MODULE_NOT_FOUND`，于是技能发现是空的，任何技能一调用就报
`unknown or no longer available`。本预设删掉 `customSkillDirs` 这个键，改用
`dsh-skill-filesystem` 的默认根。（`standard` 预设本来就没有这个键，所以只有
`cordis` 预设中招。）

### 2. 接上 dsh-ops 的按需发现（0.2.0 起）

dsh-ops 的文件工具是按**预设 id** 发布的（`modes/detect.js#modeOf` 只认
`minimal` / `standard` / `ptc` / `cordis`）。自造 id 的预设永远匹配不到任何一个
模式行，所以 0.1.x 的「创造模式」用的一直是官方 `pwsh`/`read`/`grep`，而
`standard` 用的是 `ops_bash`/`ops_read_files`/`ops_grep`。0.2.0 让预设 id 回到
`cordis`，于是：

| dsh-ops 组件 | 对「创造模式」的效果 |
| --- | --- |
| `dsh-ops/mode-cordis` | 发布 `ops_read_files` / `ops_grep` / `ops_bash`，并隐藏被替换的官方 `read` / `glob` / `grep` / Windows `pwsh`（可读性校验不通过时**不隐藏**，自动回退到官方工具） |
| `dsh-ops/discovery` | 提供 `ops_discover_tools`，高级文件/文档能力（DOCX 正文、受限 PDF 文本层、CSV/TSV 等）按需激活，不常驻工具目录 |

不装 dsh-ops 也能用：那时预设就是"修好的 cordis"，只是没有 ops 工具面。

## 安装

装到**桌面** profile（预设要在桌面端的会话里选）：

```bash
# 从 npm 安装（0.2.0 起同时发布 npmjs 与 npmmirror）
dsh plugin --profile desktop add dsh-diudiu-creator

# 或直接从 GitHub 安装
dsh plugin --profile desktop add https://github.com/diudiu666/dsh-diudiu-creator
```

npm 页面：<https://www.npmjs.com/package/dsh-diudiu-creator>

`dsh` 是 DSH Desktop 自带的 CLI：

```powershell
& "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add dsh-diudiu-creator
```

安装后**完全退出 DSH Desktop 再打开**（bundle 层在启动时装载）。

装好后会话模式选择里只有一条：**创造模式**（`cordis`）。

## 0.1.x → 0.2.0 迁移

预设 id 从 `cordis-skills` 变回 `cordis`，所以 profile 里指向旧 id 的默认值要改：

```yaml
# ~/.dsh/profiles/desktop/cordis.patch.yml
- id: agent-preset-registry
  name: '@deepseek-ai/dsh-agent-preset-registry'
  config:
    default: cordis
    selectedDefault: cordis
```

- 不改的话，新建会话会报找不到预设（`agent-preset/not-found`），或落到别的默认预设上。
- **0.1.x 创建的历史会话不能再打开**：`cordis-skills` 这个 id 已删除，registry 的 `resolve()` 会抛
  `agent-preset/not-found`。需要旧会话内容时直接读 `%USERPROFILE%\.dsh\sessions\` 下的会话文件；
  若确实要临时恢复，可在 profile 里手工插一段 `id: cordis-skills` 的预设（内容与本包一致）。

## ⚠️ 与手写内联预设的冲突

如果你 profile 的 `cordis.patch.yml` 里还留着手写的预设（`id: cordis-skills` 或 `id: cordis`，
注释通常是 "added by agent"），**先删掉那一段**，否则注册表里会有两条同 id 预设，
`Duplicate agent preset` 会让整条预设加载失败：

```yaml
# 删掉这段（连同上面的注释），只保留 bundle 提供的那一份
- insert:
    - id: preset-cordis-skills
      name: '@deepseek-ai/dsh-agent-preset'
      config:
        id: cordis-skills
```

## 兼容性

- `engines.dsh: >=0.2.1-rc.1 <0.3.0`：预设里用到的 `dsh-time-context`、`dsh-tool-schedule`、`dsh-plugin-market/tools` 都在 0.2.1 里；低于这个版本的 DSH 会拒绝安装（`incompatible-version`）。
- 预设正文是 **DSH 0.2.1-rc.5 内置 cordis 预设**的快照，仅两处有意偏离：
  - `tool-result-pruner` 阈值收紧到 `4096 / 2048 / 1024`（上游 `8192 / 4096 / 1024`），长会话里大工具输出更早被裁剪；
  - `tool-subagent` / `tool-subagent-fork` 显式保留 `backgroundMode: continuable`（上游省略、靠默认值）。
- 平台条件行用 `!!js` 保留，**不写死平台**：`tool-bash` 在 Windows 上禁用、`tool-pwsh` 在非 Windows 上禁用；`tool-plugin-manager` / `tool-plugin-market` 在没有 `profileContext` 时禁用。
- 上游 cordis 预设如果新增/删改行，本预设**不会自动跟随**——它是快照。升级前请对比 `dsh-web-app/presets/cordis.patch.yml`（在 `app.asar` 内，或 `dsh --dump-default-config` 输出）。
- 提示：DSH 的配置装载器支持 YAML 锚点/别名，但**不支持**合并键 `<<`，不要用 `<<: *x` 复用配置。

## 周维护自动化（可选）

`maintenance/` 是一套 Windows 计划任务模板：每周六归档会话、检查上游 `preset-cordis`
漂移，配置了 `DEEPSEEK_API_KEY` 时再跑一次无头 agent 做最小改动并推送发布。

```powershell
Copy-Item -Recurse -Force .\maintenance\* "$env:USERPROFILE\.dsh\creator-maintenance\"
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\.dsh\creator-maintenance\register-tasks.ps1"
```

模板不会带上任何密钥：API key 放环境变量或 `deepseek-api-key.txt`；发布用**本机 npm 登录态**，
`npm-token.json` 只记凭据轮换日期，两者都只留在本机。详见 [`maintenance/README.md`](maintenance/README.md)。

## 卸载

```bash
dsh plugin --profile desktop remove dsh-diudiu-creator
```

然后重启 DSH。已经用「创造模式」跑过的会话不受影响（它们的预设树已固化），只是新会话里不再出现这个选项，内置 `cordis` 预设恢复成原样（技能根仍然是坏的）。

## 开发

```bash
npm install        # 只有测试用依赖 js-yaml
npm test           # 解析 patch、校验预设身份/行结构/裁剪阈值
npm run pack:check # 校验 npm pack 产物含 patch/README/maintenance，且不含测试与本地状态
npm run release    # 本机发布：校验 → push main → npm publish → 打 tag 并推送
npm run release -- --dry-run   # 只校验，不推送不发布
```

**发布不走 GitHub Actions**：tag 触发的 publish 工作流历史 3 次全部失败在 `npm publish`
鉴权（tag/版本一致性、测试、打包守卫都通过），2026-11-04 起改成本机 `npm run release`，
用当前登录的 npm 账号发到 `https://registry.npmjs.org`。发布前先升 `package.json` 版本、
补 `CHANGELOG.md`，然后：

```bash
npm login --registry https://registry.npmjs.org   # 只需一次
npm run release
```

`release.mjs` 会拦下这些情况：工作区不干净、不在 `main`、版本已存在于 npm、tag 已存在、
本机没登录 npm、Node < 20。

真实装载验证（不需要桌面端，用隔离的 DSH_HOME）：

```powershell
# 把本包的 patch 叠到任意 profile 上，打印组合后的配置树
& "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" `
  --profile web --patch .\cordis.patch.yml --dump-config
```

输出里应当能看到：`id: preset-cordis` 行被改写成 `config.id: cordis` + `name: 创造模式`，`skill-filesystem` 行没有 `customSkillDirs`，以及 `thresholdChars: 4096`；全树不应再出现 `cordis-skills`。

## 许可

[BSD-3-Clause](LICENSE)。
