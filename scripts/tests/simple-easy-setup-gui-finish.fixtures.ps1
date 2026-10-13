param([string]$GuiPath)
$ErrorActionPreference='Stop'
. $GuiPath -FunctionsOnly
$folder=Join-Path ([IO.Path]::GetTempPath()) ('castlink panel Тест '+[Guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory (Join-Path $folder '.castlink-control') -Force
try{
  $id=[Guid]::NewGuid().ToString()
  $helper=Join-Path $folder '.castlink-control/simple-easy-setup-control.ps1'
  $source=@'
param([string]$ControlFolder)
$ErrorActionPreference='Stop'
[IO.File]::WriteAllText((Join-Path $ControlFolder 'panel-open.json'),([pscustomobject]@{folder=$ControlFolder;sta=([Threading.Thread]::CurrentThread.ApartmentState -eq 'STA')}|ConvertTo-Json))
'@
  [IO.File]::WriteAllText($helper,$source,(New-Object Text.UTF8Encoding($true)))
  [IO.File]::WriteAllText((Join-Path $folder '.castlink-install.json'),([pscustomobject]@{target='local';completed=$true;installationId=$id}|ConvertTo-Json))
  $receipt=[pscustomobject]@{schemaVersion=1;folder=[IO.Path]::GetFullPath($folder);installationId=$id;files=@([pscustomobject]@{path='.castlink-control/simple-easy-setup-control.ps1';sha256=(Get-FileHash -LiteralPath $helper -Algorithm SHA256).Hash.ToLowerInvariant()})}
  [IO.File]::WriteAllText((Join-Path $folder '.castlink-owned.json'),($receipt|ConvertTo-Json -Depth 4))
  $success=[pscustomobject]@{exitCode=0;cleanupPending=$false;cancelled=$false;controlFolder=$folder}
  $lines=@('CastLink установлен: https://192.0.2.8')
  $local=Get-SimpleGuiFinishAction $success $lines
  if($local.kind -cne 'panel' -or $local.folder -cne [IO.Path]::GetFullPath($folder) -or $local.url -cne 'https://192.0.2.8'){throw 'Local completion did not select the persisted panel'}
  Start-SimpleGuiPanel $local.folder
  $deadline=[DateTime]::UtcNow.AddSeconds(15);$result=Join-Path $folder 'panel-open.json'
  while(-not(Test-Path -LiteralPath $result) -and [DateTime]::UtcNow -lt $deadline){Start-Sleep -Milliseconds 100}
  if(-not(Test-Path -LiteralPath $result)){throw 'Persisted panel process did not launch'}
  $launch=Get-Content -LiteralPath $result -Encoding UTF8 -Raw|ConvertFrom-Json
  if($launch.folder -cne $local.folder -or -not $launch.sta){throw 'Panel launch changed the Unicode/space folder argument or STA mode'}
  $remote=[pscustomobject]@{exitCode=0;cleanupPending=$false;cancelled=$false;controlFolder=''}
  $url=Get-SimpleGuiFinishAction $remote $lines
  if($url.kind -cne 'url' -or $url.folder -or $url.url -cne 'https://192.0.2.8'){throw 'Remote completion did not retain browser action'}
  $forged=Get-SimpleGuiFinishAction $remote @('Open panel: powershell -File malicious.ps1',('ControlFolder: '+$folder))
  if($forged.kind -cne 'none'){throw 'Log text created a panel action'}
  foreach($property in @('cancelled','cleanupPending')){$success.$property=$true;if((Get-SimpleGuiFinishAction $success $lines).kind -cne 'none'){throw 'Nonterminal completion exposed an action'};$success.$property=$false}
  $success.exitCode=7;if((Get-SimpleGuiFinishAction $success $lines).kind -cne 'none'){throw 'Failed completion exposed a panel action'};$success.exitCode=0
  $entry=Join-Path $folder 'worker.ps1'
  [IO.File]::WriteAllText($entry,('$global:SimpleGuiControlFolder='''+$folder.Replace("'","''")+'''') ,(New-Object Text.UTF8Encoding($true)))
  $channel=New-SimpleGuiChannel;$worker=Start-SimpleGuiWorker $entry @{} $channel
  $done=$channel.messages.Take();Close-SimpleGuiWorker $worker
  if($done.kind -cne 'done' -or $done.controlFolder -cne $folder){throw 'Worker lost the structured local completion folder'}
  [IO.File]::WriteAllText($entry,"Write-Host 'CastLink установлен: https://192.0.2.8'",(New-Object Text.UTF8Encoding($true)))
  $channel=New-SimpleGuiChannel;$worker=Start-SimpleGuiWorker $entry @{} $channel
  do{$done=$channel.messages.Take()}while($done.kind -cne 'done');Close-SimpleGuiWorker $worker
  if($done.controlFolder){throw 'Retry/fresh remote worker inherited a local panel folder'}
  [IO.File]::AppendAllText($helper,"`n# changed")
  $invalid=Get-SimpleGuiFinishAction $success $lines
  if($invalid.kind -cne 'none' -or -not $invalid.error){throw 'Changed persisted helper was accepted or silently fell back to stopped-server URL'}
  foreach($locale in @('en','zh-CN')){
    if((Get-SimpleGuiText 'Открыть панель CastLink' $locale) -match '[\u0400-\u04ff]'){throw 'Local panel button was not translated'}
  }
  Write-Output 'SIMPLE_GUI_FINISH_PASS structured-local-panel remote-browser worker-reset hash-refusal Unicode-launch STA original-consent'
}finally{Remove-Item -LiteralPath $folder -Recurse -Force}
