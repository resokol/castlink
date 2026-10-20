param([string]$EntryPath,[string]$GuiPath)
$ErrorActionPreference='Stop'
$root=Join-Path ([IO.Path]::GetTempPath()) ('castlink-reinstall-'+[Guid]::NewGuid())
$null=New-Item -ItemType Directory $root
try {
  foreach($mode in @('quick','advanced')) { & {
    . $EntryPath -FunctionsOnly -Action install -Target local -SetupMode $mode
    function Get-SimpleResumePointerPath { return (Join-Path $root 'resume.json') }
    $old=Join-Path $root ('old-'+$mode);$null=New-Item -ItemType Directory $old
    Save-SimpleSetupCheckpoint $old '192.168.1.21'
    $script:questions=New-Object Collections.Generic.List[string]
    function Read-Host([string]$Prompt) {
      $script:questions.Add($Prompt)
      if($Prompt -like 'Продолжить незавершённую установку?*'){return 'нет'}
      if($Prompt -like 'Папка*'){return (Join-Path $root ('new-'+$mode))}
      throw ('Unexpected reinstall question: '+$Prompt)
    }
    function Select-SimpleLocalInstallation { return '' }
    function Get-SimplePreviousWorkspace { return '' }
    function Read-SimpleLocalAddress { $script:Address='192.168.1.22' }
    function Read-SimpleSetupOptions { return [pscustomobject]@{setupMode=$mode;network=$null} }
    function Complete-SimpleInputPhase { throw 'REINSTALL_INPUT_BOUNDARY' }
    try{Start-SimpleSetup;throw 'Missing input boundary'}catch{if($_.Exception.Message -cne 'REINSTALL_INPUT_BOUNDARY'){throw}}
    if($script:questions.Count -ne 2 -or $script:questions[0] -notlike 'Продолжить незавершённую установку?*' -or $script:InstallFolder -ceq $old -or $SetupMode -cne $mode){throw ('Explicit local '+$mode+' install silently resumed another folder')}
    if(-not(Test-Path (Join-Path $old '.castlink-setup-pending.json'))){throw 'Declining continuation deleted saved choices'}
  } }
  & {
    . $EntryPath -FunctionsOnly
    function Get-SimpleResumePointerPath {return (Join-Path $root 'resume.json')}
    $old=Join-Path $root 'loopback';$null=New-Item -ItemType Directory $old
    Save-SimpleSetupCheckpoint $old '127.0.0.1'
    if(Get-SimplePendingSetup){throw 'Obsolete new loopback checkpoint blocked fresh installation'}
    [IO.File]::WriteAllText((Join-Path $old '.castlink-install.json'),'{}')
    if(-not(Get-SimplePendingSetup)){throw 'Existing loopback installation lost continuation'}
  }
  & {
    . $EntryPath -FunctionsOnly -Action remove -Target choose
    function Read-Host([string]$Prompt) {if($Prompt -like 'Где удалить*'){return '2'};throw ('Remote removal requested local input: '+$Prompt)}
    function Start-SimpleRemoteRemoval { $script:remoteCalled=$true }
    $script:remoteCalled=$false
    Start-SimpleSetup
    if(-not $script:remoteCalled){throw 'Remove menu failed to select remote discovery'}
  }
  if($GuiPath){
    . $GuiPath -FunctionsOnly
    $wrapper=Join-Path $root 'remote-gui.ps1'
    [IO.File]::WriteAllText($wrapper,@'
param($Entry)
. $Entry -FunctionsOnly -Action remove -Target choose
function Start-SimpleRemoteRemoval {Write-Host 'REMOTE_DISCOVERY_BOUNDARY'}
Start-SimpleSetup
'@,(New-Object Text.UTF8Encoding($true)))
    $channel=New-SimpleGuiChannel
    $worker=Start-SimpleGuiWorker $wrapper @{Entry=$EntryPath} $channel
    $lines=New-Object Collections.Generic.List[string]
    $prompts=0
    try{
      do{
        $message=$null
        if(-not $channel.messages.TryTake([ref]$message,10000)){throw 'Remote GUI removal stalled'}
        if($message.kind -eq 'prompt'){
          $prompts++
          $prompt=Get-SimpleGuiPrompt $message.text $false
          $remote=@($prompt.choices|Where-Object{$_.label -ceq 'Внешний сервер'})
          if($remote.Count -ne 1 -or $prompt.folder){throw ('Unexpected remote GUI removal prompt: '+$message.text)}
          $channel.responses.Add([pscustomobject]@{value=$remote[0].value})
        }
        if($message.kind -eq 'log'){$lines.Add($message.text)}
      }while($message.kind -ne 'done')
    }finally{Close-SimpleGuiWorker $worker}
    if($message.exitCode -ne 0 -or $prompts -ne 1 -or $lines -notcontains 'REMOTE_DISCOVERY_BOUNDARY'){throw 'Remote GUI removal did not reach SSH discovery'}
  }
  Write-Output 'SIMPLE_REINSTALL_PASS quick advanced stale-loopback existing-loopback remote-menu'
} finally {Remove-Item -LiteralPath $root -Recurse -Force}
