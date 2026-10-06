param([Parameter(Mandatory=$true)][string]$Output,[Parameter(Mandatory=$true)][string]$Include)
$ErrorActionPreference='Stop'
if($env:OS -ne 'Windows_NT' -or $env:PROCESSOR_ARCHITECTURE -ne 'AMD64'){throw 'Windows x64 build runner required'}
# Build-host discovery only. No installer/runtime/compiler discovery in castlink.exe.
$vswhere='C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe'
$installation=(& $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath)
if($LASTEXITCODE -ne 0 -or -not $installation){throw 'MSVC installation unavailable'}
$version=(Get-Content -LiteralPath (Join-Path $installation 'VC\Auxiliary\Build\Microsoft.VCToolsVersion.default.txt') -Raw).Trim()
if($version -cnotmatch '^14\.\d+\.\d+$'){throw 'Invalid observed MSVC version'}
$vc=Join-Path $installation ('VC\Tools\MSVC\'+$version)
$bin=Join-Path $vc 'bin\Hostx64\x64'
$cl=Join-Path $bin 'cl.exe';$link=Join-Path $bin 'link.exe';$dumpbin=Join-Path $bin 'dumpbin.exe'
$sdkRoot='C:\Program Files (x86)\Windows Kits\10'
$sdkVersion=(Get-ChildItem -LiteralPath (Join-Path $sdkRoot 'Include') -Directory|Where-Object {$_.Name -cmatch '^10\.0\.\d+\.0$' -and (Test-Path -LiteralPath (Join-Path $_.FullName 'um\Windows.h'))}|Sort-Object {[version]$_.Name} -Descending|Select-Object -First 1).Name
if(-not $sdkVersion){throw 'Windows SDK unavailable'}
$includes=@((Join-Path $vc 'include'),(Join-Path $sdkRoot "Include\$sdkVersion\ucrt"),(Join-Path $sdkRoot "Include\$sdkVersion\shared"),(Join-Path $sdkRoot "Include\$sdkVersion\um"))
$kernel=Join-Path $sdkRoot "Lib\$sdkVersion\um\x64\kernel32.lib";$advapi=Join-Path $sdkRoot "Lib\$sdkVersion\um\x64\advapi32.lib"
New-Item -ItemType Directory -Path $Output -ErrorAction Stop|Out-Null
$native=Join-Path $PSScriptRoot '..\native\primary-launcher'
$objects=@()
foreach($name in @('core','protocol','docker','windows','broker','security')){
 $object=Join-Path $Output "$name.obj";$dependencies=Join-Path $Output "$name-dependencies.json"
 $args=@('/nologo','/c','/std:c11','/GS-','/Zl','/Oi-','/Od','/W4','/WX','/DUNICODE','/D_UNICODE','/D_WIN32_WINNT=0x0602',"/I$native","/I$Include","/Fo$object",'/sourceDependencies',$dependencies)
 foreach($dir in $includes){$args+="/I$dir"}
 $args+=Join-Path $native "$name.c"
 & $cl @args
 if($LASTEXITCODE -ne 0){throw 'Native compile failed'}
 $objects+=$object
}
$exe=Join-Path $Output 'castlink.exe'
& $link /nologo /NODEFAULTLIB /ENTRY:castlink_entry /SUBSYSTEM:CONSOLE /MACHINE:X64 /DYNAMICBASE /HIGHENTROPYVA /NXCOMPAT /MANIFEST:NO /DEBUG:NONE "/OUT:$exe" @objects $kernel $advapi
if($LASTEXITCODE -ne 0){throw 'Native link failed'}
& $dumpbin /IMPORTS $exe|Set-Content -LiteralPath (Join-Path $Output 'imports.txt') -Encoding utf8
if($LASTEXITCODE -ne 0){throw 'Import receipt failed'}
function FileReceipt([string]$p){
 $item=Get-Item -LiteralPath $p;if($item.PSIsContainer -or ($item.Attributes-band [IO.FileAttributes]::ReparsePoint)-ne 0){throw 'Invalid toolchain file'}
 # Build receipt hashing must not depend on inherited PowerShell module paths.
 $hash=[Security.Cryptography.SHA256]::Create();$stream=$null
 try{$stream=[IO.File]::Open($item.FullName,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$digest=[BitConverter]::ToString($hash.ComputeHash($stream)).Replace('-','').ToLowerInvariant()}
 finally{if($null-ne $stream){$stream.Dispose()};$hash.Dispose()}
 return @{path=$item.FullName;bytes=$item.Length;sha256=$digest}
}
$headerNames=@();foreach($name in @('core','protocol','docker','windows','broker','security')){$d=Get-Content -LiteralPath (Join-Path $Output "$name-dependencies.json") -Raw|ConvertFrom-Json;$headerNames+=@($d.Data.Includes)}
$headers=@($headerNames|Sort-Object -Unique|ForEach-Object {FileReceipt $_})
$compilerDlls=@(Get-ChildItem -LiteralPath $bin -Filter '*.dll' -File|ForEach-Object {FileReceipt $_.FullName})
$receipt=@{schemaVersion=1;target='win32-x64';mode='compile-only-private';nativeExecution='not-run';toolchainAdmission='observed-not-publisher-admitted';msvcVersion=$version;sdkVersion=$sdkVersion;compiler=(FileReceipt $cl);linker=(FileReceipt $link);dumpbin=(FileReceipt $dumpbin);discovery=(FileReceipt $vswhere);libraries=@((FileReceipt $kernel),(FileReceipt $advapi));headers=$headers;compilerDlls=$compilerDlls;artifact=(FileReceipt $exe)}
$receipt|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $Output 'BUILD-RECEIPT.json') -Encoding utf8
