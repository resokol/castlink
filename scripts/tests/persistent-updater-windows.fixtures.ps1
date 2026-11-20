[CmdletBinding()]param([string]$SourcePath,[string]$NativeControlPath,[string]$InstallerPath)
$ErrorActionPreference='Stop'
trap {Write-Output $_.ScriptStackTrace;throw}
if(-not $SourcePath){$SourcePath=Join-Path $PSScriptRoot '../updater/castlink-updater.ps1'}
if(-not $NativeControlPath){$NativeControlPath=Join-Path $PSScriptRoot '../server-native-control.ps1'}
if(-not $InstallerPath){$InstallerPath=Join-Path $PSScriptRoot '../install-server-windows.ps1'}
function Assert($Condition,[string]$Message){if(-not $Condition){throw $Message}}
function Throws([scriptblock]$Code,[string]$Pattern){try{& $Code;throw 'Expected failure was not raised'}catch{if($_.Exception.Message -notmatch $Pattern){throw}}}
if(-not (Test-Path -LiteralPath $SourcePath)){throw 'RED: Windows persistent updater is not implemented'}
. $SourcePath -FunctionsOnly
$base=Join-Path ([IO.Path]::GetTempPath()) ('castlink-updater-fixtures-'+[guid]::NewGuid().ToString('N'));[void][IO.Directory]::CreateDirectory($base)
function New-Release([string]$Channel,[string]$Version,[long]$Id=11){
 $tag=$Channel+'-v'+$Version+'-'+('a'*12)
 return [pscustomobject]@{id=$Id;tag_name=$tag;target_commitish=('a'*40);published_at='2026-11-21T00:00:00Z';draft=$false;prerelease=($Version.Contains('-'));assets=@();body='release notes'}
}
function Add-Asset($Release,[string]$Name,[byte[]]$Bytes){
 $sha=[Security.Cryptography.SHA256]::Create();try{$hash=([BitConverter]::ToString($sha.ComputeHash($Bytes))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
 $asset=[pscustomobject]@{id=(100+$Release.assets.Count);name=$Name;size=$Bytes.Length;digest=('sha256:'+$hash);state='uploaded';browser_download_url=('https://github.com/resokol/castlink/releases/download/'+$Release.tag_name+'/'+$Name)}
 $Release.assets+=@($asset);$script:payload[$asset.browser_download_url]=$Bytes;return $asset
}
function New-ToolRelease([string]$Version,[long]$Id){
 $r=New-Release updater $Version $Id
 $bytes=[Text.Encoding]::UTF8.GetBytes('# fixture engine '+$Version)
 $a=Add-Asset $r 'castlink-updater.ps1' $bytes
 $m=[pscustomobject]@{schemaVersion=1;protocolVersion=1;repository='resokol/castlink';channel='updater';version=$Version;sourceCommit=('a'*40);releaseTag=$r.tag_name;platforms=[pscustomobject]@{windows=[pscustomobject]@{entry='castlink-updater.ps1';files=@([pscustomobject]@{file=$a.name;size=$a.size;sha256=$a.digest.Substring(7)})};linux=[pscustomobject]@{entry='castlink-updater.py';files=@()}}}
 $null=Add-Asset $r 'manifest.json' ([Text.Encoding]::UTF8.GetBytes(($m|ConvertTo-Json -Depth 20)));return $r
}
$script:payload=@{};$script:catalog=@();$script:launches=@()
function Receive-CLUUrl([string]$Url,[string]$Destination,[long]$Limit){if(-not $script:payload.ContainsKey($Url)){throw 'fixture network failure'};$bytes=$script:payload[$Url];if($bytes.Length -gt $Limit){throw 'size limit'};[IO.File]::WriteAllBytes($Destination,$bytes)}
function Get-CLUReleases{return $script:catalog}
function Get-CLURelease([long]$Id){$r=@($script:catalog|Where-Object {$_.id -eq $Id});if($r.Count -ne 1){throw 'release missing'};return $r[0]}
function Start-CLUEngine([string]$Directory,[string]$Root,[string]$SelectedRoot,[string]$Language,[switch]$Probe){if(-not $Probe){$script:launches+=@($Directory)}}
try{
 # Per-product stable selection; no RC, downgrade or common latest coupling.
 $r=New-Release updater '1.0.0';$client=New-Release client '1.0.2';$wsl=New-Release server-wsl '1.0.7'
 $rc=New-Release updater '99.0.0-rc.1';$draft=New-Release updater '50.0.0';$draft.draft=$true
 Assert ((Select-CLURelease @($r,$rc,$draft,$client,$wsl) updater).tag_name -ceq $r.tag_name) 'stable updater selection'
 Assert ((Select-CLURelease @($r,$client,$wsl) client '1.0.1').tag_name -ceq $client.tag_name) 'client channel selection'
 Assert ($null -eq (Select-CLURelease @($r,$client) client '1.0.3')) 'downgrade refused'
 Assert ((Compare-CLUVersion '1.0.7' '1.0.7-rc.1') -gt 0) 'stable is newer than RC'
 $clientNext=New-Release client '1.0.3';Assert ((Select-CLURelease @($client,$clientNext) client '1.0.2').tag_name -ceq $clientNext.tag_name) 'consecutive product releases through unchanged launcher'
 # Same permanent entry point obtains two successive tool releases and revalidates cached bytes.
 $root=Join-Path $base 'updater';Protect-CLUDirectory $root
 $one=New-ToolRelease '1.0.0' 11;$two=New-ToolRelease '1.0.1' 12
 $script:catalog=@($one);$a=Update-CLUTool $root '' en
 $script:catalog=@($one,$two);$b=Update-CLUTool $root '' en
 Assert ($a.version -ceq '1.0.0' -and $b.version -ceq '1.0.1') 'two updater versions through permanent launcher'
 $pointer=Read-CLUJson (Join-Path $root 'active.json');Assert ($pointer.previous.version -ceq '1.0.0') 'previous tool preserved'
 $two|Add-Member NoteProperty updated_at '2030-01-01';foreach($asset in $two.assets){$asset|Add-Member NoteProperty download_count 900};$same=Update-CLUTool $root '' en;Assert ($same.version -ceq '1.0.1') 'volatile GitHub counters do not invalidate immutable cache'
 [IO.File]::AppendAllText((Join-Path $b.directory 'castlink-updater.ps1'),'corrupt')
 Throws {Update-CLUTool $root '' en} 'checksum|size';Assert ((Read-CLUJson (Join-Path $root 'active.json')).current.version -ceq '1.0.1') 'corrupt cache not activated anew'
 # Protocol/path mismatch and failed activation preserve pointer.
 $three=New-ToolRelease '1.0.2' 13;$script:catalog=@($three)
 function Start-CLUEngine([string]$Directory,[string]$Root,[string]$SelectedRoot,[string]$Language,[switch]$Probe){throw 'fixture activation failed'}
 Throws {Update-CLUTool $root '' en} 'activation failed';Assert ((Read-CLUJson (Join-Path $root 'active.json')).current.version -ceq '1.0.1') 'activation failure retains active version'
 $m=Read-CLUJson (Join-Path $a.directory 'manifest.json');$m.protocolVersion=2
 Throws {Assert-CLUManifest $m $one windows} 'protocol';$m.protocolVersion=1;$m.platforms.windows.files[0].file='../evil.ps1'
 Throws {Assert-CLUManifest $m $one windows} 'filename|entry|inventory'
 # No updater owns a concurrent lease for another selected installation.
 $lease=Enter-CLULock $root 'source-a'
 try{Throws {Enter-CLULock $root 'source-a'} 'another|busy|lock';$other=Enter-CLULock $root 'source-b';$other.Dispose()}finally{$lease.Dispose()}
 # WSL receipts and Client metadata coexist; merely discovering does not execute either product.
 $serverRoot=Join-Path $base 'server';[void][IO.Directory]::CreateDirectory($serverRoot)
 $receipt=[pscustomobject]@{schemaVersion=1;installationId=('b'*32);distroName=('CastLink-Server-'+('b'*12));rootPath=$serverRoot;repository='resokol/castlink';releaseTag='server-wsl-v1.0.6-rc.1-dad063393b53';rootfsSha256=('d'*64);phase='ready'}
 Write-CLUJson (Join-Path $serverRoot 'installation.json') $receipt
 $row=Read-CLUWslInstallation $serverRoot
 Assert ($row.identity -ceq ('b'*32) -and $row.folder -ceq $serverRoot -and $row.version -ceq '1.0.6-rc.1') 'exact WSL identity'
 $receipt.rootPath=Join-Path $base 'moved';Write-CLUJson (Join-Path $serverRoot 'installation.json') $receipt
 Throws {Read-CLUWslInstallation $serverRoot} 'identity|receipt';$receipt.rootPath=$serverRoot;Write-CLUJson (Join-Path $serverRoot 'installation.json') $receipt
 # Real packed Client build-info is parsed without launching Electron or changing its profile.
 $clientDir=Join-Path $base 'client';[void][IO.Directory]::CreateDirectory((Join-Path $clientDir 'resources'));[IO.File]::WriteAllText((Join-Path $clientDir 'CastLink Client.exe'),'never execute fixture')
 $build=[Text.Encoding]::UTF8.GetBytes('{"track":"client","version":"1.0.1","sourceCommit":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}')
 $header=[Text.Encoding]::UTF8.GetBytes(('{"files":{"build-info.json":{"size":'+$build.Length+',"offset":"0"}}}'))
 $asar=[IO.File]::Create((Join-Path $clientDir 'resources/app.asar'));$writer=[IO.BinaryWriter]::new($asar)
 try{$writer.Write([uint32]4);$writer.Write([uint32]($header.Length+8));$writer.Write([uint32]($header.Length+4));$writer.Write([uint32]$header.Length);$writer.Write($header);$writer.Write($build)}finally{$writer.Dispose()}
 $clientRow=Read-CLUClientBuild $clientDir;Assert ($clientRow.channel -ceq 'client' -and $clientRow.sourceCommit -ceq ('a'*40)) 'actual Client ASAR identity'
 function Get-CLUClientFolders {return @($clientDir)}
 $savedLocal=$env:LOCALAPPDATA;$env:LOCALAPPDATA=Join-Path $base 'local';$serverBase=Join-Path $env:LOCALAPPDATA 'CastLinkServer';[void][IO.Directory]::CreateDirectory($serverBase)
 $coexistingRoot=Join-Path $serverBase 'one';[void][IO.Directory]::CreateDirectory($coexistingRoot);$coexistingReceipt=$receipt|ConvertTo-Json|ConvertFrom-Json;$coexistingReceipt.rootPath=$coexistingRoot;Write-CLUJson (Join-Path $coexistingRoot 'installation.json') $coexistingReceipt
 try{$coexisting=@(Get-CLUInstallations);Assert ($coexisting.Count -eq 2 -and @($coexisting|Where-Object {$_.channel -ceq 'client'}).Count -eq 1 -and @($coexisting|Where-Object {$_.channel -ceq 'server-wsl'}).Count -eq 1) 'Client and WSL coexist without arbitrary selection'}finally{$env:LOCALAPPDATA=$savedLocal}
 $plan=[pscustomobject]@{installation=$row;release=$wsl;version='1.0.7';manifest=[pscustomobject]@{lifecycle=[pscustomobject]@{supportedSources=@('server-wsl-v1.0.6-rc.1-dad063393b53')}}}
 Assert (Test-CLUWslCompatibility $plan.manifest $row) 'compatible exact WSL source'
 $plan.manifest.lifecycle.supportedSources=@('server-wsl-v1.0.6-rc.1-unknown')
 Throws {Test-CLUWslCompatibility $plan.manifest $row} 'direct|compatible|support'
 # Real Client adapter validates both release digests and setup checksum, then targets the selected folder.
 $clientRelease=New-Release client '1.0.2' 21
 $setup=Add-Asset $clientRelease ('CastLink-Client-1.0.2-'+('a'*12)+'-setup.exe') ([Text.Encoding]::UTF8.GetBytes('never execute installer fixture'))
 $null=Add-Asset $clientRelease 'SHA256SUMS' ([Text.Encoding]::UTF8.GetBytes($setup.digest.Substring(7)+'  '+$setup.name+"`n"))
 $script:catalog=@($clientRelease);$clientPlan=Get-CLUProductPlan $clientRow $script:catalog $root
 $script:setupTarget='';function Start-Process($FilePath,$ArgumentList,[switch]$PassThru,[switch]$Wait){$script:setupTarget=$ArgumentList;return [pscustomobject]@{ExitCode=0}}
 Apply-CLUProduct $clientPlan $root
 Assert ($script:setupTarget -ceq ('/D='+$clientDir)) 'Client setup must start at the explicitly selected installation folder'
 $script:applied=0;function Apply-CLUProduct($Plan,[string]$Root){$script:applied++}
 Invoke-CLUConfirmedUpdate $plan $root $false
 Assert ($script:applied -eq 0) 'cancel never starts product action'
 # Existing Client auto-check setting initializes preference; changing updater preference preserves it.
 $clientPrefs=Join-Path $base 'client-updates.json';Write-CLUJson $clientPrefs ([pscustomobject]@{automatic=$false;other='retain'})
 $p=Get-CLUPreferences $root $clientPrefs;Assert (-not $p.automatic) 'existing client preference retained'
 Set-CLUPreferences $root $true 'zh-CN';Assert ((Read-CLUJson $clientPrefs).other -ceq 'retain') 'updater preference does not overwrite client settings'
 $script:catalog=@();Throws {Update-CLUTool $root '' en} 'stable|release|available'
 function Get-CLUReleases {throw 'fixture offline'}
 Throws {Update-CLUTool $root '' en} 'offline'
 # Registration-only installation is idempotent and never runs a product or opens a window.
 $registrationRoot=Join-Path $base 'registration';$script:shortcuts=0
 function Register-CLUShortcut([string]$Root,[string]$Language){$script:shortcuts++}
 Install-CLUUpdater $SourcePath $registrationRoot en;Set-CLUPreferences $registrationRoot $false 'zh-CN';Install-CLUUpdater $SourcePath $registrationRoot en
 Assert ($script:shortcuts -eq 2 -and (Read-CLUJson (Join-Path $registrationRoot 'registration.json')).bootstrapSha256 -ceq (Get-CLUHash $SourcePath)) 'per-user launcher registered'
 Assert (-not (Get-CLUPreferences $registrationRoot).automatic -and (Get-CLUPreferences $registrationRoot).language -ceq 'zh-CN') 'repeat registration preserves preferences'
 # Native panel delegates only to an owned, private, hash-bound permanent launcher.
 . $NativeControlPath -FunctionsOnly
 Assert ((Get-CastlinkPersistentUpdater $registrationRoot) -ceq (Join-Path $registrationRoot 'castlink-updater.ps1')) 'native panel selects exact trusted bootstrap'
 $registration=Read-CLUJson (Join-Path $registrationRoot 'registration.json');$registration.bootstrapSha256='0'*64;Write-CLUJson (Join-Path $registrationRoot 'registration.json') $registration
 Throws {Get-CastlinkPersistentUpdater $registrationRoot} 'checksum|registration|hash'
 Assert ($null -eq (Get-CastlinkPersistentUpdater (Join-Path $base 'absent'))) 'native panel fallback when updater absent'
 # Future WSL installer registers only after a new, ready install; old manifests remain optional.
 . $InstallerPath
 $registrationPackage=Join-Path $base 'future-wsl';[void][IO.Directory]::CreateDirectory($registrationPackage)
 $updaterFile=Join-Path $registrationPackage 'castlink-updater.ps1';[IO.File]::Copy($SourcePath,$updaterFile)
 $targetManifest=[pscustomobject]@{schemaVersion=1;channel='server-wsl';repository='resokol/castlink';releaseTag=$receipt.releaseTag;rootfs=[pscustomobject]@{sha256=$receipt.rootfsSha256};nativePanel=[pscustomobject]@{files=@([pscustomobject]@{file='castlink-updater.ps1';size=(Get-Item $updaterFile).Length;sha256=(Get-CLUHash $updaterFile)})}}
 Write-CLUJson (Join-Path $registrationPackage 'manifest.json') $targetManifest
 $oldManifestPin=$script:PackagedManifestSha256;$script:PackagedManifestSha256=Get-CLUHash (Join-Path $registrationPackage 'manifest.json')
 $script:registrations=0;function Invoke-CastlinkUpdaterRegistration([string]$File,[string]$Language){$script:registrations++}
 $ready=[pscustomobject]@{ready=$true;buildId=($receipt.releaseTag -creplace '^server-wsl-v','')}
 try{
  $null=Register-CastlinkPersistentUpdater $receipt $ready $registrationPackage $false en
  Assert ($script:registrations -eq 0) 'repeat WSL install never registers updater or runs code'
  $null=Register-CastlinkPersistentUpdater $receipt $ready $registrationPackage $true en
  Assert ($script:registrations -eq 1) 'new ready WSL registers pinned updater exactly once'
  [IO.File]::AppendAllText($updaterFile,'corrupt')
  Throws {Register-CastlinkPersistentUpdater $receipt $ready $registrationPackage $true en} 'checksum|size'
  Assert ($script:registrations -eq 1) 'unverified WSL updater never executes'
 }finally{$script:PackagedManifestSha256=$oldManifestPin}
 # Background work pumps WPF instead of blocking it; synthetic source has no product actions.
 Add-Type -AssemblyName PresentationFramework
 $worker=Join-Path $base 'worker.ps1'
 [IO.File]::WriteAllText($worker,'param([switch]$FunctionsOnly);function Get-CLUReleases{return @()};function Get-CLUProductPlan($row,$releases,$root){Start-Sleep -Milliseconds 700;[pscustomobject]@{version="1.0.9"}}')
 $savedSource=$script:CLURequest.source;$script:CLURequest.source=$worker;$script:ticks=0;$pulse=[Windows.Threading.DispatcherTimer]::new();$pulse.Interval=[TimeSpan]::FromMilliseconds(50);$pulse.Add_Tick({$script:ticks++})
 try{$pulse.Start();$answer=Invoke-CLUUiWork Check $clientRow $root $null;Assert ($answer.version -ceq '1.0.9' -and $script:ticks -gt 2) 'updater work must keep the dispatcher responsive'}finally{$pulse.Stop();$script:CLURequest.source=$savedSource}
 # Native WPF in all supported languages; timer inspects then closes fixture-only windows.
 Add-Type -AssemblyName PresentationFramework
 function Get-CLUInstallations([string]$SelectedRoot){return @($clientRow,$row)}
 function Get-CLUPreferences([string]$Root,[string]$ClientSettings){return [pscustomobject]@{schemaVersion=1;automatic=$false;language='ru'}}
 function Invoke-CLUUiWork($Operation,$Rows,$Root,$Plan){return [pscustomobject]@{version='1.0.2';notes='fixture release';installation=$Rows}}
 $script:uiChecked=0;$script:uiError='';$timer=[Windows.Threading.DispatcherTimer]::new();$timer.Interval=[TimeSpan]::FromMilliseconds(250)
 $timer.Add_Tick({foreach($source in @([Windows.PresentationSource]::CurrentSources)){$w=$source.RootVisual;if($w -is [Windows.Window] -and $w.FindName('Products')){try{if($w.FindName('Products').SelectedIndex -ne -1 -or $w.FindName('Update').IsEnabled){throw 'UI must require explicit selection and Check'};if($w.FindName('Products').Items.Count -ne 2){throw 'UI lost a coexisting product'};$w.FindName('Products').SelectedIndex=0;$w.FindName('Check').RaiseEvent([Windows.RoutedEventArgs]::new([Windows.Controls.Button]::ClickEvent));if(-not $w.FindName('Update').IsEnabled -or -not $w.FindName('Result').Text.Contains('1.0.2')){throw 'UI Check callback did not resolve selected product and target'};$script:uiChecked++}catch{$script:uiError=$_.Exception.Message};$w.Close()}}})
 $timer.Start();try{foreach($lang in @('ru','en','zh-CN')){Show-CLUWindow $root '' $lang}}finally{$timer.Stop()}
 Assert ($script:uiChecked -eq 3 -and -not $script:uiError) ('Native WPF failed: '+$script:uiError)
 Write-Output 'PASS: persistent updater Windows fixtures (stable channels, consecutive self-updates, cache/protocol/path/activation/locks, source identities, cancellation, preferences, offline)'
}finally{Remove-Item -LiteralPath $base -Recurse -Force}
