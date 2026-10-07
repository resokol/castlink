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
  $prompt=Get-SimpleGuiPrompt 'Добавить сертификат? да/нет [да]' $false
  if($prompt.default -cne 'да' -or $prompt.choices.Count -ne 2){throw 'Explicit yes certificate default lost'}
  $fake=@{};foreach($name in @('AnswerBox','PasswordBox','ChoicePanel','FolderButton','BackButton')){$fake[$name]=[pscustomobject]@{Visibility='Visible';IsEnabled=$true}}
  Hide-SimpleGuiInput $fake
  if(@($fake.Values|Where-Object{$_.Visibility -ne 'Collapsed' -or $_.IsEnabled}).Count){throw 'Busy GUI retained editable input'}
  [IO.File]::WriteAllText($entry,@'
$a=Read-Host 'Action'
$b=Read-Host 'Target'
$global:SimpleGuiCanGoBack=$false
Write-Host ('selected '+$a+' '+$b)
$null=Read-Host 'Side-effect consent'
'@)
  $channel=New-SimpleGuiChannel;$worker=Start-SimpleGuiWorker $entry @{} $channel
  $first=$channel.messages.Take();if($first.canBack){throw 'First question permits Back'}
  $channel.responses.Add([pscustomobject]@{value='install'})
  $second=$channel.messages.Take();if(-not $second.canBack){throw 'Reversible second question lacks Back'}
  $channel.responses.Add([pscustomobject]@{back=$true})
  $first=$channel.messages.Take();if($first.text -cne 'Action'){throw 'Back failed to reopen previous question'}
  $channel.responses.Add([pscustomobject]@{value='remove'})
  $second=$channel.messages.Take();$channel.responses.Add([pscustomobject]@{value='local'})
  $selected=$channel.messages.Take();$consent=$channel.messages.Take()
  if($selected.text -cne 'selected remove local' -or $consent.canBack){throw 'Back replay crossed irreversible boundary or retained stale answer'}
  $channel.responses.Add([pscustomobject]@{value='no'})
  $done=$channel.messages.Take();Close-SimpleGuiWorker $worker
  if($done.exitCode -ne 0){throw 'Back flow did not finish'}
  [IO.File]::WriteAllText($entry,"`$null=Read-Host 'Selection';`$global:SimpleGuiCanGoBack=`$false;Write-Host 'SIDE_EFFECT_ONCE';`$null=Read-Host 'After mutation'")
  $channel=New-SimpleGuiChannel;$worker=Start-SimpleGuiWorker $entry @{} $channel
  $null=$channel.messages.Take();$channel.responses.Add([pscustomobject]@{value='yes'})
  $effect=$channel.messages.Take();$after=$channel.messages.Take()
  if($after.canBack){throw 'Mutating phase exposed Back'}
  $channel.responses.Add([pscustomobject]@{back=$true})
  $messages=@();do{$message=$channel.messages.Take();$messages+=$message}while($message.kind -ne 'done');Close-SimpleGuiWorker $worker
  if($effect.text -cne 'SIDE_EFFECT_ONCE' -or $message.exitCode -eq 0 -or $messages.text -contains 'SIDE_EFFECT_ONCE'){throw 'Back replayed a completed side effect'}
  $backend=Join-Path (Split-Path $GuiPath -Parent) 'windows-simple-easy-setup.ps1'
  $quoted=$backend.Replace("'","''")
  [IO.File]::WriteAllText($entry,(". '"+$quoted+"' -FunctionsOnly;Request-SimpleForeground;Write-Host 'FOREGROUND_ACK'"))
  $channel=New-SimpleGuiChannel;$worker=Start-SimpleGuiWorker $entry @{} $channel
  $event=$channel.messages.Take()
  if($event.kind -cne 'foreground' -or $event.ack.WaitOne(0)){throw 'Certificate operation did not wait for GUI activation'}
  $null=$event.ack.Set();$acknowledged=$channel.messages.Take();$done=$channel.messages.Take();Close-SimpleGuiWorker $worker
  if($acknowledged.text -cne 'FOREGROUND_ACK' -or $done.exitCode -ne 0){throw 'Foreground activation acknowledgment lost'}
  $trust=Join-Path $folder 'Trust-Certificate.ps1';[IO.File]::WriteAllText($trust,'param($Action) exit 7')
  [IO.File]::WriteAllText($entry,('. '+"'"+$quoted+"' -FunctionsOnly;if(-not(Install-SimpleLocalTrust '"+$folder.Replace("'","''")+"')){Write-Host 'Сервер готов, но доверие HTTPS не установлено. Подтверди сертификат.'}"))
  $channel=New-SimpleGuiChannel;$worker=Start-SimpleGuiWorker $entry @{} $channel
  $event=$channel.messages.Take();if($event.kind -cne 'foreground'){throw 'Trust bypassed foreground acknowledgment'};$null=$event.ack.Set()
  $warning=$channel.messages.Take();$done=$channel.messages.Take();Close-SimpleGuiWorker $worker
  if($done.exitCode -ne 0 -or $done.cancelled -or -not(Get-SimpleGuiTrustWarning @($warning.text))){throw 'Optional trust refusal became install cancellation/error or final warning was lost'}
  Write-Output 'SIMPLE_GUI_BRIDGE_PASS nested SecureString failure cancellation finally cleanup-boundary prompt-default'
}finally{Remove-Item -LiteralPath $folder -Recurse -Force}
