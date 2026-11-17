param([Parameter(Mandatory=$true)][string]$Output)
$ErrorActionPreference='Stop'
$compiler=Join-Path ([Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()) 'csc.exe'
if(-not(Test-Path -LiteralPath $compiler)){throw 'Windows .NET Framework compiler unavailable'}
$Output=[IO.Path]::GetFullPath($Output)
$null=[IO.Directory]::CreateDirectory((Split-Path $Output -Parent))
& $compiler /nologo /codepage:65001 /target:winexe /platform:anycpu /reference:System.Windows.Forms.dll ('/win32icon:'+(Join-Path $PSScriptRoot 'simple-easy-setup-control.ico')) ('/out:'+$Output) (Join-Path $PSScriptRoot 'server-native-panel-host.cs')
if($LASTEXITCODE -ne 0 -or -not(Test-Path -LiteralPath $Output)){throw 'CastLink native panel compilation failed'}
