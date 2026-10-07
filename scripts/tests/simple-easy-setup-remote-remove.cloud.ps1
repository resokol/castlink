param([string]$HelperPath)
$ErrorActionPreference='Stop'
. $HelperPath
$root=Join-Path $env:TEMP ('castlink-remote-cloud-'+[Guid]::NewGuid())
$null=New-Item -ItemType Directory -Path $root
$release=[pscustomobject]@{images=[pscustomobject]@{web='debian:trixie-slim';postgres='debian:trixie-slim';livekit='debian:trixie-slim';caddy='debian:trixie-slim'}}
$bootstrap=Join-Path $root 'bootstrap';$null=New-Item -ItemType Directory $bootstrap
$state=New-SimpleConfiguration $bootstrap 'meet.example.com' $true $release
$project='castlink-easy-'+$state.installationId.Replace('-','')
$folder=Join-Path $root $project;$null=New-Item -ItemType Directory $folder
Write-SimpleConfiguration $folder $state $release '203.0.113.20'
$compose=Get-Content (Join-Path $folder 'compose.json') -Raw|ConvertFrom-Json
foreach($service in $compose.services.PSObject.Properties){$compose.services.($service.Name)=[pscustomobject]@{image='debian:trixie-slim';command=@('sleep','600')}}
$compose.services.web|Add-Member -NotePropertyName volumes -NotePropertyValue @('web-data:/data','postgres-data:/pg','caddy-data:/ca','caddy-config:/cfg')
Write-SimpleText (Join-Path $folder 'compose.json') ($compose|ConvertTo-Json -Depth 15)
$remoteFolder='/opt/'+$project;$script:cloudRemoteFolder=$remoteFolder;$script:cloudLocalFolder=$folder;$script:SshSession='disposable-SSH-adapter';$script:ServerFolder=$remoteFolder
function ConvertTo-SimplePosixLiteral([string]$Value){return "'"+$Value.Replace("'","'\''")+"'"}
function Invoke-DeploymentDocker([string[]]$Arguments,[string]$InputText='',[int]$TimeoutSeconds=900){
  $mapped=@($Arguments|ForEach-Object{if($_.StartsWith($script:cloudRemoteFolder)){$_=$script:cloudLocalFolder+$_.Substring($script:cloudRemoteFolder.Length)};$_})
  $r=Invoke-SimpleProcess '/usr/local/bin/docker' $mapped $InputText $TimeoutSeconds
  if($r.code -ne 0){throw ('Disposable Docker: '+$r.stderr)}
  # SSH endpoint's filesystem is mapped to the disposable local directory.
  return $r.stdout.Replace($script:cloudLocalFolder,$script:cloudRemoteFolder)
}
function Invoke-SimpleSshCommand([object]$Client,[string]$Command,[string]$Stdin=''){
  $mapped=$Command.Replace('/opt/castlink-easy-*',($root+'/castlink-easy-*')).Replace($script:cloudRemoteFolder,$script:cloudLocalFolder)
  $r=Invoke-SimpleProcess '/bin/sh' @('-c',$mapped) $Stdin 30
  return [pscustomobject]@{code=$r.code;stdout=$r.stdout.Replace($script:cloudLocalFolder,$script:cloudRemoteFolder);stderr=$r.stderr}
}
try{
  $null=Invoke-DeploymentCompose @('up','-d','--pull','never') '' 90 $project
  $null=Invoke-DeploymentCompose @('exec','-T','web','sh','-c','echo preserved > /data/sentinel') '' 15 $project
  $known=@(Get-SimpleRemoteInstallations|Where-Object{$_.project -ceq $project})
  if($known.Count -ne 1){throw 'Active remote installation not discovered'}
  $mirror=Join-Path $root 'mirror';$state=New-SimpleRemoteRemovalMirror $mirror $known[0] '203.0.113.20' 22
  $null=Remove-SimpleDeployment $mirror $state -Confirmed
  $ids=Invoke-DeploymentDocker @('ps','-aq','--filter',('label=com.docker.compose.project='+$project))
  if($ids.Trim()){throw 'Keep left containers'}
  $known=@(Get-SimpleRemoteInstallations|Where-Object{$_.project -ceq $project})
  if($known.Count -ne 1 -or -not $known[0].metadata.stopped){throw 'Retained configuration not rediscovered after keep'}
  # Existing configuration alone restores the same data; no secret export.
  $null=Invoke-DeploymentCompose @('up','-d','--pull','never') '' 90 $project
  if((Invoke-DeploymentCompose @('exec','-T','web','cat','/data/sentinel') '' 15 $project).Trim() -cne 'preserved'){throw 'Keep lost data'}
  Write-SimpleText (Join-Path $folder 'foreign-note.txt') 'preserve unrelated file'
  $state=New-SimpleRemoteRemovalMirror $mirror $known[0] '203.0.113.20' 22
  $null=Remove-SimpleDeployment $mirror $state -Confirmed -DeleteData
  $volumes=Invoke-DeploymentDocker @('volume','ls','-q','--filter',('label=com.docker.compose.project='+$project))
  if($volumes.Trim() -or (Test-Path (Join-Path $folder 'compose.json')) -or -not (Test-Path (Join-Path $folder 'foreign-note.txt'))){throw 'Remote purge scope/postcondition failed'}
  Write-Output 'SIMPLE_REMOTE_REMOVE_CLOUD_PASS real-compose active-discovery keep retained-discovery restore-sentinel purge foreign-file'
}finally{
  if(Test-Path (Join-Path $folder 'compose.json')){$null=Invoke-DeploymentCompose @('down','--volumes','--remove-orphans') '' 90 $project}
  Remove-Item -LiteralPath $root -Recurse -Force
}
