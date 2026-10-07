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
  function Invoke-DeploymentCompose([string[]]$Arguments,[string]$InputText='',[int]$TimeoutSeconds=900) {
    $script:calls.Add([pscustomobject]@{args=$Arguments;input=$InputText})
    return ''
  }
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
  Write-Output 'SIMPLE_PS_FIXTURES_PASS config LAN/VPS resume migrations/API root-home literal-stdin'
} finally { Remove-Item -LiteralPath $folder -Recurse -Force }
