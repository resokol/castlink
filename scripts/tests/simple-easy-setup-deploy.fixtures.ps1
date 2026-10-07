param([string]$HelperPath)
$ErrorActionPreference='Stop'
. $HelperPath
$folder=Join-Path $env:TEMP ('castlink-simple-fixture-'+[Guid]::NewGuid().ToString())
$null=New-Item -ItemType Directory -Path $folder
try {
  $release=[pscustomobject]@{images=[pscustomobject]@{web=('sha256:'+('a'*64));postgres='postgres:test';livekit='livekit:test';caddy='caddy:test'}}
  $state=New-SimpleConfiguration $folder '192.168.1.22' $false $release
  Write-SimpleConfiguration $folder $state $release '192.168.1.22'
  $compose=Get-Content (Join-Path $folder 'compose.json') -Raw | ConvertFrom-Json
  if ($compose.services.web.image -ne $release.images.web -or $compose.services.postgres.volumes[0] -ne 'postgres-data:/var/lib/postgresql/data' -or $compose.services.caddy.ports[0] -ne '443:443') { throw 'Compose layout mismatch' }
  if ($compose.services.postgres.healthcheck.test[1] -ne 'pg_isready -U castlink -d castlink') { throw 'Healthcheck interpolates missing host environment' }
  $lk=Get-Content (Join-Path $folder 'livekit.json') -Raw | ConvertFrom-Json
  if ($lk.rtc.node_ip -ne '192.168.1.22' -or $lk.rtc.use_external_ip) { throw 'LAN media mismatch' }
  $state.address='127.0.0.1'
  Write-SimpleConfiguration $folder $state $release '127.0.0.1'
  $loopback=Get-Content (Join-Path $folder 'compose.json') -Raw | ConvertFrom-Json
  if ($loopback.services.caddy.ports[0] -ne '127.0.0.1:443:443' -or $loopback.services.livekit.ports[0] -ne '127.0.0.1:7881:7881/tcp') { throw 'Loopback mode exposed all interfaces' }
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
  Write-Output 'SIMPLE_PS_FIXTURES_PASS config LAN/VPS resume migrations/API root-home literal-stdin'
} finally { Remove-Item -LiteralPath $folder -Recurse -Force }
