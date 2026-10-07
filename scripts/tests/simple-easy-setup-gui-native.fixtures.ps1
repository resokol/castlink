param([string]$HostPath,[string]$SourceRoot,[string]$ProofFolder)
$ErrorActionPreference='Stop'
$null=New-Item -ItemType Directory (Join-Path $ProofFolder 'scripts') -Force
Copy-Item -LiteralPath $HostPath -Destination (Join-Path $ProofFolder 'EasySetup.exe')
foreach($name in @('simple-easy-setup-release.json','simple-easy-setup-runtime.ps1','simple-easy-setup-download.ps1','simple-easy-setup-gui.ps1','simple-easy-setup-window.xaml','simple-easy-setup-deploy.ps1','simple-easy-setup-cleanup.ps1','windows-simple-easy-setup.ps1')){Copy-Item -LiteralPath (Join-Path $SourceRoot $name) -Destination (Join-Path $ProofFolder ('scripts/'+$name))}
$source=@'
param($Result)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'windows-simple-easy-setup.ps1') -FunctionsOnly
. (Join-Path $PSScriptRoot 'simple-easy-setup-deploy.ps1')
Write-SimpleStage 'Fixture: no deployment' 1 5
$null=Read-Host 'Где установить CastLink? 1 — Локально; 2 — Внешний сервер'
$null=Read-Host 'Папка [fixture]'
Complete-SimpleInputPhase
Write-SimpleStage 'Fixture download: busy input must be hidden' 2 5
Start-Sleep -Milliseconds 250
$secret=Read-Host 'SSH пароль' -AsSecureString
$secure=$secret -is [Security.SecureString];$secret.Dispose()
Request-SimpleForeground
$child=Join-Path $PSScriptRoot 'stdin.ps1'
[IO.File]::WriteAllText($child,'$m=New-Object IO.MemoryStream;[Console]::OpenStandardInput().CopyTo($m);$b=$m.ToArray();[pscustomobject]@{count=$b.Length;canonical=([Text.Encoding]::UTF8.GetString($b) -ceq ''{"probe":1}'')}|ConvertTo-Json -Compress')
$before=[BitConverter]::ToString([Console]::InputEncoding.GetPreamble())
$ps=Join-Path $PSHOME 'powershell.exe'
$r=Invoke-SimpleProcess $ps @('-NoProfile','-File',$child) '{"probe":1}' 15
$bytes=$r.stdout|ConvertFrom-Json
if($r.code -ne 0 -or $bytes.count -ne 11 -or -not $bytes.canonical){throw 'Hidden GUI worker changed raw stdin bytes'}
if([BitConverter]::ToString([Console]::InputEncoding.GetPreamble()) -cne $before){throw 'GUI changed parent input encoding'}
[IO.File]::WriteAllText($Result,([pscustomobject]@{secureType=$secure;stdinBytes=$bytes.count;canonical=$bytes.canonical;parentEncodingRestored=$true}|ConvertTo-Json))
$kit=Join-Path $PSScriptRoot 'fake-kit';$null=New-Item -ItemType Directory $kit -Force
[IO.File]::WriteAllText((Join-Path $kit 'Trust-Certificate.ps1'),'param($Action) exit 7')
if(Install-SimpleLocalTrust $kit){throw 'Fixture denied trust unexpectedly succeeded'}
Write-Host 'Сервер готов, но доверие HTTPS не установлено. Подтверди сертификат.'
Write-Host 'CastLink установлен: https://127.0.0.1'
Write-SimpleStage 'Fixture finished' 5 5 -Completed
'@
[IO.File]::WriteAllText((Join-Path $ProofFolder 'scripts/simple-easy-setup-gui-smoke.ps1'),$source,(New-Object Text.UTF8Encoding($true)))
$result=Join-Path $ProofFolder 'native-result.json'
$launcher=Start-Process -FilePath (Join-Path $ProofFolder 'EasySetup.exe') -ArgumentList ('--smoke-result "'+$result+'"') -PassThru
$deadline=[DateTime]::UtcNow.AddSeconds(45)
while(-not(Test-Path ($result+'.ui.json')) -and [DateTime]::UtcNow -lt $deadline){Start-Sleep -Milliseconds 200}
if(-not(Test-Path ($result+'.ui.json'))){throw 'Native GUI render did not finish'}
$r=[IO.File]::ReadAllText($result)|ConvertFrom-Json;$ui=[IO.File]::ReadAllText($result+'.ui.json')|ConvertFrom-Json
if(-not $r.secureType -or -not $r.canonical -or $ui.exitCode -ne 0 -or -not $ui.passwordEmpty -or -not $ui.busyInputsHidden -or -not $ui.backUsed -or -not $ui.trustWarningVisible){throw 'Native GUI/worker acceptance failed'}
if(-not(Test-Path ($result+'.busy.png'))){throw 'Busy WPF state was not rendered'}
if(-not(Test-Path ($result+'.choices.png'))){throw 'Actual target choices were not rendered'}
if((Get-Item ($result+'.png')).Length -lt 2000 -or $ui.width -lt 500 -or $ui.height -lt 350){throw 'WPF did not produce a usable actual rendering'}
Write-Output 'SIMPLE_NATIVE_GUI_PASS WinExe WPF SecureString raw-stdin rendering'
