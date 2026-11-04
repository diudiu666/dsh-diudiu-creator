param(
  [string]$Title = 'DSH 维护提醒',
  [string]$Text = ''
)
try {
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
  $icon = New-Object System.Windows.Forms.NotifyIcon
  $icon.Icon = [System.Drawing.SystemIcons]::Information
  $icon.BalloonTipTitle = $Title
  $icon.BalloonTipText = $Text
  $icon.Visible = $true
  $icon.ShowBalloonTip(15000)
  Start-Sleep -Seconds 8
  $icon.Dispose()
} catch {
  Write-Output ('notify failed: ' + $_.Exception.Message)
}
