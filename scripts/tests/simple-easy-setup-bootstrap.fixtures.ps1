param([string]$EntryPath,[string]$DeployPath)
$ErrorActionPreference='Stop'
. $DeployPath
$folder=Join-Path $env:TEMP ('castlink-bootstrap-fixture-'+[Guid]::NewGuid().ToString())
$null=New-Item -ItemType Directory -Path (Join-Path $folder 'scripts') -Force
try {
  Write-SimpleText (Join-Path $folder 'scripts\windows-simple-easy-setup.ps1') 'param($Action,$Target,$InstallFolder,$UseDownloadedPayload,$SkipCertificateTrust) exit 7'
  $caller=Join-Path $folder 'caller.ps1'
  Write-SimpleText $caller @'
param($Entry,$Folder)
. $Entry -FunctionsOnly -Action install -Target local -InstallFolder $Folder
function Get-SimpleCurrentRelease($Folder) { return [pscustomobject]@{folder=$Folder} }
Start-SimpleSetup
'@
  $exe=Join-Path $PSHOME 'powershell.exe'
  if (-not (Test-Path $exe)) { $exe=Join-Path $PSHOME 'pwsh' }
  $result=Invoke-SimpleProcess $exe @('-NoProfile','-NonInteractive','-File',$caller,'-Entry',$EntryPath,'-Folder',$folder) '' 20
  if ($result.code -ne 7) { throw ('Nested failure exit7 was swallowed: '+$result.code) }
  Write-Output 'BOOTSTRAP_FAILURE_EXIT_PROPAGATED'
} finally { Remove-Item $folder -Recurse -Force }
