param([string]$EntryPath,[string]$DeployPath)
$ErrorActionPreference='Stop'
. $EntryPath -FunctionsOnly -Target remote -Domain ''
. $DeployPath
$root=Join-Path $env:TEMP ('castlink-domain-fixture-'+[Guid]::NewGuid())
$null=New-Item -ItemType Directory -Path $root
try {
  $release=[pscustomobject]@{images=[pscustomobject]@{web='web:old';postgres='postgres:old';livekit='livekit:old';caddy='caddy:old'}}
  $state=New-SimpleConfiguration $root '203.0.113.10' $true $release
  Set-SimpleTarget $root $state 'remote' '203.0.113.10' 'root' 22
  $state.completed=$true;$state.databasePhase='seed';Save-SimpleState $root $state
  Write-SimpleConfiguration $root $state $release '203.0.113.10'
  $original=Get-Content (Join-Path $root 'Caddyfile') -Raw
  if ($original -notmatch 'profile shortlived' -or $original -notmatch 'default_sni 203.0.113.10' -or $original -match 'tls internal' -or $original -notmatch 'acme-v02.api.letsencrypt.org') { throw 'Public IP must use explicit public ACME IP profile/default SNI' }
  $before=@{};foreach($f in @('compose.json','postgres.env','web.env','livekit.json')) { $before[$f]=[IO.File]::ReadAllText((Join-Path $root $f)) }
  $script:InstallFolder=$root;$script:ServerFolder='/opt/castlink-easy-'+$state.installationId.Replace('-','');$script:SshSession='fixture'
  $script:calls=New-Object Collections.Generic.List[object];$script:failHttps=$false;$script:failAdapt=$false;$script:failRollback=$false;$script:uploads=0
  function ConvertTo-SimplePosixLiteral([string]$Value) { return ("'"+$Value+"'") }
  $script:remoteDifferent=$false
  function Invoke-SimpleSshCommand([object]$Client,[string]$Command) {
    $file=if ($Command -match 'compose.json') { 'compose.json' } else { 'Caddyfile' }
    $content=[IO.File]::ReadAllText((Join-Path $root $file))
    if ($script:remoteDifferent -and $file -eq 'Caddyfile') { $content+='# manual remote edit' }
    return [pscustomobject]@{code=0;stdout=$content;stderr=''}
  }
  function Invoke-DeploymentCompose([string[]]$Arguments,[string]$InputText='',[int]$TimeoutSeconds=900,[string]$ProjectName='') {
    $script:calls.Add([pscustomobject]@{args=$Arguments;input=$InputText;project=$ProjectName})
    if ($Arguments -contains '/api/version' -or ($Arguments -contains 'web' -and $Arguments -contains 'node')) { return 'installed-old-build' }
    if ($script:failAdapt -and $Arguments -contains 'adapt') { throw 'ADAPT_FAILURE' }
    return ''
  }
  function Upload-SimpleSshFile { $script:uploads++;if ($script:failRollback -and $script:uploads -eq 2) { throw 'ROLLBACK_UPLOAD_FAILURE' };$script:calls.Add([pscustomobject]@{args=@('upload');input='';project=''}) }
  function Wait-SimpleHttps([object]$State,[object]$Release,[string]$CaFile,[string]$ExpectedBuildId='') {
    if ($ExpectedBuildId -cne 'installed-old-build') { throw 'Switch verified downloaded release instead of installed build' }
    if ($script:failHttps -and $State.address -ne '203.0.113.10') { throw 'CERTIFICATE_FAILURE' }
  }
  $script:remoteDifferent=$true;$failure=''
  try { $null=Set-SimpleRemoteDomain $root $state 'meet.example.com' } catch { $failure=$_.Exception.Message }
  if ($failure -notmatch 'Caddyfile на VPS изменён' -or $script:calls.Count) { throw 'Remote divergence was overwritten' }
  $script:remoteDifferent=$false
  $script:failHttps=$true;$failure=''
  try { $null=Set-SimpleRemoteDomain $root $state 'meet.example.com' } catch { $failure=$_.Exception.Message }
  if ($failure -notmatch 'CERTIFICATE_FAILURE' -or [IO.File]::ReadAllText((Join-Path $root 'Caddyfile')) -cne $original -or (Get-Content (Join-Path $root '.castlink-install.json') -Raw|ConvertFrom-Json).address -cne '203.0.113.10') { throw 'Failed domain change did not restore prior configuration' }
  $script:failRollback=$true;$script:uploads=0;$failure=''
  try { $null=Set-SimpleRemoteDomain $root $state 'meet.example.com' } catch { $failure=$_.Exception.Message }
  if ($failure -notmatch 'Не удалось восстановить Caddy' -or [IO.File]::ReadAllText((Join-Path $root 'Caddyfile')) -cne $original -or (Get-Content (Join-Path $root '.castlink-install.json') -Raw|ConvertFrom-Json).address -cne '203.0.113.10') { throw 'Rollback failure hid incomplete activation or lost prior local state' }
  $script:failRollback=$false;$script:failHttps=$false;$script:failAdapt=$true;$script:calls.Clear();$failure=''
  try { $null=Set-SimpleRemoteDomain $root $state 'meet.example.com' } catch { $failure=$_.Exception.Message }
  if ($failure -cne 'ADAPT_FAILURE' -or @($script:calls|Where-Object{$_.args -contains 'upload' -or $_.args -contains 'restart'}).Count -ne 0) { throw 'Invalid Caddy configuration performed remote mutation' }
  $script:failAdapt=$false
  foreach ($property in @('completed','target','address','serverIp')) {
    $bad=$state|ConvertTo-Json|ConvertFrom-Json
    switch($property) { 'completed'{$bad.completed=$false};'target'{$bad.target='local'};'address'{$bad.address='old.example.com'};'serverIp'{$bad.serverIp='203.0.113.11'} }
    $script:calls.Clear();$failure=''
    try { $null=Set-SimpleRemoteDomain $root $bad 'meet.example.com' } catch { $failure=$_.Exception.Message }
    if (-not $failure -or $script:calls.Count) { throw ('Invalid domain transition performed an operation: '+$property) }
  }
  foreach($ip in @('10.0.0.1','172.16.1.1','192.168.1.1','127.0.0.1','100.64.0.1')) { $refused=$false;try{Assert-SimplePublicIPv4 $ip}catch{$refused=$true};if(-not $refused){throw 'Private IP was offered public ACME'} }
  $script:failHttps=$false;$script:calls.Clear()
  $changed=Set-SimpleRemoteDomain $root $state 'meet.example.com'
  if ($changed.address -cne 'meet.example.com' -or $changed.installationId -cne $state.installationId -or $changed.password -cne $state.password -or $changed.databasePhase -cne 'seed' -or -not $changed.completed) { throw 'Domain change reset identity/data checkpoints' }
  foreach($f in $before.Keys) { if ([IO.File]::ReadAllText((Join-Path $root $f)) -cne $before[$f]) { throw ('Domain change rewrote '+$f) } }
  if ((Get-Content (Join-Path $root 'Caddyfile') -Raw) -match 'profile shortlived|tls internal') { throw 'Domain retained IP/internal certificate policy' }
  if (($script:calls | ConvertTo-Json -Depth 8) -match '"(load|up|seed)"|setup-database|postgres-migrate') { throw 'Domain change ran deployment/data effects' }
  $restarts=@($script:calls|Where-Object{$_.args -contains 'restart'})
  if ($restarts.Count -ne 1 -or $restarts[0].args[-1] -cne 'caddy' -or $restarts[0].project -cne ('castlink-easy-'+$state.installationId.Replace('-',''))) { throw 'Domain change must restart only same project Caddy' }
  Write-Output 'SIMPLE_DOMAIN_FIXTURES_PASS public-IP-policy same-installation same-build rollback no-data-effects'
} finally { Remove-Item -LiteralPath $root -Recurse -Force }
