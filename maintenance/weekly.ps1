param(
  [string]$Root = (Join-Path $env:USERPROFILE '.dsh\creator-maintenance'),
  [string]$Repo = 'C:\workspaces\dsh-diudiu-creator'
)
$ErrorActionPreference = 'Continue'
$logDir = Join-Path $Root 'log'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$stamp = Get-Date -Format 'yyyy-MM-dd'
$log = Join-Path $logDir ($stamp + '-weekly.log')
function Write-Log([string]$m) {
  $line = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + ' ' + $m
  Add-Content -Path $log -Value $line -Encoding UTF8
  Write-Output $m
}

Write-Log '=== weekly start ==='

# 1) 归档本周会话（纯本地，不提交）
try {
  $archiveOut = & (Join-Path $Root 'archive-sessions.ps1')
  Write-Log (($archiveOut | Out-String).Trim())
} catch {
  Write-Log ('archive failed: ' + $_.Exception.Message)
}

$weekDir = Join-Path $Root ('weeks\' + $stamp)
$digest = Join-Path $weekDir 'index.md'

# 2) 上游漂移检查（确定性强，先跑）
$driftText = ''
try {
  $driftText = (& node (Join-Path $Root 'check-drift.mjs') 2>&1 | Out-String).Trim()
  Write-Log ('drift: ' + $driftText)
} catch {
  $driftText = 'drift check failed: ' + $_.Exception.Message
  Write-Log $driftText
}

# 3) 自动优化/发布：仅当配置了 DEEPSEEK_API_KEY（无头模式不能用账号登录）
$apiKey = $env:DEEPSEEK_API_KEY
if ([string]::IsNullOrWhiteSpace($apiKey)) {
  $keyFile = Join-Path $Root 'deepseek-api-key.txt'
  if (Test-Path -LiteralPath $keyFile) {
    $apiKey = (Get-Content -LiteralPath $keyFile -Raw -Encoding UTF8).Trim()
  }
}
if ([string]::IsNullOrWhiteSpace($apiKey)) {
  Write-Log 'DEEPSEEK_API_KEY 未配置（环境变量与 deepseek-api-key.txt 都没有），跳过自动优化/发布，改为提醒。'
  & (Join-Path $Root 'notify.ps1') -Title 'DSH 创造模式 · 周维护' -Text ('本周会话已归档并完成上游漂移检查。自动优化/发布需要配置 DEEPSEEK_API_KEY；详细归档见 ' + $weekDir)
  exit 0
}
$env:DEEPSEEK_API_KEY = $apiKey
$env:DSH_PERMISSION_MODE = 'danger-full-access'

$promptPath = Join-Path $Root 'maintenance-prompt.md'
$prompt = Get-Content -LiteralPath $promptPath -Raw -Encoding UTF8
$prompt = $prompt.Replace('{{DATE}}', $stamp).Replace('{{REPO}}', $Repo).Replace('{{DIGEST}}', $digest).Replace('{{DRIFT}}', $driftText)
$dsh = Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd'
$sessionFile = Join-Path $Root 'weekly-session.txt'
Set-Location -LiteralPath $Repo

# 固定复用同一个月维护会话：headless 每次都会新建会话，CLI 会话不会登记进工作区，
# 在 GUI 侧栏里就是「未分组」。首次运行后把 session id 落盘，之后都用 --session-id 续用。
function Get-MaintenanceSessions {
  $root = Join-Path $env:USERPROFILE '.dsh\sessions'
  if (-not (Test-Path -LiteralPath $root)) { return @() }
  @(Get-ChildItem -LiteralPath $root -Recurse -Directory -Filter 'session-*' -ErrorAction SilentlyContinue)
}

function Invoke-HeadlessMaintenance([string]$SessionId, [string]$PromptText) {
  $cliArgs = @('--profile', 'headless')
  if (-not [string]::IsNullOrWhiteSpace($SessionId)) { $cliArgs += @('--session-id', $SessionId) }
  $cliArgs += '-'
  $out = $PromptText | & $dsh @cliArgs 2>&1 | Out-String
  return [pscustomobject]@{ Output = $out; Code = $LASTEXITCODE }
}

$sid = ''
if (Test-Path -LiteralPath $sessionFile) {
  $sid = (Get-Content -LiteralPath $sessionFile -Raw -Encoding UTF8).Trim()
}
$before = @(Get-MaintenanceSessions | ForEach-Object { $_.FullName })

Write-Log ('running headless maintenance... (session=' + $(if ($sid) { $sid } else { 'new' }) + ')')
$run = Invoke-HeadlessMaintenance $sid $prompt
if ($run.Code -ne 0 -and -not [string]::IsNullOrWhiteSpace($sid)) {
  Write-Log ('复用会话 ' + $sid + ' 失败（exit=' + $run.Code + '），改为新建会话重试一次')
  $run = Invoke-HeadlessMaintenance '' $prompt
}
$headlessOut = $run.Output
$code = $run.Code
Write-Log ('headless exit=' + $code)

# 复用成功时不会有新会话；失败回退/首次运行时把新会话记下来。
# 取创建时间最早的那个：主会话在进程启动时就建好，子代理会话只会更晚。
$created = @(Get-MaintenanceSessions | Where-Object { $before -notcontains $_.FullName })
if ($created.Count -gt 0) {
  $newest = $created | Sort-Object CreationTime | Select-Object -First 1
  if ($code -eq 0) {
    Set-Content -LiteralPath $sessionFile -Value $newest.Name -Encoding UTF8
    Write-Log ('已记录复用会话 id: ' + $newest.Name)
  } else {
    Write-Log ('本次新建会话 ' + $newest.Name + ' 但 exit=' + $code + '，不记录，下次仍新建')
  }
}
$outFile = Join-Path $logDir ($stamp + '-headless.out.txt')
$headlessOut | Set-Content -Path $outFile -Encoding UTF8
if ($code -eq 0) {
  & (Join-Path $Root 'notify.ps1') -Title 'DSH 创造模式 · 周维护完成' -Text ('自动维护已执行，结果见 ' + $outFile)
} else {
  & (Join-Path $Root 'notify.ps1') -Title 'DSH 创造模式 · 周维护失败' -Text ('headless 退出码 ' + $code + '，日志见 ' + $outFile)
}
