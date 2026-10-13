param([string]$HelperPath,[string]$CaddyOutput='')
$ErrorActionPreference='Stop'
. $HelperPath
$folder=Join-Path $env:TEMP ('castlink-turn-fixture-'+[Guid]::NewGuid())
$null=New-Item -ItemType Directory -Path $folder
try {
  $release=[pscustomobject]@{images=[pscustomobject]@{web='web:test';postgres='postgres:test';livekit='livekit:test';caddy='caddy:test';turntls='castlink-easy-turntls:test'}}
  $state=New-SimpleConfiguration $folder 'site.customer.com' $true $release 'relay.customer.com'
  $originalIdentity=$state.installationId;$originalSecret=$state.livekitSecret
  Write-SimpleConfiguration $folder $state $release '8.8.4.4'
  $compose=Get-Content (Join-Path $folder 'compose.json') -Raw | ConvertFrom-Json
  $lk=Get-Content (Join-Path $folder 'livekit.json') -Raw | ConvertFrom-Json
  $caddy=Get-Content (Join-Path $folder 'Caddyfile') -Raw
  if (($compose.services.PSObject.Properties.Name | Sort-Object) -join ',' -cne 'caddy,livekit,postgres,turn-tls,web') { throw 'TLS helper service missing' }
  if ($compose.services.caddy.ports.Count -ne 1 -or $compose.services.caddy.ports[0] -cne '80:80' -or $compose.services.'turn-tls'.ports[0] -cne '443:443') { throw 'Public TLS443 ownership conflict' }
  if ($compose.services.'turn-tls'.environment.CASTLINK_TURN_HOST -cne 'relay.customer.com' -or $compose.services.'turn-tls'.volumes[0] -cne 'caddy-data:/data:ro') { throw 'TLS certificate/domain helper configuration missing' }
  if (-not $lk.turn.external_tls -or -not $lk.turn.proxy_protocol -or $lk.turn.tls_port -ne 5349 -or $lk.turn.domain -cne 'relay.customer.com' -or ($lk.turn.proxy_protocol_trusted_cidrs -join ',') -cne '10.0.0.0/8,172.16.0.0/12,192.168.0.0/16') { throw 'Internal authenticated TURN/TLS route mismatch' }
  if (($lk.turn.allow_restricted_peer_cidrs -join ',') -cne '8.8.4.4/32') { throw 'PROXY upstream trust expanded relay peer permissions' }
  if ($compose.services.livekit.ports -match '5349' -or $compose.services.caddy.ports -match '8443') { throw 'Internal TURN/Caddy listeners exposed publicly' }
  if ($caddy -notmatch 'https_port 8443' -or $caddy -notmatch 'auto_https disable_redirects' -or $caddy -notmatch 'redir https://site.customer.com\{uri\}' -or $caddy -notmatch 'https://relay.customer.com' -or $caddy -notmatch 'disable_tlsalpn_challenge' -or $caddy -match 'tls internal') { throw 'ACME/SNI route or redirect mismatch' }
  if ($caddy -notmatch 'servers :8443' -or $caddy -notmatch 'listener_wrappers' -or $caddy -notmatch 'proxy_protocol' -or $caddy -notmatch 'fallback_policy require' -or $caddy -notmatch 'allow 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16') { throw 'Trusted web PROXYv2 listener missing or applies to public HTTP/80' }
  if ((Get-Content (Join-Path $folder 'web.env') -Raw) -notmatch 'CASTLINK_TURN_TRANSPORT=tls443') { throw 'Configured guest TLS route capability missing' }
  $null=Get-SimpleRemovalProject $state $compose
  $resumed=New-SimpleConfiguration $folder 'site.customer.com' $true $release
  if ($resumed.installationId -cne $originalIdentity -or $resumed.livekitSecret -cne $originalSecret -or $resumed.turnDomain -cne 'relay.customer.com') { throw 'Resume lost TURN/domain/identity/secrets' }
  $refused=$false;try { $null=New-SimpleConfiguration $folder 'site.customer.com' $true $release 'other.customer.com' } catch { $refused=$true };if (-not $refused) { throw 'Changed saved TURN domain accepted silently' }
  foreach ($case in @(@('relay.customer.com','8.8.4.4',$true),@('site.customer.com','site.customer.com',$true),@('bad.customer.com{','site.customer.com',$true),@('relay.customer.com','site.customer.com',$false))) {
    $refused=$false;try { Assert-SimpleTurnDomain $case[0] $case[1] $case[2] } catch { $refused=$true };if (-not $refused) { throw 'Invalid TURN/domain/IP configuration accepted' }
  }
  if ($CaddyOutput) { [IO.File]::WriteAllText($CaddyOutput,$caddy,(New-Object Text.UTF8Encoding($false))) }
  $script:healthAttempts=0;$script:healthSucceeds=$false
  function Start-Sleep([int]$Seconds) {}
  function Invoke-DeploymentCompose([string[]]$Arguments,[string]$InputText='',[int]$TimeoutSeconds=900,[string]$ProjectName='') {
    if ($Arguments -contains 'turn-tls') { $script:healthAttempts++;if (-not $script:healthSucceeds) { throw 'certificate not ready' } }
    return ''
  }
  $refused=$false;try { $null=Complete-SimpleDeployment $folder $state } catch { $refused=$_.Exception.Message -match 'TURN/TLS 443 пока не готов' }
  if (-not $refused -or $script:healthAttempts -ne 60 -or $state.completed) { throw 'TLS certificate/backend readiness failure reported completed installation' }
  $script:healthSucceeds=$true;$script:healthAttempts=0
  $null=Complete-SimpleDeployment $folder $state
  if (-not $state.completed -or $script:healthAttempts -ne 1) { throw 'Ready TLS setup failed to complete' }
  Write-Output 'SIMPLE_TURN_FIXTURES_PASS UDP baseline TLS443 domain ACME/proxy mapping bounded-health resume removal-scope'
} finally { Remove-Item -LiteralPath $folder -Recurse -Force }
