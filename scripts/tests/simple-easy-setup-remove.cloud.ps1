param([string]$HelperPath)
$ErrorActionPreference='Stop'
. $HelperPath
$folder=Join-Path ([IO.Path]::GetTempPath()) ('castlink-remove-cloud-'+[Guid]::NewGuid())
$null=New-Item -ItemType Directory -Path $folder
$script:SshSession=$null;$script:ServerFolder=$folder
function Invoke-DeploymentDocker([string[]]$Arguments,[string]$InputText='',[int]$TimeoutSeconds=900) {
  $r=Invoke-SimpleProcess '/usr/local/bin/docker' $Arguments $InputText $TimeoutSeconds
  if ($r.code -ne 0) { throw ('Disposable Docker: '+$r.stderr) };return $r.stdout
}
$release=[pscustomobject]@{images=[pscustomobject]@{web='debian:trixie-slim';postgres='debian:trixie-slim';livekit='debian:trixie-slim';caddy='debian:trixie-slim'}}
$state=New-SimpleConfiguration $folder '127.0.0.1' $false $release
Write-SimpleConfiguration $folder $state $release '127.0.0.1'
$project='castlink-easy-'+$state.installationId.Replace('-','')
$compose=Get-Content (Join-Path $folder 'compose.json') -Raw | ConvertFrom-Json
foreach ($property in $compose.services.PSObject.Properties) { $compose.services.($property.Name)=[pscustomobject]@{image='debian:trixie-slim';command=@('sleep','600')} }
$compose.services.web | Add-Member -NotePropertyName volumes -NotePropertyValue @('web-data:/data','postgres-data:/pg','caddy-data:/ca','caddy-config:/cfg')
Write-SimpleText (Join-Path $folder 'compose.json') ($compose | ConvertTo-Json -Depth 15)
$previousProject=$env:COMPOSE_PROJECT_NAME;$env:COMPOSE_PROJECT_NAME='unrelated-ambient-project'
try {
  $null=Invoke-DeploymentCompose @('up','-d','--pull','never') '' 90 $project
  $null=Invoke-DeploymentCompose @('exec','-T','web','sh','-c','echo preserved > /data/sentinel') '' 15 $project
  $null=Remove-SimpleDeployment $folder $state -Confirmed
  foreach ($name in @('web-data','postgres-data','caddy-data','caddy-config')) { $null=Invoke-DeploymentDocker @('volume','inspect',($project+'_'+$name)) }
  $null=Invoke-DeploymentCompose @('up','-d','--pull','never') '' 90 $project
  $marker=Invoke-DeploymentCompose @('exec','-T','web','cat','/data/sentinel') '' 15 $project
  if ($marker.Trim() -ne 'preserved') { throw 'Retained volume did not survive reinstallation' }
  Write-SimpleText (Join-Path $folder 'not-castlink.txt') 'keep me'
  $holder=$project+'-test-holder'
  $null=Invoke-DeploymentDocker @('run','-d','--name',$holder,'-v',($project+'_web-data:/data'),'debian:trixie-slim','sleep','600')
  $refused=$false;try { Remove-SimpleDeployment $folder $state -Confirmed -DeleteData } catch { if ($_.Exception.Message -notmatch 'Не все тома') { throw };$refused=$true }
  if (-not $refused -or -not (Test-Path (Join-Path $folder '.castlink-install.json')) -or -not (Test-Path (Join-Path $folder 'web.env'))) { throw 'In-use volume warning was mistaken for completed purge' }
  $null=Invoke-DeploymentDocker @('rm','-f',$holder)
  $null=Remove-SimpleDeployment $folder $state -Confirmed -DeleteData
  $remaining=Invoke-DeploymentDocker @('volume','ls','-q','--filter',('label=com.docker.compose.project='+$project))
  if ($remaining.Trim() -or -not (Test-Path (Join-Path $folder 'not-castlink.txt'))) { throw 'Purge resource/file boundary failed' }
  Write-Output 'SIMPLE_REMOVE_CLOUD_PASS real Compose keep-reinstall-sentinel purge ambient-project-isolation'
} finally {
  $env:COMPOSE_PROJECT_NAME=$previousProject
  # Cleanup ONLY this disposable test project, including on a test failure.
  if ($holder) { $r=Invoke-SimpleProcess '/usr/local/bin/docker' @('rm','-f',$holder) '' 15 }
  if (Test-Path (Join-Path $folder 'compose.json')) { $null=Invoke-DeploymentDocker @('compose','--project-name',$project,'--project-directory',$folder,'-f',(Join-Path $folder 'compose.json'),'down','--volumes','--remove-orphans') }
  Remove-Item -LiteralPath $folder -Recurse -Force
}
