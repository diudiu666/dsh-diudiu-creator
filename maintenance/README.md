# 创造模式 · 每周自动维护模板

这个目录是「周维护自动化」的**模板源码**，装机时整份复制到
`%USERPROFILE%\.dsh\creator-maintenance\` 使用。DSH 只从那个目录读脚本，
所以这里改完要重新复制一次才会生效。

> 归档、日志、API key、npm token 等运行时数据**只留在本机**，不进仓库、不进 npm 包。

## 安装

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.dsh\creator-maintenance" | Out-Null
Copy-Item -Recurse -Force .\maintenance\* "$env:USERPROFILE\.dsh\creator-maintenance\"
Copy-Item .\maintenance\npm-token.example.json "$env:USERPROFILE\.dsh\creator-maintenance\npm-token.json"
```

然后按需配置、注册计划任务：

```powershell
# 1) 无头模式要 API key（二选一）：环境变量，或写进 deepseek-api-key.txt
#    setx DEEPSEEK_API_KEY "sk-..."
# 2) 注册/刷新计划任务（周六 09:00 周维护、每天 10:00 token 提醒）
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\.dsh\creator-maintenance\register-tasks.ps1"
```

## 流程

`weekly.ps1`（每周六 09:00）：

1. `archive-sessions.ps1` 把最近 7 天改过的 `~/.dsh/sessions/**/session.v4.jsonl.zstd`
   复制到 `weeks/<日期>/sessions/`，生成 `index.md`（只复制、不删除）；
2. `check-drift.mjs` 对比 DSH 上游 `preset-cordis` 与本仓库 `cordis.patch.yml`；
3. 有 `DEEPSEEK_API_KEY` 时，把 `maintenance-prompt.md` 交给无头 agent（有变更才
   升版本、commit，再在本机跑 `node scripts/release.mjs` 发布：测试 → push → npm publish →
   打 tag）；没 key 时只归档 + 漂移检查 + 弹窗提醒。

## 会话复用（0.2.1 起）

无头模式每次运行都会**新建会话**，而 CLI 会话不会登记到任何工作区，在 DSH 侧栏里
显示为「未分组」。`weekly.ps1` 现在第一次运行后把会话 id 写进 `weekly-session.txt`，
之后用 `dsh --profile headless --session-id <id> -` 续用同一个会话：

- 会话被删掉时（CLI 报 `session "..." does not exist`）自动回退为新建并重新记录；
- 只在 `exit=0` 时记录，失败的会话不写盘；
- 一次运行若产生多个新会话（子代理），取 `CreationTime` 最早的主会话；
- 想强制换一个新会话：删掉 `weekly-session.txt`（会多出 1 个未分组会话，属预期）。

## 文件

| 文件 | 作用 |
|---|---|
| `weekly.ps1` | 周维护入口：归档 → 漂移检查 → 无头维护/发布 |
| `archive-sessions.ps1` | 复制最近 7 天会话到 `weeks/<日期>/` 并生成索引 |
| `check-drift.mjs` | 上游 `preset-cordis` 漂移检查（忽略两处有意偏离） |
| `maintenance-prompt.md` | 交给无头 agent 的维护指令模板 |
| `register-tasks.ps1` | 注册 Windows 计划任务（周维护 + token 提醒） |
| `notify.ps1` | 托盘气泡提醒 |
| `token-reminder.ps1` | 计算 npm token 剩余天数，临期提醒 |
| `token-rotated.ps1` | 记录 token 轮换日期 |
| `npm-token.example.json` | `npm-token.json` 的字段样例（不含真实数据） |

## 安全

- `deepseek-api-key.txt`、`npm-token.json`、`log/`、`weeks/` 都是本机私有数据，**不要提交**；
- 发布用的是**本机 npm 登录态**（`npm whoami --registry https://registry.npmjs.org` 有输出即可），
  不再用 GitHub Actions secret；本机的 `npm-token.json` 只用于记录凭据轮换日期和临期提醒。
