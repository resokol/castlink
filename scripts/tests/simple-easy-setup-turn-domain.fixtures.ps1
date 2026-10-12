param([string]$EntryPath,[string]$GuiPath)
$ErrorActionPreference='Stop'
. $EntryPath -FunctionsOnly
. (Join-Path (Split-Path $EntryPath -Parent) 'simple-easy-setup-deploy.ps1')
$script:prompts=New-Object Collections.Generic.List[string]
$script:dnsCalls=New-Object Collections.Generic.List[string]
$fourImages=[pscustomobject]@{images=[pscustomobject]@{web='old';postgres='old';livekit='old';caddy='old'}}
Assert-SimpleTurnPayload $fourImages ''
$refused=$false;try{Assert-SimpleTurnPayload $fourImages 'turn.example.com'}catch{$refused=$true}
if(-not $refused){throw 'TLS request accepted a package without its fifth image'}
$fiveImages=[pscustomobject]@{images=[pscustomobject]@{turntls=('castlink-easy-turntls:'+('a'*40))};imageIdentities=[pscustomobject]@{turntls=('sha256:'+('b'*64))}}
Assert-SimpleTurnPayload $fiveImages 'turn.example.com'
function Read-Host {param($Prompt);$script:prompts.Add($Prompt);return $script:answer}
function Test-SimpleDomain {param($Name,$Ip,[switch]$FailIfUnresolved);if(-not $FailIfUnresolved){throw 'TURN DNS must fail without interactive mutation/retry'};$script:dnsCalls.Add($Name);if($script:failDns){throw 'TURN_DNS_REFUSED'}}
$script:answer='';$script:failDns=$false
$selected=Resolve-SimpleTurnDomain 'meet.example.com' '203.0.113.10' $null '' $false
if($selected -cne '' -or $script:prompts.Count -ne 1 -or $script:dnsCalls.Count){throw 'Fresh domain setup did not offer a skippable TLS domain'}
$script:answer=' TURN.EXAMPLE.COM '
$selected=Resolve-SimpleTurnDomain 'meet.example.com' '203.0.113.10' $null '' $false
if($selected -cne 'turn.example.com' -or $script:dnsCalls[-1] -cne 'turn.example.com'){throw 'TURN domain was not normalized/DNS checked'}
$script:prompts.Clear()
$known=[pscustomobject]@{address='meet.example.com';turnDomain='turn.example.com'}
$selected=Resolve-SimpleTurnDomain 'meet.example.com' '203.0.113.10' $known '' $false
if($selected -cne 'turn.example.com' -or $script:prompts.Count){throw 'Known TLS upgrade prompted again or lost domain'}
$old=[pscustomobject]@{address='meet.example.com'}
$selected=Resolve-SimpleTurnDomain 'meet.example.com' '203.0.113.10' $old '' $false
if($selected -cne '' -or $script:prompts.Count){throw 'Legacy UDP-only upgrade added a new TLS question'}
foreach($site in @('203.0.113.10','meet.example.com')) {
  $requested=if($site -eq 'meet.example.com'){$site}else{'turn.example.com'}
  $refused=$false;try{$null=Resolve-SimpleTurnDomain $site '203.0.113.10' $null $requested $true}catch{$refused=$true}
  if(-not $refused){throw 'TLS accepted an IP site or shared website hostname'}
}
$script:failDns=$true;$refused=$false
try{$null=Resolve-SimpleTurnDomain 'meet.example.com' '203.0.113.10' $old 'turn.example.com' $true}catch{if($_.Exception.Message -cne 'TURN_DNS_REFUSED'){throw};$refused=$true}
if(-not $refused){throw 'Explicit TLS request did not stop on missing DNS'}
Write-Output 'SIMPLE_TURN_DOMAIN_PASS skip default legacy-upgrade known-upgrade distinct-host DNS-before-effects'
$root=Join-Path ([IO.Path]::GetTempPath()) ('castlink-turn-domain-'+[Guid]::NewGuid())
$null=New-Item -ItemType Directory $root
try {
  $scripts=Join-Path $root 'scripts';$null=New-Item -ItemType Directory $scripts
  foreach($name in @('windows-simple-easy-setup.ps1','simple-easy-setup-runtime.ps1','simple-easy-setup-download.ps1','simple-easy-setup-deploy.ps1','simple-easy-setup-cleanup.ps1')){Copy-Item (Join-Path (Split-Path $EntryPath -Parent) $name) (Join-Path $scripts $name)}
  $utf8=New-Object Text.UTF8Encoding($true)
  $entry=Join-Path $scripts 'windows-simple-easy-setup.ps1';$source=[IO.File]::ReadAllText($entry)
  $source=$source.Replace('if (-not $FunctionsOnly) {',@'
function Test-SimpleDomain {param($Name,$Ip,[switch]$FailIfUnresolved);if(-not $FailIfUnresolved){throw 'TURN_PREFLIGHT_NOT_FAILFAST'};if($global:TurnFixtureFailDns){throw 'TURN_DNS_REFUSED'}}
function Get-SimpleCurrentRelease { return [pscustomobject]@{folder=(Join-Path $global:TurnFixtureRoot 'downloaded')} }
if (-not $FunctionsOnly) {
'@)
  [IO.File]::WriteAllText($entry,$source,$utf8)
  $downloaded=Join-Path $root 'downloaded/scripts';$null=New-Item -ItemType Directory $downloaded -Force
  [IO.File]::WriteAllText((Join-Path $downloaded 'windows-simple-easy-setup.ps1'),@'
param($Domain,$TurnDomain,$InstallFolder,$Target,[switch]$UseDownloadedPayload)
[IO.File]::WriteAllText((Join-Path $InstallFolder 'forwarded.json'),([pscustomobject]@{domain=$Domain;turnDomain=$TurnDomain;target=$Target;payload=[bool]$UseDownloadedPayload;turnSpecified=$PSBoundParameters.ContainsKey('TurnDomain')}|ConvertTo-Json))
'@,$utf8)
  $wrapper=Join-Path $root 'wrapper.ps1'
  [IO.File]::WriteAllText($wrapper,@'
param($Root,$Entry,$Folder,$Domain='meet.example.com',$Answer='',[switch]$Explicit,[switch]$FailDns)
$global:TurnFixtureRoot=$Root;$global:TurnFixtureFailDns=[bool]$FailDns;$global:TurnFixtureAnswer=$Answer
if(-not $global:SimpleGuiMessages){function global:Read-Host {param($Prompt);if($Prompt -notlike 'Отдельный домен TURN/TLS*'){throw ('Unexpected CLI question: '+$Prompt)};return $global:TurnFixtureAnswer}}
$options=@{Action='install';Target='remote';ServerIp='203.0.113.10';SshPort=22;Domain=$Domain;InstallFolder=$Folder}
if($Explicit){$options.TurnDomain=$Answer}
& $Entry @options
exit $LASTEXITCODE
'@,$utf8)
  $shell=[Diagnostics.Process]::GetCurrentProcess().MainModule.FileName
  foreach($answer in @('','turn.example.com')) {
    $folder=Join-Path $root ('cli-'+$answer.Length)
    $arguments=@('-NoProfile','-File',$wrapper,'-Root',$root,'-Entry',$entry,'-Folder',$folder)
    if($answer){$arguments+=@('-Answer',$answer)}
    $log=& $shell @arguments
    if($LASTEXITCODE -ne 0){throw ('Actual CLI TURN flow failed: '+($log -join "`n"))}
    $forward=Get-Content (Join-Path $folder 'forwarded.json') -Raw|ConvertFrom-Json
    if($forward.turnDomain -cne $answer -or -not $forward.turnSpecified -or -not $forward.payload -or $forward.domain -cne 'meet.example.com'){throw 'Downloaded release lost explicit/default TURN choice'}
  }
  . $GuiPath -FunctionsOnly
  $folder=Join-Path $root 'gui';$channel=New-SimpleGuiChannel
  $worker=Start-SimpleGuiWorker $wrapper @{Root=$root;Entry=$entry;Folder=$folder} $channel
  $prompts=0
  try {
    do {$message=$null;if(-not $channel.messages.TryTake([ref]$message,10000)){throw 'GUI TURN flow stalled'};if($message.kind -eq 'prompt'){if($message.text -notlike 'Отдельный домен TURN/TLS*'){throw ('GUI repeated a resolved choice: '+$message.text)};$prompts++;$channel.responses.Add([pscustomobject]@{value='turn.example.com'})}}while($message.kind -ne 'done')
  } finally {Close-SimpleGuiWorker $worker}
  if($message.exitCode -ne 0 -or $prompts -ne 1 -or (Get-Content (Join-Path $folder 'forwarded.json') -Raw|ConvertFrom-Json).turnDomain -cne 'turn.example.com'){throw 'Actual GUI did not forward the optional TLS domain once'}
  # Real four-image deployment configuration remains available when TLS is skipped.
  $folder=Join-Path $root 'legacy';$null=New-Item -ItemType Directory $folder
  $release=[pscustomobject]@{images=[pscustomobject]@{web='web:old';postgres='postgres:old';livekit='livekit:old';caddy='caddy:old'}}
  $state=New-SimpleConfiguration $folder 'meet.example.com' $true $release
  Set-SimpleTarget $folder $state 'remote' '203.0.113.10' 'root' 22
  Write-SimpleConfiguration $folder $state $release '203.0.113.10'
  $compose=Get-Content (Join-Path $folder 'compose.json') -Raw|ConvertFrom-Json
  if(@($compose.services.PSObject.Properties).Count -ne 4){throw 'Skipping TLS broke four-image compatibility'}
  $before=Get-FileHash (Join-Path $folder '.castlink-install.json'),(Join-Path $folder 'compose.json'),(Join-Path $folder 'livekit.json'),(Join-Path $folder 'Caddyfile')
  $log=& $shell -NoProfile -File $wrapper -Root $root -Entry $entry -Folder $folder -Answer 'turn.example.com' -Explicit -FailDns
  if($LASTEXITCODE -ne 1 -or ($log -join "`n") -notmatch 'TURN_DNS_REFUSED'){throw 'Explicit TLS DNS failure did not stop the real entry'}
  $global:LASTEXITCODE=0 # DNS refusal is the asserted outcome, not a failure of this fixture.
  foreach($file in $before){if((Get-FileHash $file.Path).Hash -cne $file.Hash){throw 'Failed TURN DNS changed current configuration'}}
  Write-Output 'SIMPLE_TURN_DOMAIN_ENTRY_PASS actual-cli actual-gui downloaded-forward DNS-refusal-config-preserved four-image-default'
} finally {Remove-Item $root -Recurse -Force}
