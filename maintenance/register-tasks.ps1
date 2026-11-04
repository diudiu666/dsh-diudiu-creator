$root = Join-Path $env:USERPROFILE '.dsh\creator-maintenance'
$ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'

function Register-DshTask($name, $script, $desc, $trigger) {
  $action = New-ScheduledTaskAction -Execute $ps -Argument ('-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + (Join-Path $root $script) + '"')
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
  Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Description $desc -Force | Out-Null
  Write-Output ('registered: ' + $name)
}

$weeklyTrigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Saturday -At ([datetime]::Today.AddHours(9))
Register-DshTask 'DSH-Creator-Weekly' 'weekly.ps1' '每周六 09:00 归档本周会话、检查上游漂移并（配置 API key 时）自动维护发布创造模式' $weeklyTrigger

$tokenTrigger = New-ScheduledTaskTrigger -Daily -At ([datetime]::Today.AddHours(10))
Register-DshTask 'DSH-Creator-Token-Reminder' 'token-reminder.ps1' '每天 10:00 检查 npm token 剩余天数，临近到期弹窗提醒' $tokenTrigger

Get-ScheduledTask -TaskName 'DSH-Creator-*' | Select-Object TaskName, State | Format-Table -AutoSize
