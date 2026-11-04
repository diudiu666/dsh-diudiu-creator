param(
  [string]$Root = (Join-Path $env:USERPROFILE '.dsh\creator-maintenance')
)
$ErrorActionPreference = 'Continue'
$cfgPath = Join-Path $Root 'npm-token.json'
$logDir = Join-Path $Root 'log'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir 'token-reminder.log'
$cfg = Get-Content -LiteralPath $cfgPath -Raw -Encoding UTF8 | ConvertFrom-Json
$rotated = [datetime]::ParseExact([string]$cfg.rotatedAt, 'yyyy-MM-dd', $null)
$expiry = $rotated.AddDays([int]$cfg.lifetimeDays)
$daysLeft = [int][math]::Floor(($expiry.Date - (Get-Date).Date).TotalDays)
Add-Content -Path $log -Value ((Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + ' daysLeft=' + $daysLeft + ' expiry=' + $expiry.ToString('yyyy-MM-dd')) -Encoding UTF8
if ($daysLeft -le [int]$cfg.remindDaysBefore) {
  $msg = 'npm 发布凭据还有 ' + $daysLeft + ' 天到期（' + $expiry.ToString('yyyy-MM-dd') + '）。发布已改用本机 npm 登录：确认 `npm whoami --registry https://registry.npmjs.org` 仍有输出（没输出就 npm login），然后在维护目录运行 token-rotated.ps1 记录新日期。'
  & (Join-Path $Root 'notify.ps1') -Title 'DSH 创造模式 · npm token 即将到期' -Text $msg
  Add-Content -Path $log -Value ('REMIND ' + $msg) -Encoding UTF8
}
