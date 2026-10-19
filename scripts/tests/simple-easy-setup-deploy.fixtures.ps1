param([string]$HelperPath)
$ErrorActionPreference='Stop'
. $HelperPath
$folder=Join-Path $env:TEMP ('castlink-simple-fixture-'+[Guid]::NewGuid().ToString())
$null=New-Item -ItemType Directory -Path $folder
try {
  $release=[pscustomobject]@{images=[pscustomobject]@{web=('sha256:'+('a'*64));postgres='postgres:test';livekit='livekit:test';caddy='caddy:test'}}
  $state=New-SimpleConfiguration $folder '192.168.1.22' $false $release
  $tokens=$null;$errors=$null
  $entryPath=Join-Path (Split-Path $HelperPath -Parent) 'windows-simple-easy-setup.ps1'
  $entryAst=[Management.Automation.Language.Parser]::ParseFile($entryPath,[ref]$tokens,[ref]$errors)
  if($errors.Count){throw 'Installer syntax failed'}
  $initialize=$entryAst.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq 'Initialize-SimpleRoomCreationPassword'},$true)
  if(-not $initialize){throw 'Owner-only room creation password setup missing'}
  . ([scriptblock]::Create($initialize.Extent.Text))
  $script:creationAnswers=New-Object 'Collections.Generic.Queue[string]'
  $script:creationPrompts=0;$script:creationLogs=New-Object 'Collections.Generic.List[string]'
  function Read-Host {param($Prompt,[switch]$AsSecureString);if(-not $AsSecureString){throw 'Creation password prompt must be secure'};$script:creationPrompts++;return(ConvertTo-SecureString $script:creationAnswers.Dequeue() -AsPlainText -Force)}
  function Write-Host {param($Object);$script:creationLogs.Add([string]$Object)}
  $chosen='Пароль $ # " \\'
  $script:creationAnswers.Enqueue($chosen);$script:creationAnswers.Enqueue($chosen)
  Initialize-SimpleRoomCreationPassword $folder $state
  $sha=[Security.Cryptography.SHA256]::Create();try{$expectedHash=([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($chosen)))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
  if($state.roomCreationPasswordHash -cne $expectedHash -or $script:creationPrompts -ne 2){throw 'Owner-entered password was not confirmed and hashed with UTF-8'}
  if(([IO.File]::ReadAllText((Join-Path $folder '.castlink-install.json'))).Contains($chosen) -or ($script:creationLogs -join '').Contains($chosen)){throw 'Creation password plaintext persisted or logged'}
  Initialize-SimpleRoomCreationPassword $folder $state
  if($script:creationPrompts -ne 2){throw 'Known creation credential prompted again or rotated during update'}
  $invalidFolder=Join-Path $folder 'invalid-creation';$null=New-Item -ItemType Directory $invalidFolder
  foreach($invalid in @('short',('x'*257),"valid`npassword","valid`rpassword",("valid"+[char]0+"password"))){
    $candidate=[pscustomobject]@{schemaVersion=1};$script:creationAnswers.Clear();$script:creationAnswers.Enqueue($invalid)
    $refused=$false;try{Initialize-SimpleRoomCreationPassword $invalidFolder $candidate}catch{$refused=$true}
    if(-not $refused -or $candidate.PSObject.Properties['roomCreationPasswordHash'] -or (Test-Path (Join-Path $invalidFolder '.castlink-install.json'))){throw 'Invalid password mutated installation state'}
  }
  $script:creationAnswers.Clear();$script:creationAnswers.Enqueue('first-password');$script:creationAnswers.Enqueue('other-password')
  $refused=$false;try{Initialize-SimpleRoomCreationPassword $invalidFolder ([pscustomobject]@{schemaVersion=1})}catch{$refused=$true}
  if(-not $refused -or (Test-Path (Join-Path $invalidFolder '.castlink-install.json'))){throw 'Unconfirmed password mutated installation state'}
  Write-SimpleConfiguration $folder $state $release '192.168.1.22'
  $compose=Get-Content (Join-Path $folder 'compose.json') -Raw | ConvertFrom-Json
  if ($compose.services.web.image -ne $release.images.web -or $compose.services.postgres.volumes[0] -ne 'postgres-data:/var/lib/postgresql/data' -or $compose.services.caddy.ports[0] -ne '443:443') { throw 'Compose layout mismatch' }
  if ($compose.services.postgres.healthcheck.test[1] -ne 'pg_isready -U castlink -d castlink') { throw 'Healthcheck interpolates missing host environment' }
  $lk=Get-Content (Join-Path $folder 'livekit.json') -Raw | ConvertFrom-Json
  if ($lk.rtc.node_ip -ne '192.168.1.22' -or $lk.rtc.use_external_ip) { throw 'LAN media mismatch' }
  if ($lk.rtc.udp_port -ne 7882 -or $lk.rtc.PSObject.Properties['port_range_start'] -or $lk.rtc.PSObject.Properties['port_range_end']) { throw 'RTC must multiplex on UDP7882 instead of publishing per-port proxies' }
  if (-not $lk.turn.enabled -or $lk.turn.udp_port -ne 3478 -or $lk.turn.tls_port -or $lk.turn.allow_restricted_peer_cidrs.Count -ne 1 -or $lk.turn.allow_restricted_peer_cidrs[0] -ne '192.168.1.22/32') { throw 'Authenticated LAN TURN baseline missing or private peer permissions too broad' }
  if ($lk.turn.relay_range_start -ne 30000 -or $lk.turn.relay_range_end -ne 30031) { throw 'TURN relay range must match the compact VPS configuration' }
  if (($compose.services.livekit.ports -join ',') -cne '7881:7881/tcp,7882:7882/udp,3478:3478/udp,30000-30031:30000-30031/udp') { throw 'Compact RTC/TURN listener mappings missing or stale mappings retained' }
  $environment=Get-Content (Join-Path $folder 'web.env') -Raw
  if($environment -notmatch ('(?m)^ROOM_CREATION_PASSWORD_SHA256='+$expectedHash+'\r?$') -or $environment.Contains($chosen)){throw 'Compose environment must contain only the creation password digest'}
  $beforeRecovery=$script:creationPrompts;$recovered=$state|ConvertTo-Json -Depth 10|ConvertFrom-Json;$recovered.PSObject.Properties.Remove('roomCreationPasswordHash');Initialize-SimpleRoomCreationPassword $folder $recovered
  if($recovered.roomCreationPasswordHash -cne $expectedHash -or $script:creationPrompts -ne $beforeRecovery){throw 'Existing env hash was not recovered without a password prompt'}
  if ($environment -notmatch 'CASTLINK_GUEST_RELAY_ENABLED=1' -or $environment -notmatch 'CASTLINK_TURN_TRANSPORT=udp') { throw 'Guest route capability not generated' }
  $required=@(Get-SimpleRequiredPorts $false)
  $expectedUdp=@(3478,7882)+@(30000..30031)
  $actualUdp=@($required | Where-Object { $_.protocol -eq 'udp' } | ForEach-Object { [int]$_.port })
  if ($actualUdp.Count -ne 34 -or @(Compare-Object $expectedUdp $actualUdp).Count) { throw 'Preflight ports differ from the exact compact RTC/TURN bindings' }
  # The same generator is used for completed local and SSH updates. Regeneration must
  # remove legacy ranges without changing saved identity, credentials, mounts or TLS mode.
  foreach ($target in @('local','remote')) {
    $updateFolder=Join-Path $folder ('update-'+$target);$null=New-Item -ItemType Directory $updateFolder
    $mediaIp=if($target -eq 'remote'){'8.8.8.8'}else{'192.168.1.25'}
    $updating=New-SimpleConfiguration $updateFolder $mediaIp ($target -eq 'remote') $release
    Set-SimpleTarget $updateFolder $updating $target $mediaIp 'root' 22
    $updating.completed=$true;$updating.databasePhase='seed';Save-SimpleState $updateFolder $updating
    Write-SimpleConfiguration $updateFolder $updating $release $mediaIp
    $savedState=[IO.File]::ReadAllText((Join-Path $updateFolder '.castlink-install.json'))
    $savedWeb=[IO.File]::ReadAllText((Join-Path $updateFolder 'web.env'))
    $savedPostgres=[IO.File]::ReadAllText((Join-Path $updateFolder 'postgres.env'))
    $legacy=Get-Content (Join-Path $updateFolder 'livekit.json') -Raw|ConvertFrom-Json
    $legacy.rtc.PSObject.Properties.Remove('udp_port');$legacy.rtc|Add-Member -NotePropertyName port_range_start -NotePropertyValue 61000;$legacy.rtc|Add-Member -NotePropertyName port_range_end -NotePropertyValue 61100;$legacy.turn.relay_range_end=30999
    Write-SimpleText (Join-Path $updateFolder 'livekit.json') ($legacy|ConvertTo-Json -Depth 10)
    $legacyCompose=Get-Content (Join-Path $updateFolder 'compose.json') -Raw|ConvertFrom-Json
    $legacyCompose.services.livekit.ports=@('7881:7881/tcp','61000-61100:61000-61100/udp','3478:3478/udp','30000-30999:30000-30999/udp')
    Write-SimpleText (Join-Path $updateFolder 'compose.json') ($legacyCompose|ConvertTo-Json -Depth 15)
    $resumed=New-SimpleConfiguration $updateFolder $mediaIp ($target -eq 'remote') $release
    Write-SimpleConfiguration $updateFolder $resumed $release $mediaIp
    $updated=Get-Content (Join-Path $updateFolder 'livekit.json') -Raw|ConvertFrom-Json
    $updatedCompose=Get-Content (Join-Path $updateFolder 'compose.json') -Raw|ConvertFrom-Json
    if(-not $resumed.completed -or $updated.rtc.udp_port -ne 7882 -or $updated.rtc.PSObject.Properties['port_range_start'] -or $updated.turn.relay_range_end -ne 30031 -or ($updatedCompose.services.livekit.ports -join ',') -cne '7881:7881/tcp,7882:7882/udp,3478:3478/udp,30000-30031:30000-30031/udp'){throw ('Legacy completed '+$target+' update retained oversized media bindings')}
    if([IO.File]::ReadAllText((Join-Path $updateFolder '.castlink-install.json')) -cne $savedState -or [IO.File]::ReadAllText((Join-Path $updateFolder 'web.env')) -cne $savedWeb -or [IO.File]::ReadAllText((Join-Path $updateFolder 'postgres.env')) -cne $savedPostgres){throw ('Compact '+$target+' update changed installation identity or credentials')}
    if(($updatedCompose.services.postgres.volumes -join ',') -cne ($legacyCompose.services.postgres.volumes -join ',') -or ($updatedCompose.services.web.volumes -join ',') -cne ($legacyCompose.services.web.volumes -join ',')){throw 'Compact update changed persistent mounts'}
  }
  $state.address='127.0.0.1'
  Write-SimpleConfiguration $folder $state $release '127.0.0.1'
  $loopback=Get-Content (Join-Path $folder 'compose.json') -Raw | ConvertFrom-Json
  if ($loopback.services.caddy.ports[0] -ne '127.0.0.1:443:443' -or $loopback.services.livekit.ports[0] -ne '127.0.0.1:7881:7881/tcp') { throw 'Loopback mode exposed all interfaces' }
  if (($loopback.services.livekit.ports -join ',') -cne '127.0.0.1:7881:7881/tcp,127.0.0.1:7882:7882/udp,127.0.0.1:3478:3478/udp,127.0.0.1:30000-30031:30000-30031/udp') { throw 'Loopback media bindings exposed all interfaces or retained legacy ranges' }
  $state.address='192.168.1.22'
  $same=New-SimpleConfiguration $folder '192.168.1.22' $false $release
  if ($same.installationId -ne $state.installationId -or $same.password -ne $state.password) { throw 'Resume changed identity/secrets' }
  $refused=$false; try { $null=New-SimpleConfiguration $folder '192.168.1.23' $false $release } catch { $refused=$true }; if (-not $refused) { throw 'Wrong address accepted' }
  $state.address='meet.example.com';$state.publicHttps=$true
  Write-SimpleConfiguration $folder $state $release '203.0.113.1'
  $caddy=Get-Content (Join-Path $folder 'Caddyfile') -Raw
  if ($caddy -match 'tls internal' -or $caddy -notmatch 'https://meet.example.com') { throw 'VPS HTTPS mismatch' }
  $script:calls=New-Object Collections.Generic.List[object]
  $script:failBootstrap=''
  function Invoke-DeploymentCompose([string[]]$Arguments,[string]$InputText='',[int]$TimeoutSeconds=900) {
    $script:calls.Add([pscustomobject]@{args=$Arguments;input=$InputText})
    if ($InputText.Length -and ($InputText | ConvertFrom-Json).phase -eq $script:failBootstrap) { throw 'Docker: команда завершилась с кодом 3 (database-contract-refused)' }
    return ''
  }
  $script:failBootstrap='migrations';$message=''
  try { $null=Complete-SimpleDeployment $folder $state } catch { $message=$_.Exception.Message }
  if ($message -notmatch 'migrations' -or $message -notmatch 'database-contract-refused' -or $state.databasePhase -ne 'new' -or $state.completed -or $script:calls.Count -ne 1) { throw 'Failed migration lost phase diagnosis or advanced setup' }
  $script:failBootstrap='';$script:calls.Clear()
  $url=Complete-SimpleDeployment $folder $state
  if ($script:calls.Count -ne 4 -or $url -ne 'https://meet.example.com/') { throw 'Deployment caller order mismatch' }
  foreach ($i in 0,1) { $json=$script:calls[$i].input; if ($json -match '[\r\n]' -or ($json | ConvertFrom-Json).phase -ne @('migrations','seed')[$i]) { throw 'Noncanonical database input' } }
  if (($script:calls | ConvertTo-Json -Depth 8) -match 'super-admin-owner|owner-invite|#owner=') { throw 'Simple setup still issues platform invitation' }
  $finish=$script:calls[3].args[-1]
  if ($finish -notmatch 'needsSetup!==false' -or $finish -notmatch 'request\("GET"\)') { throw '409 completion check missing' }
  $script:calls.Clear();$null=Complete-SimpleDeployment $folder $state
  if ($script:calls.Count -ne 2 -or $script:calls[0].args[-1] -ne '/app/scripts/postgres-migrate.mjs') { throw 'Completed setup missed additive migration or reran bootstrap seed' }
  $exe=Join-Path $PSHOME 'powershell.exe';if (-not (Test-Path $exe)) { $exe=Join-Path $PSHOME 'pwsh' }
  $result=Invoke-SimpleProcess -File $exe -Arguments @('-NoProfile','-NonInteractive','-Command','[Console]::Out.Write([Console]::In.ReadToEnd())') -InputText '{"literal":"x"}' -TimeoutSeconds 15
  if ($result.code -ne 0 -or $result.stdout -ne '{"literal":"x"}') { throw 'Process stdin changed canonical input' }
  $oldEncoding=[Console]::InputEncoding
  try {
    # EasySetup.cmd selects codepage65001. A text reader can strip a UTF8 BOM,
    # hiding bytes rejected by the Node bootstrap's canonical JSON parser.
    [Console]::InputEncoding=New-Object Text.UTF8Encoding($true)
    $rawReader='$stream=[IO.MemoryStream]::new();[Console]::OpenStandardInput().CopyTo($stream);[Console]::Out.Write([Convert]::ToBase64String($stream.ToArray()))'
    $rawResult=Invoke-SimpleProcess -File $exe -Arguments @('-NoProfile','-NonInteractive','-Command',$rawReader) -InputText '{"literal":"x"}' -TimeoutSeconds 15
    $expected=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('{"literal":"x"}'))
    if ($rawResult.code -ne 0 -or $rawResult.stdout -cne $expected) { throw 'UTF8 console changed raw canonical stdin bytes' }
    $emptyResult=Invoke-SimpleProcess -File $exe -Arguments @('-NoProfile','-NonInteractive','-Command',$rawReader) -InputText '' -TimeoutSeconds 15
    if ($emptyResult.code -ne 0 -or $emptyResult.stdout.Length) { throw 'Empty process stdin acquired console preamble' }
    if ([Console]::InputEncoding.CodePage -ne 65001 -or [Convert]::ToBase64String([Console]::InputEncoding.GetPreamble()) -cne '77u/') { throw 'Process start did not restore console encoding' }
  } finally { [Console]::InputEncoding=$oldEncoding }
  $realProcess=${function:Invoke-SimpleProcess};$script:SshSession=$null;$script:DockerExe='fixture'
  try {
    function Invoke-SimpleProcess { return $script:processFailure }
    foreach ($failure in @(
      [pscustomobject]@{code=3;stdout='{"schemaVersion":1,"contract":"castlink-database-v1","ok":false,"diagnosis":"database-contract-refused"}';stderr=''},
      [pscustomobject]@{code=7;stdout='PRIVATE_STDOUT_SECRET';stderr=''}
    )) {
      $script:processFailure=$failure;$message=''
      try { $null=Invoke-DeploymentDocker @('fixture') } catch { $message=$_.Exception.Message }
      if ($message -notmatch ([string]$failure.code) -or $message -match 'PRIVATE_STDOUT_SECRET' -or ($failure.code -eq 3 -and $message -notmatch 'database-contract-refused')) { throw 'Docker failure diagnosis lost exit/contract or disclosed stdout' }
    }
  } finally { Set-Item Function:Invoke-SimpleProcess $realProcess }
  # Reclaim only an owned legacy LiveKit before importing the new image archive.
  # Inspect real-container bindings: the target Compose has already been rewritten.
  $script:ServerFolder=$folder;$script:SshSession=$null
  $mediaProject='castlink-easy-'+$state.installationId.Replace('-','')
  $script:mediaRunning=$true;$script:mediaStops=0;$script:mediaIds='aaaaaaaaaaaa'
  $script:mediaResource=[pscustomobject]@{project=$mediaProject;service='livekit';running=$true;ports=[pscustomobject]@{}}
  function Invoke-DeploymentDocker([string[]]$Arguments,[string]$InputText='',[int]$TimeoutSeconds=900) {
    if($Arguments[0] -eq 'ps'){
      if(($Arguments -join ' ') -cne ('ps -q --filter label=com.docker.compose.project='+$mediaProject+' --filter label=com.docker.compose.service=livekit')){throw 'Media pre-load query escaped installation/service scope'}
      if($script:mediaRunning){return $script:mediaIds};return ''
    }
    if($Arguments[0] -eq 'inspect'){return ($script:mediaResource|ConvertTo-Json -Depth 8 -Compress)}
    throw 'Media pre-load guard ran an unexpected Docker mutation'
  }
  function Invoke-DeploymentCompose([string[]]$Arguments,[string]$InputText='',[int]$TimeoutSeconds=900,[string]$ProjectName='') {
    if(($Arguments -join ' ') -cne 'stop livekit' -or $ProjectName -cne $mediaProject){throw 'Media migration stopped another service/project'}
    $script:mediaStops++;$script:mediaRunning=$false;return ''
  }
  $script:mediaRunning=$false
  if(Stop-SimpleLegacyMediaForUpdate $folder $state){throw 'Fresh installation tried to stop media'}
  $script:mediaRunning=$true
  $compact=[ordered]@{};foreach($port in @(3478,7882)+@(30000..30031)){$compact[([string]$port+'/udp')]=@(@{HostIp='0.0.0.0';HostPort=[string]$port})};$compact['7881/tcp']=@(@{HostIp='0.0.0.0';HostPort='7881'})
  $script:mediaResource.ports=[pscustomobject]$compact
  if(Stop-SimpleLegacyMediaForUpdate $folder $state){throw 'Already compact LiveKit was stopped unnecessarily'}
  $legacy=[ordered]@{};foreach($port in @(3478)+@(61000..61100)+@(30000..30999)){$legacy[([string]$port+'/udp')]=@(@{HostIp='0.0.0.0';HostPort=[string]$port},@{HostIp='::';HostPort=[string]$port})};$legacy['7881/tcp']=@(@{HostIp='0.0.0.0';HostPort='7881'})
  $script:mediaResource.ports=[pscustomobject]$legacy
  $script:mediaResource.ports|Add-Member -NotePropertyName '40000/udp' -NotePropertyValue @(@{HostIp='0.0.0.0';HostPort='40000'})
  if(Stop-SimpleLegacyMediaForUpdate $folder $state){throw 'Custom media bindings were stopped automatically'}
  $script:mediaResource.ports.PSObject.Properties.Remove('40000/udp')
  $script:mediaResource.project='foreign-project';$refused=$false
  try{$null=Stop-SimpleLegacyMediaForUpdate $folder $state}catch{$refused=$true}
  if(-not $refused -or $script:mediaStops){throw 'Foreign LiveKit resource was accepted'}
  $script:mediaResource.project=$mediaProject;$script:mediaIds="aaaaaaaaaaaa`nbbbbbbbbbbbb";$refused=$false
  try{$null=Stop-SimpleLegacyMediaForUpdate $folder $state}catch{$refused=$true}
  if(-not $refused -or $script:mediaStops){throw 'Ambiguous LiveKit resources were accepted'}
  $script:mediaIds='aaaaaaaaaaaa'
  if(-not(Stop-SimpleLegacyMediaForUpdate $folder $state) -or $script:mediaStops -ne 1 -or $script:mediaRunning){throw 'Legacy owned proxy overhead was not reclaimed before image import'}
  if(Stop-SimpleLegacyMediaForUpdate $folder $state){throw 'Repeated legacy migration stopped media twice'}
  $script:SshSession=[pscustomobject]@{fixture=$true};$script:ServerFolder='/opt/'+$mediaProject;$script:mediaRunning=$true
  if(-not(Stop-SimpleLegacyMediaForUpdate $folder $state) -or $script:mediaStops -ne 2){throw 'SSH media migration missed the same scoped stop'}
  Write-Output 'SIMPLE_PS_FIXTURES_PASS config LAN/VPS resume migrations/API root-home literal-stdin scoped-legacy-media-stop'
} finally { Remove-Item -LiteralPath $folder -Recurse -Force }
