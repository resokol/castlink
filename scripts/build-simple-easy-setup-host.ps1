param([string]$Output)
$ErrorActionPreference='Stop'
if(-not $Output){throw 'Output required'}
$compiler=Join-Path ([Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory()) 'csc.exe'
if(-not(Test-Path $compiler)){throw 'Windows .NET Framework compiler unavailable'}
$null=New-Item -ItemType Directory (Split-Path $Output -Parent) -Force
& $compiler /nologo /codepage:65001 /target:winexe /platform:anycpu /reference:System.Windows.Forms.dll ('/out:'+$Output) (Join-Path $PSScriptRoot 'easy-setup-launcher.cs')
if($LASTEXITCODE -ne 0 -or -not(Test-Path $Output)){throw 'EasySetup.exe compilation failed'}
