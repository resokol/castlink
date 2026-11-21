param([Parameter(Mandatory=$true)][string]$ControlPath)
$ErrorActionPreference='Stop'
$tokens=$null;$errors=$null
$tree=[Management.Automation.Language.Parser]::ParseFile([IO.Path]::GetFullPath($ControlPath),[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'Controller parse failed'}
$function=$tree.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq 'Test-CastlinkNativeMaintenance'},$true)
if(-not $function){throw 'Native maintenance guard missing'}
# Exercise the real guard without importing unrelated UI/network dependencies.
Invoke-Expression $function.Extent.Text
$root=Join-Path $env:TEMP ('castlink-native-move-guard-'+[guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($root)
function Write-GuardJson([string]$Name,$Value){[IO.File]::WriteAllText((Join-Path $root $Name),($Value|ConvertTo-Json -Depth 8),[Text.UTF8Encoding]::new($false))}
function Assert-Guard([bool]$Value,[string]$Message){if(-not $Value){throw $Message}}
try{
 Write-GuardJson 'installation.json' @{phase='ready'}
 Assert-Guard (-not (Test-CastlinkNativeMaintenance $root)) 'Ready server unexpectedly blocked'
 $journal=Join-Path $root 'move-journal.json'
 Write-GuardJson 'move-journal.json' @{schemaVersion=1;kind='move';id='test-id';selectedRoot=$root;phase='move-prepared'}
 Write-GuardJson 'maintenance-transaction.json' @{schemaVersion=1;kind='move';id='test-id';selectedRoot=$root;journalSelectedRoot=$root;journal=$journal}
 Assert-Guard (Test-CastlinkNativeMaintenance $root) 'Pending move allowed native startup before quiesce'
 Write-GuardJson 'move-journal.json' @{schemaVersion=1;kind='move';id='test-id';selectedRoot=$root;destinationRoot=$root;phase='completed'}
 Assert-Guard (-not (Test-CastlinkNativeMaintenance $root)) 'Completed move destination stayed blocked'
 Write-GuardJson 'move-journal.json' @{schemaVersion=1;kind='move';id='other-id';selectedRoot=$root;phase='completed'}
 Assert-Guard (Test-CastlinkNativeMaintenance $root) 'Mismatched completed journal bypassed guard'
 [IO.File]::WriteAllText($journal,'broken')
 Assert-Guard (Test-CastlinkNativeMaintenance $root) 'Corrupt move journal bypassed guard'
 Remove-Item -LiteralPath (Join-Path $root 'maintenance-transaction.json')
 Write-GuardJson 'relocated-to.json' @{schemaVersion=1;destinationRoot='D:\Elsewhere'}
 Assert-Guard (Test-CastlinkNativeMaintenance $root) 'Relocated source allowed native startup'
 'Native move guard fixtures PASS'
}finally{Remove-Item -LiteralPath $root -Recurse -Force}
