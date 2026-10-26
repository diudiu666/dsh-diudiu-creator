# dsh-diudiu-creator

给 **DSH** 增加一个 agent 预设 **「创造模式」**：它内置 `cordis` 预设的完整副本，**只改一处**——把 `skill-filesystem` 里指向 `app.asar` 内部路径的 `customSkillDirs` 去掉，让技能根回落到默认值（项目技能根 `100/200`、用户根 `<DSH_HOME>/skills` `400`）。

## 它解决什么问题

内置 `cordis` 预设的 `skill-filesystem` 行是这样解析技能根的：

```
createRequire(baseUrl).resolve('@deepseek-ai/dsh-agent-preset/package.json') + 'skills'
```

`baseUrl` 指向 `app.asar` 内部，所以这个路径**永远不存在**：技能发现是空的，任何技能一调用就报 `unknown or no longer available`。本预设删掉这个键，改用 `dsh-skill-filesystem` 的默认根，于是 `~/.dsh/skills`、项目技能根里的技能都能被正确发现。

除这一处外，预设与内置 `cordis` 完全一致：persona、agent-instructions、fs/fs-search/jobs/web/cordis/skill/todo/ask-user 工具、`planning`/`compaction`/`delegation` 三个 group（含 plan mode、上下文压缩、subagent 与 workflow），以及 `present`、`tool-plugin-manager`。

## 安装

装到**桌面** profile（预设要在桌面端的会话里选）：

```bash
# 从 npm 安装
dsh plugin --profile desktop add dsh-diudiu-creator

# 或直接从 GitHub 安装
dsh plugin --profile desktop add https://github.com/diudiu666/dsh-diudiu-creator
```

`dsh` 是 DSH Desktop 自带的 CLI：

```powershell
& "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add dsh-diudiu-creator
```

安装后**完全退出 DSH Desktop 再打开**（bundle 层在启动时装载）。装好后「创造模式」会出现在会话的预设/模式选择里；新会话默认用哪个由 `agent-preset-registry` 的 `default` / `selectedDefault` 决定。

## ⚠️ 与手写内联预设的冲突

如果你 profile 的 `cordis.patch.yml` 里已经有一条**手写的同 id 预设**（`id: cordis-skills`，注释通常是 "added by agent"），装这个包之前**先删掉那一段**，否则注册表里会有两条同 id 预设：

```yaml
# 删掉这段（连同上面的注释），只保留 bundle 提供的那一份
- insert:
    - id: preset-cordis-skills
      name: '@deepseek-ai/dsh-agent-preset'
      config:
        id: cordis-skills
```

行 id 保持 `preset-cordis-skills`、预设 id 保持 `cordis-skills`，所以任何把 `selectedDefault` 指向 `cordis-skills` 的配置**不需要改**。

## 兼容性

- `engines.dsh >= 0.2.0-rc.1`：预设引用的插件（`dsh-tool-cordis`、`dsh-workflow-ptc`、`dsh-plugin-manager/tools` 等）都在 0.2.x 里。低于这个版本的 DSH 会拒绝安装（`incompatible-version`）。
- 预设里的平台条件行用 `!!js` 表达式保留，**不写死平台**：`tool-bash` 在 Windows 上禁用、`tool-pwsh` 在非 Windows 上禁用；`tool-plugin-manager` 在没有 `profileContext` 时禁用。
- 只要上游 DSH 的内置 `cordis` 预设新增了行，本预设**不会自动跟随**——它是 2026-10-15 的 `cordis` 快照。上游变化较大时建议升级本包（见 CHANGELOG）。

## 卸载

```bash
dsh plugin --profile desktop remove dsh-diudiu-creator
```

然后重启 DSH。已经用「创造模式」跑过的会话不受影响（它们的预设树已固化），只是新会话里不再出现这个选项。

## 开发

```bash
npm install        # 只有测试用依赖 js-yaml
npm test           # 解析 patch、校验行结构与预设身份
npm run pack:check # 校验 npm pack 产物只含 patch + README
```

真实装载验证（不需要桌面端，用隔离的 DSH_HOME）：

```powershell
# 在临时 profile 里装本包，然后把组合后的配置树打印出来
$dsh --dump-config --profile <临时 profile>
# 输出里应当出现 id: preset-cordis-skills 与其下的 tool-cordis / skill-filesystem 等行
```

## 许可

[BSD-3-Clause](LICENSE)。
