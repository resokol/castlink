param([string]$GuiPath)
$ErrorActionPreference='Stop'
. $GuiPath -FunctionsOnly
$folder=Join-Path ([IO.Path]::GetTempPath()) ('castlink-gui-'+[Guid]::NewGuid());$null=New-Item -ItemType Directory $folder
try{
  $nested=Join-Path $folder 'downloaded.ps1'
  [IO.File]::WriteAllText($nested,"`$password=Read-Host 'SSH password' -AsSecureString;if(`$password -isnot [Security.SecureString]){throw 'Password lost secure type'};`$password.Dispose();Write-Host 'downloaded bridge';exit 7")
  $entry=Join-Path $folder 'entry.ps1';[IO.File]::WriteAllText($entry,('& '+"'"+$nested+"'"))
  $channel=New-SimpleGuiChannel;$worker=Start-SimpleGuiWorker $entry @{} $channel
  $question=$channel.messages.Take();if($question.kind -ne 'prompt' -or -not $question.secure){throw 'Secure nested prompt lost GUI bridge'}
  $secret=ConvertTo-SecureString 'fixture-secret-never-log' -AsPlainText -Force;$channel.responses.Add([pscustomobject]@{cancelled=$false;value=$secret})
  $messages=@();do{$message=$channel.messages.Take();$messages+= $message}while($message.kind -ne 'done')
  Close-SimpleGuiWorker $worker
  if($message.exitCode -ne 7 -or ($messages.text -join '') -match 'fixture-secret-never-log' -or $messages.text -notcontains 'downloaded bridge'){throw 'Nested failure shown as success or password leaked'}
  [IO.File]::WriteAllText($entry,"try{Read-Host 'cancel here'}finally{Write-Host 'finally ran'}")
  $channel=New-SimpleGuiChannel;$worker=Start-SimpleGuiWorker $entry @{} $channel;$null=$channel.messages.Take();$channel.responses.Add([pscustomobject]@{cancelled=$true;value=$null})
  $messages=@();do{$message=$channel.messages.Take();$messages+= $message}while($message.kind -ne 'done');Close-SimpleGuiWorker $worker
  if(-not $message.cancelled -or $message.exitCode -eq 0 -or $messages.text -notcontains 'finally ran'){throw 'Prompt cancellation bypassed finally or returned success'}
  [IO.File]::WriteAllText($entry,'$global:SimpleCleanupScheduled=$true')
  $channel=New-SimpleGuiChannel;$worker=Start-SimpleGuiWorker $entry @{} $channel;$message=$channel.messages.Take();Close-SimpleGuiWorker $worker
  if($message.kind -ne 'done' -or -not $message.cleanupPending){throw 'Deferred cleanup was not a terminal GUI boundary'}
  $prompt=Get-SimpleGuiPrompt 'CastLink: 1 — установить / обновить; 2 — удалить' $false
  if($prompt.choices.Count -ne 2 -or $prompt.choices[1].value -ne '2'){throw 'Installer choices lost'}
  $prompt=Get-SimpleGuiPrompt 'Где установить CastLink? 1 — Локально; 2 — Внешний сервер' $false
  if($prompt.choices.Count -ne 2 -or $prompt.choices[0].value -ne '1'){throw 'First actual target choice lost'}
  $prompt=Get-SimpleGuiPrompt 'Выбери номер сервера для обновления; 0 — другая папка / новая установка [0]' $false @('1 — old list','separator','1 — https://local, D:\CastLink','2 — https://other, D:\Other')
  if($prompt.choices.Count -ne 3 -or $prompt.choices[0].label -notlike '*https://local*' -or $prompt.choices[2].label -notlike 'другая папка*'){throw 'Dynamic discovered installation choices lost or stale list used'}
  $prompt=Get-SimpleGuiPrompt 'Папка установки [D:\CastLink]' $false
  if(-not $prompt.folder -or $prompt.default -cne 'D:\CastLink'){throw 'Folder default lost'}
  Write-Output 'SIMPLE_GUI_BRIDGE_PASS nested SecureString failure cancellation finally cleanup-boundary prompt-default'
}finally{Remove-Item -LiteralPath $folder -Recurse -Force}
