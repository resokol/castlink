param([string]$ScratchRoot=$env:TEMP,[string]$Only='')
$ErrorActionPreference='Stop'
$manager=Join-Path (Split-Path $PSScriptRoot -Parent) 'server-wsl-maintenance.ps1'
if(-not (Test-Path $manager)){throw 'Lifecycle coordinator is missing (expected RED)'}
. $manager -FunctionsOnly
function Assert($Condition,$Message){if(-not $Condition){throw $Message}}
$script:passes=0
function Test($Name,[scriptblock]$Body){if($Only -and $Name -notlike $Only){return};& $Body;$script:passes++;Write-Output ('PASS '+$Name)}
function Throws([scriptblock]$Body,[string]$Pattern){try{& $Body}catch{if($_.Exception.Message -match $Pattern){return};throw};throw ('Expected refusal '+$Pattern)}
$testRoot=Assert-CLMPath (Join-Path $ScratchRoot ('castlink-lifecycle-fixtures-'+[guid]::NewGuid().ToString('N')))
[void][IO.Directory]::CreateDirectory($testRoot)
function Fixture {
 $root=Join-Path $testRoot ([guid]::NewGuid().ToString('N'));[void][IO.Directory]::CreateDirectory($root)
 $s=[pscustomobject]@{schemaVersion=1;installationId=('a'*32);distroName=('CastLink-Server-'+('a'*12));rootPath=$root;releaseTag='server-wsl-v1.0.5-rc.1-085b087a2458';repository='resokol/castlink';rootfsSha256=('b'*64);phase='ready';desiredRunning=$true;autoStartAtLogon=$true}
 Write-CLMJson (Join-Path $root 'installation.json') $s
 $world=@{source=$s;events=(New-Object Collections.Generic.List[string]);fail='';after='';candidate=$false;marked=$false;sourceRunning=$true;gate='closed';disk=999999999999L;complete=$true;wrongOwner=$false}
 $a={param($name,$ctx,$data)
  $world.events.Add($name)
  if($world.fail -ceq $name){throw ('Injected '+$name)}
  switch($name){
   'VerifySource' {if($world.wrongOwner){throw 'Ownership mismatch'};return $world.source}
   'VerifyTarget' {return [pscustomobject]@{releaseTag='server-wsl-v1.0.6-cccccccccccc';version='1.0.6';sourceCommit=('c'*40);rootfs=[pscustomobject]@{sha256=('d'*64);expandedBytes=1048576};lifecycle=[pscustomobject]@{schemaVersion=1;runtimeContract='castlink-wsl-pg16-v1';postgresMajor=16;supportedSources=@($world.source.releaseTag)}}}
   'InspectSource' {return [pscustomobject]@{initialized=$true;complete=$world.complete;postgresMajor=16;dataBytes=1024;stopped=(-not $world.sourceRunning);guestInstallationId='11111111-1111-4111-8111-111111111111';release=[pscustomobject]@{buildId=($world.source.releaseTag -replace '^server-wsl-v','')}}}
   'FreeBytes' {return $world.disk}
   'SourceTask' {return [pscustomobject]@{exists=$true;enabled=$true}}
   'StopSource' {$world.sourceRunning=$false}
   'ExportTransfer' {[IO.File]::WriteAllBytes($ctx.transfer,[byte[]]@(0,255,13,10,128))}
   'ImportCandidate' {$world.candidate=$true;[void][IO.Directory]::CreateDirectory($ctx.candidateRoot);Write-CLMJson (Join-Path $ctx.candidateRoot 'installation.json') $ctx.candidate}
   'CandidateRegistered' {return $world.candidate}
   'MarkCandidate' {$world.marked=$true}
   'CandidateOwned' {if($world.candidate -and -not $world.marked){throw 'Unmarked import requires manual inspection'};return $world.candidate}
   'StartCandidate' {$world.candidateRunning=$true}
   'StopCandidate' {$world.candidateRunning=$false}
   'RestoreOwned' {return $true}
   'CandidateReady' {return [pscustomobject]@{ready=$true;buildId='1.0.6-cccccccccccc';origin='https://fixture.invalid'}}
   'PrepareBindings' {return $ctx.candidate}
   'GateOpen' {$world.gate='committed'}
   'TerminateCandidate' {$world.candidate=$false}
   'ResumeSource' {$world.sourceRunning=$true}
   'ExportBundle' {[IO.File]::WriteAllBytes((Join-Path $data 'distribution.tar'),[byte[]]@(0,255,13,10,128))}
   'CheckIdentityConflict' {}
  }
  if($world.after -ceq $name){throw ('Lost response '+$name)}
 }.GetNewClosure()
 return @{root=$root;world=$world;adapter=$a}
}
function InstalledSourceFixture([string]$Profile,[bool]$Incomplete){
 $root=Join-Path $Profile 'CastLinkServer/installed';$public=Join-Path $Profile 'published';$target=Join-Path $Profile 'target';foreach($p in @($root,$public,$target,(Join-Path $root 'release'))){[void][IO.Directory]::CreateDirectory($p)}
 $scripts=Split-Path $PSScriptRoot -Parent;$panelInventory=Read-CLMJson (Join-Path $scripts 'server-native-panel-files.json');$panelFiles=@();$helpers=@()
 foreach($name in @('server-native-panel-files.json')+@($panelInventory.files)+@($panelInventory.buildFiles)+@('server-wsl-maintenance.py','server-wsl-runtime.py','install-server-windows.template.ps1')){if(Test-Path (Join-Path $public $name)){continue};$src=Join-Path $scripts $(if($name -ceq 'install-server-windows.template.ps1'){'install-server-windows.ps1'}else{$name});[IO.File]::Copy($src,(Join-Path $public $name),$false)}
 foreach($name in @('server-native-panel-files.json')+@($panelInventory.files)+@($panelInventory.buildFiles)){$p=Join-Path $public $name;$panelFiles+=[pscustomobject]@{file=$name;size=(Get-Item $p).Length;sha256=(Get-CLMHash $p)}}
 foreach($name in @('server-wsl-maintenance.ps1','server-wsl-maintenance-ui.ps1','server-wsl-maintenance.py','server-wsl-runtime.py','install-server-windows.template.ps1')){$p=Join-Path $public $name;$helpers+=[pscustomobject]@{file=$name;size=(Get-Item $p).Length;sha256=(Get-CLMHash $p)}}
 $payloads=@();foreach($name in @('rootfs.tar.gz','sources.tar.gz','upstream.tar.gz','packages.tsv')){$p=Join-Path $public $name;[IO.File]::WriteAllText($p,('synthetic '+$name));$payloads+=[pscustomobject]@{file=$name;size=(Get-Item $p).Length;sha256=(Get-CLMHash $p)}};$payloads[0]|Add-Member NoteProperty expandedBytes 1024
 $m=[pscustomobject]@{schemaVersion=1;channel='server-wsl';repository='resokol/castlink';architecture='amd64';version='1.0.6';sourceCommit=('c'*40);releaseTag='server-wsl-v1.0.6-cccccccccccc';rootfs=$payloads[0];sources=$payloads[1];upstreamSources=$payloads[2];inventory=$payloads[3];nativePanel=[pscustomobject]@{schemaVersion=1;host='CastLinkServer.exe';binding='server-native-binding.json';files=$panelFiles};lifecycle=[pscustomobject]@{schemaVersion=1;runtimeContract='castlink-wsl-pg16-v1';postgresMajor=16;supportedSources=@($script:CLMLegacyTag);helpers=$helpers}}
 Write-CLMJson (Join-Path $public 'manifest.json') $m;$pin=Get-CLMHash (Join-Path $public 'manifest.json');[IO.File]::Copy((Join-Path $public 'manifest.json'),(Join-Path $root 'release/manifest.json'),$false);[IO.File]::Copy((Join-Path $public $m.rootfs.file),(Join-Path $root ('release/'+$m.rootfs.file)),$false)
 $s=[pscustomobject]@{schemaVersion=1;installationId=('a'*32);distroName=('CastLink-Server-'+('a'*12));rootPath=$root;repository='resokol/castlink';releaseTag=$m.releaseTag;rootfsSha256=$m.rootfs.sha256;phase=$(if($Incomplete){'imported'}else{'ready'});desiredRunning=$false;autoStartAtLogon=$false}
 if(-not $Incomplete){$installer=Stage-CLMInstaller $public $m $pin;[IO.File]::Copy($installer,(Join-Path $root 'install-server-windows.ps1'),$false);$native=Join-Path $root 'native-panel';[void][IO.Directory]::CreateDirectory($native);foreach($e in $panelFiles){[IO.File]::Copy((Join-Path $public $e.file),(Join-Path $native $e.file),$false)};$hostPath=Join-Path $native 'CastLinkServer.exe';[IO.File]::WriteAllText($hostPath,'synthetic host, never executed');$bindingPath=Join-Path $native 'server-native-binding.json';Write-CLMJson $bindingPath ([pscustomobject]@{installationId=$s.installationId;installRoot=$root;origin='https://fixture.invalid';expectedBuildId='1.0.6-cccccccccccc';sourceScriptPath=(Join-Path $root 'install-server-windows.ps1');expectedInstallerSha256=(Get-CLMHash (Join-Path $root 'install-server-windows.ps1'))});$s|Add-Member NoteProperty nativePanel ([pscustomobject]@{schemaVersion=1;hostPath=$hostPath;bindingPath=$bindingPath;hostSha256=(Get-CLMHash $hostPath);bindingSha256=(Get-CLMHash $bindingPath);manifestSha256=$pin})}
 Write-CLMJson (Join-Path $root 'installation.json') $s
 foreach($p in Get-ChildItem $public -File){[IO.File]::Copy($p.FullName,(Join-Path $target $p.Name),$false)};$next=Copy-CLMObject $m;$next.version='1.0.7';$next.sourceCommit=('e'*40);$next.releaseTag='server-wsl-v1.0.7-eeeeeeeeeeee';$next.lifecycle.supportedSources=@($m.releaseTag);Write-CLMJson (Join-Path $target 'manifest.json') $next
 $world=@{registered=$true;imports=0;catalogCalls=0;state=$s;public=$public;pin=$pin}
 $module=New-Module -ArgumentList $manager,$world -ScriptBlock {
  param($manager,$world);. $manager -FunctionsOnly;$script:world=$world
  function Receive-CLMAsset($Url,$Path,$Limit){[IO.File]::Copy((Join-Path $script:world.public ([IO.Path]::GetFileName($Path))),$Path,$false)}
  function Get-CastlinkWslReleaseChoices {$script:world.catalogCalls++;return [pscustomobject]@{releaseTag=$script:world.state.releaseTag;manifestSha256=$script:world.pin;manifestSize=(Get-Item (Join-Path $script:world.public 'manifest.json')).Length}}
  function Get-ScheduledTask {param($TaskName,$TaskPath,$ErrorAction);return $null}
  function Get-CimInstance {param($ClassName,$Filter);return @()}
  function Invoke-CLMWsl($State,$Arguments,$InputFile,$OutputFile,$Limit,$Timeout){if($Arguments -contains 'inspect'){return '{"initialized":true,"complete":true,"postgresMajor":16,"dataBytes":128,"stopped":true}'};if($Arguments -contains 'status'){return '{"ready":true,"buildId":"1.0.6-cccccccccccc","origin":"https://fixture.invalid"}'};return ''}
  function Invoke-CLMProcess($Exe,$Arguments,$InputFile,$OutputFile,$Limit,$Timeout){if($Arguments -contains '--list'){if($script:world.registered){return $script:world.state.distroName};return ''};if($Arguments -contains '--unregister'){$script:world.registered=$false};if($Arguments -contains '--import'){$script:world.registered=$true};if($Arguments -contains '--export'){[IO.File]::WriteAllBytes($Arguments[-1],[byte[]]@(0,255,128,13,10))};return ''}
  function Import-CLMInstaller($Path){$script:world.imports++;New-Module -ArgumentList $Path -ScriptBlock {param($p);. $p;$script:WslExe=Join-Path $env:WINDIR 'System32/wsl.exe';function Start-CastlinkKeepalive($Root,$State){};function Stop-CastlinkKeepalive($Root,$State){};function Build-CastlinkNativePanelHost($Directory,$Output){[IO.File]::WriteAllText($Output,'synthetic compiled host, never executed')};Export-ModuleMember -Function *}}
  Export-ModuleMember -Function *
 }
 return @{root=$root;public=$public;target=$target;targetPin=(Get-CLMHash (Join-Path $target 'manifest.json'));state=$s;world=$world;module=$module}
}
try {
 Test 'unimplemented host lifecycle API fails red' {Assert ([bool](Get-Command Invoke-CastlinkMaintenance -ErrorAction SilentlyContinue)) 'Missing API'}
 Test 'check is read only, explicit target, supported source' {$f=Fixture;$r=Invoke-CastlinkMaintenance Check $f.root -TargetDirectory $testRoot -ExpectedManifestSha256 ('f'*64) -Adapter $f.adapter;Assert ($r.target.version -eq '1.0.6') 'target';Assert (-not ($f.world.events -contains 'StopSource')) 'check stopped source'}
 Test 'update commits before gate and removes temporary transfer' {$f=Fixture;$r=Invoke-CastlinkMaintenance Update $f.root -TargetDirectory $testRoot -ExpectedManifestSha256 ('f'*64) -Confirmation $f.world.source.distroName -Adapter $f.adapter;Assert ($r.phase -eq 'completed') 'phase';$e=$f.world.events;Assert ($e.IndexOf('PrepareBindings') -lt $e.IndexOf('GateOpen')) 'bindings';Assert ($e.IndexOf('GateOpen') -lt $e.IndexOf('CleanupSource')) 'cleanup';Assert (-not (Test-Path $r.transfer)) 'temporary transfer survived';Assert (Test-Path (Join-Path $f.root 'active-generation.json')) 'active pointer missing'}
 Test 'disk shortage is refused before stop' {$f=Fixture;$f.world.disk=1;Throws {Invoke-CastlinkMaintenance Update $f.root -TargetDirectory $testRoot -ExpectedManifestSha256 ('f'*64) -Confirmation $f.world.source.distroName -Adapter $f.adapter} 'space';Assert (-not ($f.world.events -contains 'StopSource')) 'stopped'}
 Test 'incomplete source can remove but cannot update' {$f=Fixture;$f.world.complete=$false;Throws {Invoke-CastlinkMaintenance Update $f.root -TargetDirectory $testRoot -ExpectedManifestSha256 ('f'*64) -Confirmation $f.world.source.distroName -Adapter $f.adapter} 'incomplete';Assert (-not ($f.world.events -contains 'StopSource')) 'stopped';$r=Invoke-CastlinkMaintenance Remove $f.root -Confirmation $f.world.source.distroName -EraseData -Adapter $f.adapter;Assert ($r.phase -eq 'removed') 'remove'}
 Test 'confirmation, ownership and lock failures have no stop' {foreach($mode in @('confirmation','owner','lock')){$f=Fixture;$l=$null;try{if($mode -eq 'owner'){$f.world.wrongOwner=$true};if($mode -eq 'lock'){$l=[IO.File]::Open((Join-Path $f.root 'operation.lock'),'OpenOrCreate','ReadWrite','None')};Throws {Invoke-CastlinkMaintenance Remove $f.root -Confirmation $(if($mode -eq 'confirmation'){'wrong'}else{$f.world.source.distroName}) -EraseData -Adapter $f.adapter} 'confirmation|Ownership|lock|process';Assert (-not ($f.world.events -contains 'StopSource')) 'stopped'}finally{if($l){$l.Dispose()}}}}
 Test 'precommit failures roll candidate back in safe order' {$f=Fixture;$f.world.fail='CandidateReady';Throws {Invoke-CastlinkMaintenance Update $f.root -TargetDirectory $testRoot -ExpectedManifestSha256 ('f'*64) -Confirmation $f.world.source.distroName -Adapter $f.adapter} 'Injected';$r=Invoke-CastlinkMaintenance Recover $f.root -Adapter $f.adapter;Assert ($r.phase -eq 'rolled-back') 'rollback';$e=$f.world.events;Assert ($e.IndexOf('StopCandidate') -lt $e.IndexOf('ReleaseStoppedFirewall')) 'stop before release';Assert ($e.IndexOf('ReleaseStoppedFirewall') -lt $e.IndexOf('TerminateCandidate')) 'release before terminate';Assert ($e.IndexOf('TerminateCandidate') -lt $e.IndexOf('ResumeSource')) 'terminate before source'}
 Test 'unmarked imported candidate blocks rollback and source restart' {$f=Fixture;$f.world.after='ImportCandidate';Throws {Invoke-CastlinkMaintenance Update $f.root -TargetDirectory $testRoot -ExpectedManifestSha256 ('f'*64) -Confirmation $f.world.source.distroName -Adapter $f.adapter} 'Lost response';Throws {Invoke-CastlinkMaintenance Recover $f.root -Adapter $f.adapter} 'Unmarked';Assert (-not ($f.world.events -contains 'ResumeSource')) 'source resumed'}
 Test 'ambiguous gate release never resumes old data' {$f=Fixture;$f.world.after='GateOpen';Throws {Invoke-CastlinkMaintenance Update $f.root -TargetDirectory $testRoot -ExpectedManifestSha256 ('f'*64) -Confirmation $f.world.source.distroName -Adapter $f.adapter} 'Lost response';$f.world.after='';$r=Invoke-CastlinkMaintenance Recover $f.root -Adapter $f.adapter;Assert ($r.phase -eq 'completed') 'recover';Assert (-not ($f.world.events -contains 'ResumeSource')) 'source rolled back'}
 Test 'rollback firewall failure leaves source stopped and retry succeeds' {$f=Fixture;$f.world.fail='CandidateReady';Throws {Invoke-CastlinkMaintenance Update $f.root -TargetDirectory $testRoot -ExpectedManifestSha256 ('f'*64) -Confirmation $f.world.source.distroName -Adapter $f.adapter} 'Injected';$f.world.fail='ReleaseStoppedFirewall';Throws {Invoke-CastlinkMaintenance Recover $f.root -Adapter $f.adapter} 'Injected';Assert (-not $f.world.sourceRunning) 'source resumed';$f.world.fail='';$r=Invoke-CastlinkMaintenance Recover $f.root -Adapter $f.adapter;Assert ($r.phase -eq 'rolled-back') 'retry'}
 Test 'removal bundle is validated and unknown/nested files preserved' {$f=Fixture;$bundle=Join-Path $testRoot ('bundle-'+[guid]::NewGuid().ToString('N'));[IO.File]::WriteAllText((Join-Path $f.root 'unknown.txt'),'preserve');$nested=Join-Path $f.root 'child';[void][IO.Directory]::CreateDirectory($nested);[IO.File]::WriteAllText((Join-Path $nested 'installation.json'),'preserve');$r=Invoke-CastlinkMaintenance Remove $f.root -Confirmation $f.world.source.distroName -BundleDirectory $bundle -Adapter $f.adapter;Assert ($r.phase -eq 'removed') 'removed';$b=Read-CLMBundle $bundle;Assert ($b.schemaVersion -eq 1) 'bundle';Assert (Test-Path (Join-Path $f.root 'unknown.txt')) 'unknown deleted';Assert (Test-Path (Join-Path $nested 'installation.json')) 'nested deleted';[IO.File]::AppendAllText((Join-Path $bundle 'distribution.tar'),'tamper');Throws {Read-CLMBundle $bundle} 'checksum|size'}
 Test 'restore validates bundle before import and preserves host identity' {$f=Fixture;$bundle=Join-Path $testRoot ('restore-bundle-'+[guid]::NewGuid().ToString('N'));$null=Invoke-CastlinkMaintenance Remove $f.root -Confirmation $f.world.source.distroName -BundleDirectory $bundle -Adapter $f.adapter;$dest=Join-Path $testRoot 'restore-destination';$r=Invoke-CastlinkMaintenance Restore $dest -BundleDirectory $bundle -Adapter $f.adapter;Assert ($r.phase -eq 'restored') 'restore phase';Assert ($r.source.installationId -ceq $f.world.source.installationId) 'identity changed';Assert ($f.world.events.Contains('RestoreImport')) 'no import';Assert ($f.world.events.IndexOf('CheckIdentityConflict') -lt $f.world.events.IndexOf('RestoreImport')) 'conflict check ordering'}
 Test 'restore tamper fails before side effects' {$f=Fixture;$bundle=Join-Path $testRoot ('tamper-bundle-'+[guid]::NewGuid().ToString('N'));$null=Invoke-CastlinkMaintenance Remove $f.root -Confirmation $f.world.source.distroName -BundleDirectory $bundle -Adapter $f.adapter;[IO.File]::AppendAllText((Join-Path $bundle 'distribution.tar'),'tamper');Throws {Invoke-CastlinkMaintenance Restore (Join-Path $testRoot 'tampered-destination') -BundleDirectory $bundle -Adapter $f.adapter} 'checksum|size';Assert (-not $f.world.events.Contains('RestoreImport')) 'tampered import'}
 Test 'binary process transport preserves bytes across OEM and BOM-capable UTF8 consoles' {
  $savedEncoding=[Console]::InputEncoding;$inputPath=Join-Path $testRoot 'binary.in';$b=[byte[]]@(0,255,128,13,10,0,60);[IO.File]::WriteAllBytes($inputPath,$b);$exe=Join-Path $env:WINDIR 'System32/WindowsPowerShell/v1.0/powershell.exe';$code='$i=[Console]::OpenStandardInput();$o=[Console]::OpenStandardOutput();$i.CopyTo($o)';$enc=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($code))
  try{foreach($encoding in @([Text.Encoding]::GetEncoding(437),[Text.UTF8Encoding]::new($false),[Text.UTF8Encoding]::new($true))){[Console]::InputEncoding=$encoding;$outputPath=Join-Path $testRoot ('binary-'+[guid]::NewGuid().ToString('N')+'.out');$null=Invoke-CLMProcess $exe @('-NoProfile','-EncodedCommand',$enc) $inputPath $outputPath 20 10;Assert ((Get-CLMHash $inputPath) -ceq (Get-CLMHash $outputPath)) ('binary changed for codepage '+$encoding.CodePage+' preamble '+$encoding.GetPreamble().Length)}
   Throws {Invoke-CLMProcess $exe @('-NoProfile','-Command','exit 3')} 'exit 3';Throws {Invoke-CLMProcess $exe @('-NoProfile','-EncodedCommand',$enc) $inputPath (Join-Path $testRoot 'over.out') 1 10} 'bounded|limit';$sleepCode=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes('Start-Sleep -Seconds 30'));Throws {Invoke-CLMProcess $exe @('-NoProfile','-EncodedCommand',$sleepCode) '' '' 1024 1} 'timeout'
  }finally{[Console]::InputEncoding=$savedEncoding}
 }
 Test 'binary transport works without a console and isolates concurrent pipes' {
  $childScript=Join-Path $testRoot 'no-console.ps1';$childResult=Join-Path $testRoot 'no-console.result';$childBody=@'
param($Manager,$Root,$Result)
$ErrorActionPreference='Stop'
. $Manager -FunctionsOnly
Add-Type -TypeDefinition 'public static class CLMConsoleFixture { [System.Runtime.InteropServices.DllImport("kernel32.dll")] public static extern System.IntPtr GetConsoleWindow(); }'
if([CLMConsoleFixture]::GetConsoleWindow() -ne [IntPtr]::Zero){throw 'Fixture unexpectedly has a console'}
Initialize-CLMTransport
$inputFile=Join-Path $Root 'concurrent.in';$bytes=New-Object byte[] 65536;for($i=0;$i -lt $bytes.Length;$i++){$bytes[$i]=[byte]($i%256)};[IO.File]::WriteAllBytes($inputFile,$bytes)
$echo='$i=[Console]::OpenStandardInput();$o=[Console]::OpenStandardOutput();$i.CopyTo($o)';$encoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($echo));$exe=Join-Path $env:WINDIR 'System32/WindowsPowerShell/v1.0/powershell.exe';$jobs=@()
try{
 for($i=0;$i -lt 4;$i++){$outputFile=Join-Path $Root ('parallel-'+$i+'.out');$pipeline=[PowerShell]::Create();$null=$pipeline.AddScript('param($manager,$exe,$encoded,$inputFile,$outputFile);$ErrorActionPreference="Stop";. $manager -FunctionsOnly;$null=Invoke-CLMProcess $exe @("-NoProfile","-EncodedCommand",$encoded) $inputFile $outputFile 65536 10;Get-CLMHash $outputFile').AddArgument($Manager).AddArgument($exe).AddArgument($encoded).AddArgument($inputFile).AddArgument($outputFile);$jobs+=@{pipeline=$pipeline;handle=$pipeline.BeginInvoke()}}
 $expected=Get-CLMHash $inputFile;foreach($job in $jobs){$actual=@($job.pipeline.EndInvoke($job.handle));if($job.pipeline.HadErrors -or $actual.Count -ne 1 -or $actual[0] -cne $expected){throw 'Concurrent binary pipe corruption'}}
 [IO.File]::WriteAllText($Result,'pass-no-console-four-isolated-pipes')
}finally{foreach($job in $jobs){$job.pipeline.Dispose()}}
'@
  [IO.File]::WriteAllText($childScript,$childBody,[Text.UTF8Encoding]::new($true));$code='& '+"'"+$childScript.Replace("'","''")+"' '"+$manager.Replace("'","''")+"' '"+$testRoot.Replace("'","''")+"' '"+$childResult.Replace("'","''")+"'";$encoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($code));$info=New-Object Diagnostics.ProcessStartInfo;$info.FileName=Join-Path $env:WINDIR 'System32/WindowsPowerShell/v1.0/powershell.exe';$info.Arguments='-NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand '+$encoded;$info.UseShellExecute=$false;$info.CreateNoWindow=$true;$p=New-Object Diagnostics.Process;$p.StartInfo=$info
  try{$null=$p.Start();if(-not $p.WaitForExit(45000)){$p.Kill();throw 'No-console binary fixture timed out'};Assert ($p.ExitCode -eq 0) 'no-console child failure';Assert ([IO.File]::ReadAllText($childResult) -ceq 'pass-no-console-four-isolated-pipes') 'no-console proof absent'}finally{$p.Dispose()}
 }
 Test 'process argv leaves simple options bare and round trips quoted CRT payloads' {
  Assert ((ConvertTo-CLMArg '--distribution') -ceq '--distribution') 'WSL options must not be quoted';Assert ((ConvertTo-CLMArg '/usr/bin/python3') -ceq '/usr/bin/python3') 'simple executable token must not be quoted'
  Throws {ConvertTo-CLMArg ('invalid'+[char]0+'argument')} 'Unsafe process argument'
  $exe=Join-Path $testRoot 'argv-echo.exe';$source=@'
using System;using System.IO;using System.Text;
public static class CLMArgvEchoFixture {
 public static int Main(string[] args){using(var output=Console.OpenStandardOutput()){
  var header=Encoding.UTF8.GetBytes(args.Length.ToString()+"\n");output.Write(header,0,header.Length);
  foreach(string arg in args){var bytes=Encoding.UTF8.GetBytes(Convert.ToBase64String(Encoding.UTF8.GetBytes(arg))+"\n");output.Write(bytes,0,bytes.Length);}
 }return 0;}
}
'@
  Add-Type -TypeDefinition $source -OutputAssembly $exe -OutputType ConsoleApplication
  $values=@('--distribution','plain','two words','quote"inside','back\slash','C:\plain\','space and trailing\','space and "quote" \\ tail','','Русский 中文',"with`ttab")
  $result=Invoke-CLMProcess $exe $values '' '' 1048576 10;$lines=$result.Split([char]10);Assert ([int]$lines[0] -eq $values.Count) 'argv count changed'
  for($i=0;$i -lt $values.Count;$i++){Assert ($lines[$i+1] -ceq [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($values[$i]))) ('argv payload changed at '+$i)}
 }
 Test 'actual maintenance XAML constructs controls without launching services' {. (Join-Path (Split-Path $PSScriptRoot -Parent) 'server-wsl-maintenance-ui.ps1') -FunctionsOnly;$w=New-CLMWindow en;foreach($n in @('Server','Confirm','Target','Pin','Bundle','Check','Update','Remove','Restore','Recover','Progress','Result')){Assert ($null -ne $w.FindName($n)) ('missing control '+$n)};$w.Close()}
 Test 'removal requires explicit erase or archive' {$f=Fixture;Throws {Invoke-CastlinkMaintenance Remove $f.root -Confirmation $f.world.source.distroName -Adapter $f.adapter} 'archive|Erase';Assert (-not $f.world.events.Contains('StopSource')) 'implicit erase stopped server'}
 Test 'stopped source leaves committed candidate stopped' {$f=Fixture;$f.world.source.desiredRunning=$false;$f.world.sourceRunning=$false;$r=Invoke-CastlinkMaintenance Update $f.root -TargetDirectory $testRoot -ExpectedManifestSha256 ('f'*64) -Confirmation $f.world.source.distroName -Adapter $f.adapter;Assert ($r.phase -eq 'completed') 'phase';Assert (-not $f.world.candidateRunning) 'stopped source was started';Assert ($f.world.events.IndexOf('StopCandidate') -lt $f.world.events.IndexOf('GateOpen')) 'stop must precede commit exposure'}
 Test 'each preflight has a private unique staging identity' {$ids=@();1..2|ForEach-Object {$f=Fixture;$capture={param($name,$ctx,$data);if($name -ceq 'InspectSource'){$ctx.inspectionStage=$ctx.stagingId}; & $f.adapter $name $ctx $data}.GetNewClosure();$r=Invoke-CastlinkMaintenance Check $f.root -TargetDirectory $testRoot -ExpectedManifestSha256 ('f'*64) -Adapter $capture;$ids+= $r.stagingId};Assert ($ids[0] -cmatch '^[a-f0-9]{32}$') 'missing staging id';Assert ($ids[0] -cne $ids[1]) 'staging collision'}
 Test 'journal lookup canonicalizes caller aliases while rejecting altered saved identities' {
  $f=Fixture;$f.world.fail='DisableSourceTask';Throws {Invoke-CastlinkMaintenance Update $f.root -TargetDirectory $testRoot -ExpectedManifestSha256 ('f'*64) -Confirmation $f.world.source.distroName -Adapter $f.adapter} 'Injected'
  $journal=Get-CLMJournal ($f.root+'\.');Assert ($journal.selectedRoot -ceq (Assert-CLMPath $f.root)) 'caller alias did not resolve to canonical selected root'
  $pointerPath=Join-Path $f.root 'maintenance-transaction.json';$pointer=Read-CLMJson $pointerPath;$original=Copy-CLMObject $pointer;$pointer.selectedRoot+='\.';Write-CLMJson $pointerPath $pointer;Throws {Get-CLMJournal $f.root} 'Invalid maintenance journal pointer';Write-CLMJson $pointerPath $original
  $journal.id='different-transaction';Write-CLMJson $journal.journal $journal;Throws {Get-CLMJournal $f.root} 'Maintenance journal identity mismatch'
 }
 Test 'all update side-effect failure boundaries recover fail closed' {
  foreach($boundary in @('DisableSourceTask','StopSource','AssertSourceStopped','ExportTransfer','ImportCandidate','MarkCandidate','GateClose','ImportTransfer','StartCandidate','CandidateReady','PrepareBindings','PublishCandidateTask','GateOpen','CleanupSource')){
   $f=Fixture;$f.world.fail=$boundary;Throws {Invoke-CastlinkMaintenance Update $f.root -TargetDirectory $testRoot -ExpectedManifestSha256 ('f'*64) -Confirmation $f.world.source.distroName -Adapter $f.adapter} 'Injected';$f.world.fail='';$j=Get-CLMJournal $f.root
   if($f.world.candidate -and -not $f.world.marked){Throws {Invoke-CastlinkMaintenance Recover $f.root -Adapter $f.adapter} 'Unmarked';Assert (-not $f.world.sourceRunning) 'unsafe source resume';continue}
   $r=Invoke-CastlinkMaintenance Recover $f.root -Adapter $f.adapter
   if($boundary -in @('PublishCandidateTask','GateOpen','CleanupSource')){Assert ($r.phase -eq 'completed') ('must finish committed '+$boundary);Assert (-not $f.world.events.Contains('ResumeSource')) 'postcommit rollback'}else{Assert ($r.phase -eq 'rolled-back') ('must roll back '+$boundary)}
   $e=$f.world.events.Count;$null=Invoke-CastlinkMaintenance Recover $f.root -Adapter $f.adapter;Assert ($f.world.events.Count -le $e+1) 'repeat recovery changed external state'
  }
 }
 Test 'GUI helper loading preserves launcher request parameters' {. (Join-Path (Split-Path $PSScriptRoot -Parent) 'server-wsl-maintenance-ui.ps1') -FunctionsOnly -InstallRoot 'exact-root' -Lang en -TargetDirectory 'exact-package' -ExpectedManifestSha256 ('f'*64);Assert ($maintenanceUiRequest.root -ceq 'exact-root' -and $maintenanceUiRequest.target -ceq 'exact-package' -and $maintenanceUiRequest.pin -ceq ('f'*64) -and $maintenanceUiRequest.lang -ceq 'en') 'launcher request was clobbered by dot-sourced helper'}
 Test 'GUI default archive is explicit and SHA is read only' {. (Join-Path (Split-Path $PSScriptRoot -Parent) 'server-wsl-maintenance-ui.ps1') -FunctionsOnly;$w=New-CLMWindow en;Assert ($w.FindName('KeepArchive').IsChecked -eq $true) 'keep default';Assert ($w.FindName('Pin').IsReadOnly) 'pin editable';Assert ($w.FindName('Pin').Visibility -eq 'Collapsed') 'technical pin exposed';$w.Close()}
 Test 'path traversal and linked ownership refused' {Throws {Assert-CLMAssetName '../evil'} 'asset';Throws {Assert-CLMAssetName 'x\evil'} 'asset';Throws {Assert-CLMAssetName 'x:evil'} 'asset'}
 Test 'GUI locales and explicit selection/confirmation' {. (Join-Path (Split-Path $PSScriptRoot -Parent) 'server-wsl-maintenance-ui.ps1') -FunctionsOnly;Assert ((Get-CLMText 'update' 'ru') -ceq 'Обновить') 'RU encoding';Assert ((Get-CLMText 'remove' 'zh-CN') -ceq '删除') 'Chinese encoding';Throws {Get-CLMSelection @() -1} 'Select';$x=[pscustomobject]@{root='exact'};Assert ((Get-CLMSelection @($x) 0).root -ceq 'exact') 'selected root'}
 Test 'GUI confirmation cancellation and exact selected identity binding' {
  . (Join-Path (Split-Path $PSScriptRoot -Parent) 'server-wsl-maintenance-ui.ps1') -FunctionsOnly;$w=New-CLMWindow en;$rows=@([pscustomobject]@{root='first-root';distroName='first-id'},[pscustomobject]@{root='second-root';distroName='second-id'});$state=@{rows=$rows;checkedRoot='second-root';checkedTarget=('e'*64);targetDirectory='selected-package';targetPin=('e'*64);lang='en';adapter=$null};$null=$w.FindName('Server').Items.Add('first');$null=$w.FindName('Server').Items.Add('second');$w.FindName('Server').SelectedIndex=1
  Assert ($null -eq (Get-CLMUiActionArguments $w $state Update $false)) 'cancel generated action';$argsMap=Get-CLMUiActionArguments $w $state Update $true;Assert ($argsMap.InstallRoot -ceq 'second-root' -and $argsMap.Confirmation -ceq 'second-id') 'selected identity lost'
  Throws {Get-CLMUiActionArguments $w $state Remove $true} 'archive|folder|Server';$w.FindName('EraseData').IsChecked=$true;$argsMap=Get-CLMUiActionArguments $w $state Remove $true;Assert ($argsMap.EraseData -eq $true -and -not $argsMap.BundleDirectory) 'erase choice lost';Assert ($w.FindName('Confirm').Visibility -eq 'Collapsed') 'opaque typed confirmation exposed';$w.Close()
 }
 Test 'default adapters adopt only pinned legacy metadata without requiring root release directory' {
  $f=Fixture;$f.world.source.rootfsSha256=$script:CLMLegacyRootfs;$f.world.source.phase='imported';$f.world.source|Add-Member NoteProperty keepalive ([pscustomobject]@{processId=2147483647;startTimeUtcTicks='1'}) -Force;Write-CLMJson (Join-Path $f.root 'installation.json') $f.world.source
  $public=Join-Path $testRoot 'synthetic-published';[void][IO.Directory]::CreateDirectory($public);[IO.File]::Copy((Join-Path (Split-Path $PSScriptRoot -Parent) 'install-server-windows.ps1'),(Join-Path $public 'install-server-windows.ps1'),$true)
  Write-CLMJson (Join-Path $public 'manifest.json') ([pscustomobject]@{schemaVersion=1;channel='server-wsl';repository='resokol/castlink';releaseTag=$f.world.source.releaseTag;rootfs=[pscustomobject]@{sha256=$script:CLMLegacyRootfs}})
  $fixtureModule=New-Module -ArgumentList $manager,$public -ScriptBlock {
   param($manager,$public);. $manager -FunctionsOnly;$script:public=$public;$script:CLMLegacyInstaller=Get-CLMHash (Join-Path $public 'install-server-windows.ps1');$script:CLMLegacyManifest=Get-CLMHash (Join-Path $public 'manifest.json');$script:seen=New-Object Collections.Generic.List[object]
   function Receive-CLMAsset($Url,$Path,$Limit){$script:seen.Add([pscustomobject]@{kind='download';value=$Url});[IO.File]::Copy((Join-Path $script:public ([IO.Path]::GetFileName($Path))),$Path,$false)}
   function Invoke-CLMWsl($State,$Arguments,$InputFile,$OutputFile,$Limit,$Timeout){$script:seen.Add([pscustomobject]@{kind='wsl';value=$Arguments});return ''}
   function Get-ScheduledTask {param($TaskName,$TaskPath,$ErrorAction);return $null}
   function Import-CLMInstaller($Path){New-Module -ArgumentList $Path -ScriptBlock {param($p);. $p;$script:WslExe=Join-Path $env:WINDIR 'System32/wsl.exe';function Get-CastlinkKeepaliveProcess($s){return $null};function Get-CastlinkProcessEvidence($p){return $null};Export-ModuleMember -Function *}}
   Export-ModuleMember -Function *
  }
  $ctx=@{sourceRoot=$f.root;selectedRoot=$f.root;recovery=$false}
  $source=& $fixtureModule {param($c);Invoke-CLMDefaultAdapter VerifySource $c $null} $ctx;$ctx.source=$source
  Assert ($source.phase -ceq 'imported') 'incomplete source refused';Assert (-not (Test-Path (Join-Path $f.root 'release/manifest.json'))) 'verification altered source layout';Assert (Test-Path $ctx.sourceInstaller) 'no verified adoption installer'
  $task=& $fixtureModule {param($c);Invoke-CLMDefaultAdapter SourceTask $c $null} $ctx;Assert (-not $task.exists) 'invented task'
  & $fixtureModule {param($c);Invoke-CLMDefaultAdapter StopSource $c $null;Invoke-CLMDefaultAdapter AssertSourceStopped $c $null} $ctx
  Assert ((Read-CLMJson (Join-Path $f.root 'installation.json')).phase -ceq 'maintenance') 'legacy helper revived source receipt'
  $seen=& $fixtureModule {$script:seen.ToArray()};$proof=@($seen|Where-Object {$_.kind -ceq 'wsl' -and $_.value -contains '-c'}|Select-Object -Last 1)[0].value[-1]
  Assert ($proof.Contains("'MainPID'") -and $proof.Contains("'ControlPID'") -and $proof.Contains('cgroup.events') -and $proof.Contains('cgroup.procs') -and $proof.Contains("('inactive','failed')") -and $proof.Contains('postmaster.pid')) 'incomplete stopped proof lost kernel/process evidence'
  [IO.File]::WriteAllText((Join-Path $f.root 'install-server-windows.ps1'),'tampered');Throws {& $fixtureModule {param($c);Invoke-CLMDefaultAdapter VerifySource $c $null} $ctx} 'checksum'
  Remove-Module $fixtureModule
 }
 Test 'default target validation rejects source contract and corrupt inventories before mutation' {
  $dir=Join-Path $testRoot 'target-contract';[void][IO.Directory]::CreateDirectory($dir);$entries=@()
  foreach($n in @('rootfs.tar.gz','sources.tar.gz','upstream.tar.gz','packages.tsv','server-wsl-maintenance.ps1','server-wsl-maintenance-ui.ps1','server-wsl-maintenance.py','server-wsl-runtime.py','install-server-windows.template.ps1')){[IO.File]::WriteAllText((Join-Path $dir $n),('fixture '+$n));$entries+=[pscustomobject]@{file=$n;size=(Get-Item (Join-Path $dir $n)).Length;sha256=(Get-CLMHash (Join-Path $dir $n))}}
  $m=[pscustomobject]@{schemaVersion=1;channel='server-wsl';repository='resokol/castlink';architecture='amd64';sourceCommit=('c'*40);version='1.0.6';releaseTag='server-wsl-v1.0.6-cccccccccccc';rootfs=$entries[0];sources=$entries[1];upstreamSources=$entries[2];inventory=$entries[3];nativePanel=[pscustomobject]@{files=@()};lifecycle=[pscustomobject]@{schemaVersion=1;runtimeContract='castlink-wsl-pg16-v1';postgresMajor=16;supportedSources=@($script:CLMLegacyTag);helpers=@($entries[4..8])}}
  $m.rootfs|Add-Member NoteProperty expandedBytes 1048576;Write-CLMJson (Join-Path $dir 'manifest.json') $m;$pin=Get-CLMHash (Join-Path $dir 'manifest.json');$v=Assert-CLMTarget $dir $pin $script:CLMLegacyTag;Assert ($v.version -ceq '1.0.6') 'valid target refused'
  Throws {Assert-CLMTarget $dir ('0'*64) $script:CLMLegacyTag} 'checksum';Throws {Assert-CLMTarget $dir $pin 'server-wsl-v1.0.0'} 'compatibility'
  [IO.File]::AppendAllText((Join-Path $dir 'server-wsl-runtime.py'),'tampered');Throws {Assert-CLMTarget $dir $pin $script:CLMLegacyTag} 'checksum|size'
 }
 Test 'native panel scheduler and controls suspend under maintenance lease' {
  . (Join-Path (Split-Path $PSScriptRoot -Parent) 'server-native-control.ps1') -FunctionsOnly
  $s=[pscustomobject]@{maintenance=$true;control=$null;monitor=$null;export=$null;pendingControl='';pendingExport='';closing=$false;next=[datetime]::UtcNow.AddSeconds(-1);notice=''}
  Assert ((Get-CastlinkNativePanelScheduledWork $s) -ceq '') 'maintenance polling';Request-CastlinkNativePanelControl $s Start;Assert (-not $s.pendingControl) 'maintenance control queued'
 }
 Test 'native binding compiler stages a recoverable exact root and refuses unknown hosts' {
  $base=Join-Path $testRoot 'native-bindings';$cache=Join-Path $base 'cache';$root=Join-Path $base 'installed';$journalDir=Join-Path $base 'transaction';foreach($p in @($base,$cache,$root,$journalDir)){[void][IO.Directory]::CreateDirectory($p)}
  $scripts=Split-Path $PSScriptRoot -Parent;$inventory=Read-CLMJson (Join-Path $scripts 'server-native-panel-files.json');$entries=@()
  foreach($n in @('server-native-panel-files.json')+@($inventory.files)+@($inventory.buildFiles)){[IO.File]::Copy((Join-Path $scripts $n),(Join-Path $cache $n),$false);$entries+=[pscustomobject]@{file=$n;sha256=(Get-CLMHash (Join-Path $cache $n));size=(Get-Item (Join-Path $cache $n)).Length}}
  [IO.File]::Copy((Join-Path $scripts 'install-server-windows.ps1'),(Join-Path $cache 'install-server-windows.template.ps1'),$false)
  $manifest=[pscustomobject]@{releaseTag='server-wsl-v1.0.6-cccccccccccc';repository='resokol/castlink';rootfs=[pscustomobject]@{sha256=('c'*64)};nativePanel=[pscustomobject]@{schemaVersion=1;host='CastLinkServer.exe';binding='server-native-binding.json';files=$entries}}
  Write-CLMJson (Join-Path $cache 'manifest.json') $manifest;$pin=Get-CLMHash (Join-Path $cache 'manifest.json');$installer=Stage-CLMInstaller $cache $manifest $pin;$m=Import-CLMInstaller $installer
  $s=[pscustomobject]@{schemaVersion=1;installationId=('d'*32);distroName=('CastLink-Server-'+('d'*12));rootPath=$root;repository='resokol/castlink';releaseTag=$manifest.releaseTag;rootfsSha256=('c'*64);phase='imported'};Write-CLMJson (Join-Path $root 'installation.json') $s
  $ctx=@{directory=$journalDir;journal=(Join-Path $journalDir 'journal.json');id=('a'*32);kind='update';phase='prepare-bindings';adapter=$null;progress=$null};$status=[pscustomobject]@{ready=$true;buildId='1.0.6-cccccccccccc';origin='https://fixture.invalid'}
  $r=Set-CLMNativeBindings $ctx $s $status $cache $installer $pin $m;$binding=Read-CLMJson $r.nativePanel.bindingPath;Assert ($binding.installRoot -ceq $root -and $binding.installationId -ceq $s.installationId) 'binding root/identity';Assert ($binding.expectedInstallerSha256 -ceq (Get-CLMHash (Join-Path $root 'install-server-windows.ps1'))) 'installer pin';Assert (Test-Path $ctx.nativeHostStage) 'compiled stage missing'
  $s.PSObject.Properties.Remove('nativePanel');Write-CLMJson (Join-Path $root 'installation.json') $s;$r=Set-CLMNativeBindings $ctx $s $status $cache $installer $pin $m;Assert ($r.nativePanel.hostSha256 -ceq $ctx.nativeHostHash) 'ambiguous binding recovery failed'
  $s.PSObject.Properties.Remove('nativePanel');Write-CLMJson (Join-Path $root 'installation.json') $s;[IO.File]::AppendAllText((Join-Path $root 'native-panel/CastLinkServer.exe'),'unknown');Throws {Set-CLMNativeBindings $ctx $s $status $cache $installer $pin $m} 'differs|checksum'
 }
 Test 'installed and restored nonlegacy layouts remain maintainable without full release archives' {
  $savedLocal=$env:LOCALAPPDATA;$env:LOCALAPPDATA=Join-Path $testRoot ('profile-'+[guid]::NewGuid().ToString('N'))
  try{
   $f=InstalledSourceFixture $env:LOCALAPPDATA $false
   $check=& $f.module {param($f);Invoke-CastlinkMaintenance Check $f.root -TargetDirectory $f.target -ExpectedManifestSha256 $f.targetPin} $f
   Assert ($check.source.releaseTag -ceq $f.state.releaseTag) 'installed Check source';Assert (-not (Test-Path (Join-Path $f.root 'release/sources.tar.gz'))) 'fixture has full source archive'
   $bundle=Join-Path $testRoot ('modern-bundle-'+[guid]::NewGuid().ToString('N'));$removed=& $f.module {param($f,$bundle);Invoke-CastlinkMaintenance Remove $f.root -Confirmation $f.state.distroName -BundleDirectory $bundle} $f $bundle
   Assert ($removed.phase -ceq 'removed') 'installed Remove failed'
   $recovery=@{sourceRoot=$f.root;recovery=$true};$verified=& $f.module {param($c);Invoke-CLMDefaultAdapter VerifySource $c $null} $recovery
   Assert ($verified.installationId -ceq $f.state.installationId -and (Test-Path $recovery.sourceProvenance)) 'cleanup lost source provenance'
   Assert (-not (Test-Path (Join-Path $f.root 'release/manifest.json'))) 'owned manifest was not actually cleaned'
   $destination=Join-Path $env:LOCALAPPDATA 'CastLinkServer/restored';$restored=& $f.module {param($destination,$bundle);Invoke-CastlinkMaintenance Restore $destination -BundleDirectory $bundle} $destination $bundle
   Assert ($restored.phase -ceq 'restored') 'restore failed';Assert (-not (Test-Path (Join-Path $destination 'release/rootfs.tar.gz'))) 'restored fixture has rootfs package'
   $check=& $f.module {param($root,$f);Invoke-CastlinkMaintenance Check $root -TargetDirectory $f.target -ExpectedManifestSha256 $f.targetPin} $destination $f
   Assert ($check.source.rootPath -ceq $destination) 'restored Check failed';$removed=& $f.module {param($root,$name);Invoke-CastlinkMaintenance Remove $root -Confirmation $name -EraseData} $destination $f.state.distroName;Assert ($removed.phase -ceq 'removed') 'restored Remove failed'
  }finally{$env:LOCALAPPDATA=$savedLocal}
 }
 Test 'incomplete nonlegacy sources archive and restore using independent release pins' {
  $savedLocal=$env:LOCALAPPDATA;$profile=Join-Path $testRoot ('incomplete-profile-'+[guid]::NewGuid().ToString('N'))
  try{foreach($mode in @('catalog','supplied')){
   $env:LOCALAPPDATA=Join-Path $profile $mode;$f=InstalledSourceFixture $env:LOCALAPPDATA $true;Assert (-not $f.state.nativePanel -and -not (Test-Path (Join-Path $f.root 'install-server-windows.ps1'))) 'fixture is already bound';$bundle=Join-Path $env:LOCALAPPDATA 'archive'
   $r=& $f.module {param($f,$mode,$bundle);$p=@{};if($mode -ceq 'supplied'){$p.TargetDirectory=$f.public;$p.ExpectedManifestSha256=$f.world.pin};Invoke-CastlinkMaintenance Remove $f.root -Confirmation $f.state.distroName -BundleDirectory $bundle @p} $f $mode $bundle;Assert ($r.phase -ceq 'removed') 'incomplete source removal'
   $destination=Join-Path $env:LOCALAPPDATA 'CastLinkServer/restored-incomplete';$r=& $f.module {param($root,$bundle);Invoke-CastlinkMaintenance Restore $root -BundleDirectory $bundle} $destination $bundle;Assert ($r.phase -ceq 'restored' -and $r.source.phase -ceq 'imported' -and -not $r.source.nativePanel) 'incomplete restoration invented readiness'
   $r=& $f.module {param($root,$name);Invoke-CastlinkMaintenance Remove $root -Confirmation $name -EraseData} $destination $f.state.distroName;Assert ($r.phase -ceq 'removed') 'restored incomplete source not maintainable';Assert ($f.world.catalogCalls -eq $(if($mode -ceq 'catalog'){1}else{0})) 'wrong exact release trust lookup'
  }}finally{$env:LOCALAPPDATA=$savedLocal}
 }
 Test 'mutable incomplete source metadata is never its own trust anchor' {
  $savedLocal=$env:LOCALAPPDATA;$env:LOCALAPPDATA=Join-Path $testRoot ('untrusted-profile-'+[guid]::NewGuid().ToString('N'))
  try{$f=InstalledSourceFixture $env:LOCALAPPDATA $true;[IO.File]::AppendAllText((Join-Path $f.root 'release/manifest.json'),' ');Throws {& $f.module {param($f);Invoke-CastlinkMaintenance Remove $f.root -Confirmation $f.state.distroName -EraseData} $f} 'checksum|pin';Assert ($f.world.imports -eq 0) 'unverified installer was imported';Assert ($f.world.registered) 'untrusted source was removed'}finally{$env:LOCALAPPDATA=$savedLocal}
 }
 Test 'recovery holds the real candidate lease before rollback or postcommit effects' {
  foreach($boundary in @('CandidateReady','GateOpen')){
   $f=Fixture;$f.world.fail=$boundary;Throws {Invoke-CastlinkMaintenance Update $f.root -TargetDirectory $testRoot -ExpectedManifestSha256 ('f'*64) -Confirmation $f.world.source.distroName -Adapter $f.adapter} 'Injected';$f.world.fail='';$j=Get-CLMJournal $f.root
   if(-not (Test-Path $j.candidateRoot)){[void][IO.Directory]::CreateDirectory($j.candidateRoot);Write-CLMJson (Join-Path $j.candidateRoot 'installation.json') $j.candidate}
   $lease=[IO.File]::Open((Join-Path $j.candidateRoot 'operation.lock'),'OpenOrCreate','ReadWrite','None');$before=$f.world.events.Count
   try{Throws {Invoke-CastlinkMaintenance Recover $f.root -Adapter $f.adapter} 'candidate.*lock|candidate.*lease';$after=@($f.world.events|Select-Object -Skip $before);Assert (-not ($after|Where-Object {$_ -in @('StopCandidate','GateClose','ReleaseStoppedFirewall','TerminateCandidate','DiscardCandidate','PublishEntryPoint','PublishCandidateTask','GateOpen','CleanupSource')})) 'candidate effects ran while its lease was held'}finally{$lease.Dispose()}
   $r=Invoke-CastlinkMaintenance Recover $f.root -Adapter $f.adapter;Assert ($r.phase -ceq $(if($boundary -ceq 'GateOpen'){'completed'}else{'rolled-back'})) 'recovery did not resume after lease release'
  }
 }
 Test 'candidate recovery refuses a mismatched existing host receipt before guest effects' {
  $f=Fixture;$f.world.fail='CandidateReady';Throws {Invoke-CastlinkMaintenance Update $f.root -TargetDirectory $testRoot -ExpectedManifestSha256 ('f'*64) -Confirmation $f.world.source.distroName -Adapter $f.adapter} 'Injected';$f.world.fail='';$j=Get-CLMJournal $f.root;$foreign=Read-CLMReceipt $j.candidateRoot;$foreign.installationId='f'*32;$foreign.distroName='CastLink-Server-'+('f'*12);Write-CLMJson (Join-Path $j.candidateRoot 'installation.json') $foreign;$before=$f.world.events.Count
  Throws {Invoke-CastlinkMaintenance Recover $f.root -Adapter $f.adapter} 'Candidate host identity';$after=@($f.world.events|Select-Object -Skip $before);Assert (-not ($after|Where-Object {$_ -in @('CandidateOwned','StopCandidate','GateClose','GateOpen','CleanupSource')})) 'foreign candidate was operated on'
 }
 Test 'successful native Start completion clears stopped timestamp without reporting failure' {
  $source=[IO.File]::ReadAllText((Join-Path (Split-Path $PSScriptRoot -Parent) 'server-native-control.ps1'));$match=[regex]::Match($source,"elseif\(\`$job\.mode -ceq 'Start'\)\{([^}]+)\}");Assert $match.Success 'Start completion branch absent';$state=[pscustomobject]@{lastStoppedAt=123;maintenance=$true;notice=''}
  try{& ([scriptblock]::Create($match.Groups[1].Value))}catch{$state.notice='failure'};Assert ($null -eq $state.lastStoppedAt -and -not $state.notice) 'successful Start reported failure';Assert $state.maintenance 'Start completion overwrote authoritative maintenance state'
 }
 Write-Output ('Fixtures passed: '+$script:passes)
} finally {Remove-Item -LiteralPath $testRoot -Recurse -Force}
