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
  $lk=Get-Content (Join-Path $folder 'livekit.json') -Raw | ConvertFrom-Json
  if ($lk.rtc.node_ip -ne '192.168.1.22' -or $lk.rtc.use_external_ip) { throw 'LAN media mismatch' }
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
    if ($Arguments -contains 'cat') { return 'https://meet.example.com/super-admin#owner=fixture-token' }; return ''
  }
  $url=Complete-SimpleDeployment $folder $state
  if ($script:calls.Count -ne 5 -or $url -notmatch '#owner=fixture-token') { throw 'Deployment caller order mismatch' }
  foreach ($i in 0,1) { $json=$script:calls[$i].input; if ($json -match '[\r\n]' -or ($json | ConvertFrom-Json).phase -ne @('migrations','seed')[$i]) { throw 'Noncanonical database input' } }
  $finish=$script:calls[2].args[-1]
  if ($finish -notmatch 'needsSetup!==false' -or $finish -notmatch 'request\("GET"\)') { throw '409 completion check missing' }
  $script:calls.Clear();$null=Complete-SimpleDeployment $folder $state
  if ($script:calls.Count -ne 3) { throw 'Completed setup reran migrations/seed' }
  $result=Invoke-SimpleProcess -File (Join-Path $PSHOME 'powershell.exe') -Arguments @('-NoProfile','-NonInteractive','-Command','[Console]::Out.Write([Console]::In.ReadToEnd())') -InputText '{"literal":"x"}' -TimeoutSeconds 15
  if ($result.code -ne 0 -or $result.stdout -ne '{"literal":"x"}') { throw 'Process stdin changed canonical input' }
  Write-Output 'SIMPLE_PS_FIXTURES_PASS config LAN/VPS resume migrations/API owner literal-stdin'
} finally { Remove-Item -LiteralPath $folder -Recurse -Force }
