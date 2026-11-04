param(
  [string]$Root = (Join-Path $env:USERPROFILE '.dsh\creator-maintenance'),
  [int]$Days = 7
)
$ErrorActionPreference = 'Stop'
$sessionsRoot = Join-Path $env:USERPROFILE '.dsh\sessions'
$stamp = Get-Date -Format 'yyyy-MM-dd'
$weekDir = Join-Path $Root ('weeks\' + $stamp)
$destSessions = Join-Path $weekDir 'sessions'
New-Item -ItemType Directory -Force -Path $destSessions | Out-Null
$since = (Get-Date).AddDays(-1 * $Days)
$files = @()
if (Test-Path $sessionsRoot) {
  $files = @(Get-ChildItem -Path $sessionsRoot -Recurse -Filter 'session.v4.jsonl.zstd' -File -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -ge $since })
}
$rows = @()
foreach ($f in $files) {
  $rel = $f.FullName.Substring($sessionsRoot.Length).TrimStart('\')
  $target = Join-Path $destSessions $rel
  $parent = Split-Path $target -Parent
  New-Item -ItemType Directory -Force -Path $parent | Out-Null
  Copy-Item -LiteralPath $f.FullName -Destination $target -Force
  $parts = $rel -split '\\'
  $ws = $parts[0]
  $rows += [pscustomobject]@{
    Workspace = $ws
    Session   = $f.Directory.Name
    LastWrite = $f.LastWriteTime
    SizeKB    = [math]::Round($f.Length / 1KB)
  }
}
$lines = @()
$lines += ('# 周会话归档 ' + $stamp)
$lines += ''
$lines += ('窗口：最近 ' + $Days + ' 天；共 ' + $rows.Count + ' 个会话文件。会话内容只在本机留存，不进入仓库、不上传。')
$lines += ''
$lines += '| 工作区 | 会话 | 最后写入 | 大小(KB) |'
$lines += '|---|---|---|---|'
foreach ($r in ($rows | Sort-Object LastWrite -Descending)) {
  $lines += ('| ' + $r.Workspace + ' | ' + $r.Session + ' | ' + $r.LastWrite.ToString('yyyy-MM-dd HH:mm') + ' | ' + $r.SizeKB + ' |')
}
$lines | Set-Content -Path (Join-Path $weekDir 'index.md') -Encoding UTF8
Write-Output ('archived ' + $rows.Count + ' session files -> ' + $weekDir)
