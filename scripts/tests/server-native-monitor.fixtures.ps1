param([string]$BridgePath)
$ErrorActionPreference = 'Stop'
if (-not $BridgePath) { $BridgePath = Join-Path $PSScriptRoot '../server-native-monitor.ps1' }
. $BridgePath
function Assert($Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
function Assert-Throws([scriptblock]$Block, [string]$Pattern, [int]$Status = -1) {
    try { & $Block } catch {
        Assert ($_.Exception.Message -match $Pattern) ('Unexpected error type: ' + $_.Exception.GetType().Name)
        if ($Status -ge 0) { Assert ($_.Exception.Data['StatusCode'] -eq $Status) 'HTTP denial status was lost' }
        return
    }
    throw 'Expected native monitor rejection'
}
$temporary = Join-Path ([IO.Path]::GetTempPath()) ('castlink-native-monitor-test-' + [guid]::NewGuid().ToString('N'))
$oldLocalAppData = $env:LOCALAPPDATA
[void][IO.Directory]::CreateDirectory($temporary)
try {
    Assert ((ConvertTo-CastlinkMonitorCsvCell '=HYPERLINK("secret")').StartsWith('"''=')) 'Formula string was not hardened'
    Assert ((ConvertTo-CastlinkMonitorCsvCell "`t+cmd").StartsWith('"''')) 'Whitespace-prefixed formula was not hardened'
    # WinPS argument mode treats a bare -3 as text; measurements arrive as numeric values.
    Assert ((ConvertTo-CastlinkMonitorCsvCell (-3)) -ceq '"-3"') 'Measured numeric value was changed'
    Assert ((ConvertTo-CastlinkMonitorCsvCell '-3') -ceq '"''-3"') 'Formula-like negative string was not hardened'
    Assert ((ConvertTo-CastlinkMonitorMoscowTime 0) -ceq '1970-01-01 03:00:00 MSK') 'Moscow export time is incorrect'
    $event = [pscustomobject]@{id=1;at=1700000000000L;level='warn';event='server.livekit.unavailable';service='secret-url';fields=[pscustomobject]@{status=503;durationMs=42;password='PRIVATE_PASSWORD';requestId='PRIVATE_PARTICIPANT';reason='https://secret.invalid/csa2.private';code=('a'*64);participants=2;ok=$false}}
    $safe = ConvertTo-CastlinkMonitorSafeEvent $event
    $safeJson = $safe | ConvertTo-Json -Depth 5 -Compress
    Assert ($safeJson -match 'server.livekit.unavailable' -and $safeJson -match '"status":503' -and $safeJson -match '"ok":false') 'Stable diagnostic data was lost'
    Assert ($safeJson -notmatch 'PRIVATE_|secret|csa2|"code"|"reason"|"requestId"') 'Free text, identity or credentials escaped redaction'
    $event.event = 'csa2.PRIVATE_SECRET'
    Assert ($null -eq (ConvertTo-CastlinkMonitorSafeEvent $event)) 'Unknown or credential event type was exported'
    $event.event = 'server.livekit.unavailable'

    $env:LOCALAPPDATA = $temporary
    $root = Join-Path $temporary 'CastLinkServer'
    [void][IO.Directory]::CreateDirectory($root)
    $original = Join-Path $temporary 'original.ps1'; $staged = Join-Path $root 'install-server-windows.ps1'
    [IO.File]::WriteAllText($original, '# synthetic original installer fixture')
    [IO.File]::Copy($original, $staged)
    $hash = (Get-FileHash -LiteralPath $original -Algorithm SHA256).Hash.ToLowerInvariant()
    $binding = [pscustomobject]@{sourceScriptPath=$original;installRoot=$root;installationId=('a'*32);expectedInstallerSha256=$hash;origin='https://native-monitor.invalid';expectedBuildId='1.0.2-rc.8-aaaaaaaaaaaa'}
    $state = [pscustomobject]@{schemaVersion=1;phase='ready';installationId=$binding.installationId;distroName=('CastLink-Server-'+('a'*12));rootPath=$root;releaseTag=('server-wsl-v'+$binding.expectedBuildId)}
    $bindingFile = Join-Path $temporary 'binding.json'
    [IO.File]::WriteAllText($bindingFile, ($binding | ConvertTo-Json))
    [IO.File]::WriteAllText((Join-Path $root 'installation.json'), ($state | ConvertTo-Json))
    $privateRootValidator = (Get-Item Function:Assert-CastlinkMonitorPrivateRoot).ScriptBlock
    if ([Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT) {
        $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
        $acl = New-Object Security.AccessControl.DirectorySecurity
        $acl.SetOwner($sid); $acl.SetAccessRuleProtection($true, $false)
        foreach ($principal in @($sid, [Security.Principal.SecurityIdentifier]::new('S-1-5-18'))) {
            [void]$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($principal, [Security.AccessControl.FileSystemRights]::FullControl, [Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit', [Security.AccessControl.PropagationFlags]::None, [Security.AccessControl.AccessControlType]::Allow))
        }
        ([IO.DirectoryInfo]::new($root)).SetAccessControl($acl)
        Assert-CastlinkMonitorPrivateRoot $root
    } else {
        # Linux fixtures exercise identity/export; actual Windows ACL+DPAPI is a separate gate.
        function Assert-CastlinkMonitorPrivateRoot([string]$Root) { }
    }
    $validated = Read-CastlinkNativeMonitorBinding $bindingFile
    Assert ($validated.installationId -ceq $binding.installationId) 'Valid installation binding failed'
    [IO.File]::AppendAllText($staged, '# changed')
    Assert-Throws { Read-CastlinkNativeMonitorBinding $bindingFile } 'checksum'
    [IO.File]::Copy($original, $staged, $true)
    $state.installationId = 'b'*32
    [IO.File]::WriteAllText((Join-Path $root 'installation.json'), ($state | ConvertTo-Json))
    Assert-Throws { Read-CastlinkNativeMonitorBinding $bindingFile } 'identity'
    $state.installationId = $binding.installationId
    [IO.File]::WriteAllText((Join-Path $root 'installation.json'), ($state | ConvertTo-Json))

    $requestImplementation = (Get-Item Function:Invoke-CastlinkMonitorRequest).ScriptBlock
    $sessionImplementation = (Get-Item Function:Get-CastlinkMonitorSession).ScriptBlock
    $installerImplementation = (Get-Item Function:Invoke-CastlinkMonitorInstaller).ScriptBlock
    $script:fixtureBinding = $binding
    $script:fixtureNow = 1700000000000L
    $script:fixtureSnapshot = [pscustomobject]@{generatedAt=$script:fixtureNow;scope='wsl';intervalMs=5000;retentionMs=86400000;windowMs=86400000;resolutionMs=120000;aggregation='max';storage=[pscustomobject]@{state='ok';droppedEvents=3;samplerRunning=$true};latest=[pscustomobject]@{at=$script:fixtureNow;cpuPercent=0};history=@([pscustomobject]@{at=$script:fixtureNow;cpuPercent=0;connections=$null;memoryUsedBytes=1048576;password='PRIVATE_METRIC';services=[pscustomobject]@{web='ok';livekit='unavailable';roomStore='ok'}})}
    function Get-CastlinkMonitorSession($Binding) { return (New-Object Net.CookieContainer) }
    $script:fixtureDenied = $true; $script:fixturePageCalls = 0
    function Invoke-CastlinkMonitorRequest($Binding, $Cookies, [string]$Path, [string]$Body = '') {
        if ($script:fixtureDenied) { throw (New-CastlinkMonitorError 'Access denied.' 403) }
        if ($Path -eq '/api/super-admin/metrics?range=24h') { return $script:fixtureSnapshot }
        $script:fixturePageCalls++
        $id = if ($Path -match 'cursor=') { 1 } else { 2 }
        return [pscustomobject]@{retentionMs=86400000;events=@([pscustomobject]@{id=$id;at=$script:fixtureNow-$id;level='warn';event='server.livekit.unavailable';fields=[pscustomobject]@{status=503;password='PRIVATE_EVENT';participant='PRIVATE_PARTICIPANT';reason='https://private.invalid';token='csa2.PRIVATE'}});nextCursor=$(if ($id -eq 2) { 2 } else { $null });storage=[pscustomobject]@{state='ok';droppedEvents=3;samplerRunning=$true}}
    }
    Assert-Throws { Get-CastlinkNativeMonitorSnapshot -BindingFile $bindingFile } 'denied' 403
    Assert-Throws { Export-CastlinkNativeMonitorBundle -BindingFile $bindingFile -Destination (Join-Path $temporary 'denied.zip') } 'denied' 403
    Assert (-not (Test-Path -LiteralPath (Join-Path $temporary 'denied.zip'))) 'Denied export created an archive'
    $script:fixtureDenied = $false
    $snapshot = Get-CastlinkNativeMonitorSnapshot -BindingFile $bindingFile
    Assert ($snapshot.latest.cpuPercent -eq 0 -and $snapshot.scope -ceq 'wsl' -and $null -eq $snapshot.history[0].connections) 'Measured zero or unavailable shape was changed'
    $destination = Join-Path $temporary 'monitor.zip'
    $summary = Export-CastlinkNativeMonitorBundle -BindingFile $bindingFile -Destination $destination
    Assert ($summary.eventRecords -eq 2 -and $summary.eventPages -eq 2 -and -not $summary.eventsTruncated -and $summary.historyAggregated) 'Pagination or aggregation summary is wrong'
    Add-Type -AssemblyName System.IO.Compression
    $stream = [IO.File]::OpenRead($destination)
    $zip = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Read)
    try {
        Assert ((($zip.Entries.FullName | Sort-Object) -join ',') -ceq 'events.jsonl,metrics.csv,summary.json') 'ZIP contents are incorrect'
        $all = ''
        foreach ($entry in $zip.Entries) {
            $reader = [IO.StreamReader]::new($entry.Open())
            try { $content = $reader.ReadToEnd(); $all += $content } finally { $reader.Dispose() }
            if ($entry.FullName -eq 'metrics.csv') { Assert ($content -match '"0"' -and $content -match 'MSK' -and $content -match 'unavailable') 'CSV lost zero, Moscow time or service availability' }
        }
        Assert ($all -notmatch 'PRIVATE_|private.invalid|csa2\.|password|participant"|https://') 'ZIP exported a credential, identity or private URL'
    } finally { $zip.Dispose(); $stream.Dispose() }
    Assert-Throws { Export-CastlinkNativeMonitorBundle -BindingFile $bindingFile -Destination $destination } 'new ZIP'
    function Invoke-CastlinkMonitorRequest($Binding, $Cookies, [string]$Path, [string]$Body = '') {
        if ($Path -match '/metrics') { return $script:fixtureSnapshot }
        return [pscustomobject]@{retentionMs=86400000;events=@();nextCursor=2;storage=[pscustomobject]@{state='ok';droppedEvents=0}}
    }
    Assert-Throws { Export-CastlinkNativeMonitorBundle -BindingFile $bindingFile -Destination (Join-Path $temporary 'loop.zip') } 'pagination'
    Assert (-not (Test-Path -LiteralPath (Join-Path $temporary 'loop.zip'))) 'Invalid pagination created an archive'
    $script:fixtureRemaining = 1000
    function Invoke-CastlinkMonitorRequest($Binding, $Cookies, [string]$Path, [string]$Body = '') {
        if ($Path -match '/metrics') { return $script:fixtureSnapshot }
        $script:fixtureRemaining--
        return [pscustomobject]@{retentionMs=86400000;events=@();nextCursor=$script:fixtureRemaining;storage=[pscustomobject]@{state='ok';droppedEvents=0}}
    }
    $limited = Export-CastlinkNativeMonitorBundle -BindingFile $bindingFile -Destination (Join-Path $temporary 'limited.zip')
    Assert ($limited.eventPages -eq 400 -and $limited.eventsTruncated) 'Pagination cap silently claimed a complete export'

    # Real session function, synthetic HTTPS transport and original-installer boundary.
    # DPAPI is deliberately tested on Windows rather than replaced with plaintext.
    if ([Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT) {
        Set-Item Function:Get-CastlinkMonitorSession $sessionImplementation
        $script:fixtureMints = 0; $script:fixtureAccepts = 0
        $older = Join-Path $root ('owner-access-'+('b'*32)+'.txt')
        [IO.File]::WriteAllText($older, 'PRIVATE_OLDER_INVITATION')
        function Invoke-CastlinkMonitorInstaller($Binding, [string]$Action) {
            if ($Action -eq 'Status') { return (@{origin=$Binding.origin;buildId=$Binding.expectedBuildId;ready=$true} | ConvertTo-Json) }
            $script:fixtureMints++
            [IO.File]::WriteAllText((Join-Path $Binding.installRoot ('owner-access-'+('c'*32)+'.txt')), ($Binding.origin+'/super-admin#access=csa2.'+('x'*43)))
        }
        function Invoke-CastlinkMonitorRequest($Binding, $Cookies, [string]$Path, [string]$Body = '') {
            if ($Path -eq '/api/version') { return [pscustomobject]@{buildId=$Binding.expectedBuildId} }
            Assert ($Path -ceq '/api/super-admin-access') 'Unexpected auth endpoint'
            $data = $Body | ConvertFrom-Json
            Assert ($data.action -ceq 'accept' -and $data.invite -ceq ('csa2.'+('x'*43))) 'Existing invitation accept contract changed'
            $script:fixtureAccepts++
            $cookie = [Net.Cookie]::new('castlink-super-admin-v2', ('csa2.'+('y'*43)), '/', ([Uri]$Binding.origin).Host)
            $cookie.Secure=$true; $cookie.HttpOnly=$true; $cookie.Expires=[DateTime]::UtcNow.AddHours(1); $Cookies.Add($cookie)
            return [pscustomobject]@{allowed=$true}
        }
        $cookies = Get-CastlinkMonitorSession $binding
        Assert ($script:fixtureMints -eq 1 -and $script:fixtureAccepts -eq 1) 'Owner invitation was not consumed exactly once'
        Assert (Test-Path -LiteralPath $older) 'Pre-existing owner invitation was deleted'
        Assert (-not (Test-Path -LiteralPath (Join-Path $root ('owner-access-'+('c'*32)+'.txt')))) 'Consumed own invitation was retained'
        $cache = Join-Path $root 'native-monitor-session.dat'
        Assert ([Text.Encoding]::UTF8.GetString([IO.File]::ReadAllBytes($cache)) -notmatch 'csa2\.|yyyyy') 'Cookie cache is not protected'
        $cookies = Get-CastlinkMonitorSession $binding
        Assert ($script:fixtureMints -eq 1 -and $cookies.GetCookies([Uri]$binding.origin).Count -eq 1) 'DPAPI cookie was not reused by the current user'
        Remove-Item -LiteralPath $cache -Force
        function Invoke-CastlinkMonitorInstaller($Binding, [string]$Action) {
            if ($Action -eq 'Status') { return (@{origin='https://foreign.invalid';buildId=$Binding.expectedBuildId;ready=$true} | ConvertTo-Json) }
            $script:fixtureMints++
        }
        Assert-Throws { Get-CastlinkMonitorSession $binding } 'origin or build'
        Assert ($script:fixtureMints -eq 1) 'Foreign origin reached owner invitation minting'
    } else { Write-Host 'SKIP: actual Windows current-user ACL and DPAPI session cache' }
    Write-Host 'PASS: native monitor binding, denied authorization, snapshot shape, bounded pagination, redacted CSV/JSONL ZIP and protected owner session fixtures'
} finally {
    $env:LOCALAPPDATA = $oldLocalAppData
    Remove-Item -LiteralPath $temporary -Recurse -Force -ErrorAction SilentlyContinue
}
