param([Parameter(Mandatory=$true)][string]$InputDirectory,[Parameter(Mandatory=$true)][string]$OutputDirectory)
$ErrorActionPreference='Stop'
# Build host only: observed .NET Framework compiler, never distributed/executed by CLI.
$framework=[Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory().TrimEnd('\')
$expected=[IO.Path]::Combine([Environment]::GetFolderPath('Windows'),'Microsoft.NET\Framework64\v4.0.30319')
if($framework -ine $expected -or ![Environment]::Is64BitProcess){throw 'Managed build framework unavailable'}
$compiler=[IO.Path]::Combine($framework,'csc.exe')
$references=@('mscorlib.dll','System.dll','System.Core.dll','System.Web.Extensions.dll')|ForEach-Object {[IO.Path]::Combine($framework,$_)}
$source=@('bridge','setup','backup')|ForEach-Object {[IO.Path]::Combine($InputDirectory,$_.ToString()+'.cs')}
$out=[IO.Path]::Combine($OutputDirectory,'CastLink.Native.Workers.dll')
if([IO.File]::Exists($out)){throw 'Managed build output exists'}
$args=@('/nologo','/noconfig','/nostdlib+','/target:library','/platform:x64','/optimize+','/warn:4','/warnaserror+',('/out:'+$out))
foreach($r in $references){$args+=('/reference:'+$r)}
& $compiler @args @source
if($LASTEXITCODE -ne 0){throw 'Managed compile failed'}
$bytes=[IO.File]::ReadAllBytes($out);if($bytes.Length -lt 1 -or $bytes.Length -gt 1048576){throw 'Managed size refused'}
$loadedReferences=@();foreach($r in $references){$loadedReferences+=[Reflection.Assembly]::ReflectionOnlyLoad([IO.File]::ReadAllBytes($r))}
$assembly=[Reflection.Assembly]::ReflectionOnlyLoad($bytes)
$allowed=@{mscorlib='b77a5c561934e089';System='b77a5c561934e089';'System.Core'='b77a5c561934e089';'System.Web.Extensions'='31bf3856ad364e35'}
$refs=@();foreach($r in $assembly.GetReferencedAssemblies()){$token=[BitConverter]::ToString($r.GetPublicKeyToken()).Replace('-','').ToLowerInvariant();if(!$allowed.ContainsKey($r.Name) -or $token -cne $allowed[$r.Name] -or $r.Version.ToString() -cne '4.0.0.0'){throw 'Managed reference refused'};$refs+=@{name=$r.Name;version=$r.Version.ToString();token=$token}}
$pinvoke=@();foreach($type in $assembly.GetTypes()){foreach($method in $type.GetMethods([Reflection.BindingFlags]'Public,NonPublic,Static,Instance,DeclaredOnly')){foreach($attribute in $method.GetCustomAttributesData()){if($attribute.AttributeType.FullName -ceq 'System.Runtime.InteropServices.DllImportAttribute'){$dll=[string]$attribute.ConstructorArguments[0].Value;if($dll -cne 'kernel32.dll' -and $dll -cne 'advapi32.dll'){throw 'Managed import refused'};$pinvoke+=@{type=$type.FullName;method=$method.Name;library=$dll}}}}}
foreach($name in @('CastLinkPrivate','CastLinkSetupDirectory','CastLinkBackupOutput')){if(!$assembly.GetType($name,$false,$false)){throw 'Managed type absent'}}
function Receipt([string]$path){$s=[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$h=[Security.Cryptography.SHA256]::Create();try{return @{path=$path;bytes=$s.Length;sha256=[BitConverter]::ToString($h.ComputeHash($s)).Replace('-','').ToLowerInvariant()}}finally{$s.Dispose();$h.Dispose()}}
@{schemaVersion=1;mode='build-only-observed-framework';nativeExecution='not-run';compiler=(Receipt $compiler);references=@($references|ForEach-Object {Receipt $_});sources=@($source|ForEach-Object {Receipt $_});artifact=(Receipt $out);metadataReferences=$refs;pinvoke=$pinvoke;osDependencyTrust='protected-OS-authority-not-exact-byte-snapshot'}|ConvertTo-Json -Depth 8|Set-Content -LiteralPath ([IO.Path]::Combine($OutputDirectory,'MANAGED-BUILD-RECEIPT.json')) -Encoding utf8
