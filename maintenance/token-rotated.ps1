param(
  [string]$Date = (Get-Date -Format 'yyyy-MM-dd'),
  [string]$Root = (Join-Path $env:USERPROFILE '.dsh\creator-maintenance')
)
$cfgPath = Join-Path $Root 'npm-token.json'
$cfg = Get-Content -LiteralPath $cfgPath -Raw -Encoding UTF8 | ConvertFrom-Json
$parsed = [datetime]::ParseExact($Date, 'yyyy-MM-dd', $null)
$cfg.rotatedAt = $parsed.ToString('yyyy-MM-dd')
$cfg | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $cfgPath -Encoding UTF8
Write-Output ('npm-token.json rotatedAt -> ' + $cfg.rotatedAt + '（到期 ' + $parsed.AddDays([int]$cfg.lifetimeDays).ToString('yyyy-MM-dd') + '）')
