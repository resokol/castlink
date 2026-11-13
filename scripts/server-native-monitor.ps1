# Windows PowerShell 5.1 bridge for the existing, separately authorized monitor API.
# Dot-source only. No host Node, browser, password prompt or TLS override is used.

function New-CastlinkMonitorError([string]$Message, [int]$StatusCode = 0) {
    $failure = [InvalidOperationException]::new($Message)
    $failure.Data['StatusCode'] = $StatusCode
    return $failure
}

function Assert-CastlinkMonitorPlainPath([string]$Path) {
    if (-not [IO.Path]::IsPathRooted($Path)) { throw (New-CastlinkMonitorError 'Native monitor binding requires an absolute local path.') }
    $current = [IO.Path]::GetFullPath($Path)
    while ($current) {
        if ((Test-Path -LiteralPath $current) -and ((Get-Item -LiteralPath $current -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw (New-CastlinkMonitorError 'Native monitor paths cannot use links.') }
        $current = [IO.Path]::GetDirectoryName($current)
    }
}

function Read-CastlinkMonitorJsonFile([string]$Path, [int]$Limit = 32768) {
    Assert-CastlinkMonitorPlainPath $Path
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf) -or (Get-Item -LiteralPath $Path).Length -gt $Limit) { throw (New-CastlinkMonitorError 'Native monitor metadata is unavailable or too large.') }
    try { return ([IO.File]::ReadAllText($Path) | ConvertFrom-Json -ErrorAction Stop) }
    catch { throw (New-CastlinkMonitorError 'Native monitor metadata is invalid.') }
}

function Assert-CastlinkMonitorPrivateRoot([string]$Root) {
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $acl = (Get-Item -LiteralPath $Root).GetAccessControl()
    if ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -cne $sid -or -not $acl.AreAccessRulesProtected) { throw (New-CastlinkMonitorError 'Native monitor requires this Windows user''s private installation.') }
    foreach ($rule in $acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])) {
        if ($rule.AccessControlType -eq [Security.AccessControl.AccessControlType]::Allow -and $rule.IdentityReference.Value -notin @($sid, 'S-1-5-18', 'S-1-5-32-544')) { throw (New-CastlinkMonitorError 'Installation directory permissions are not private.') }
    }
}

function Read-CastlinkNativeMonitorBinding {
    param([Parameter(Mandatory = $true)][string]$BindingFile)
    $binding = Read-CastlinkMonitorJsonFile $BindingFile
    $base = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'CastLinkServer')).TrimEnd('\')
    $root = [IO.Path]::GetFullPath([string]$binding.installRoot).TrimEnd('\')
    if ($root -ine $base -and -not $root.StartsWith($base + '\', [StringComparison]::OrdinalIgnoreCase)) { throw (New-CastlinkMonitorError 'Native monitor cannot use another installation scope.') }
    Assert-CastlinkMonitorPlainPath $root
    Assert-CastlinkMonitorPrivateRoot $root
    $state = Read-CastlinkMonitorJsonFile (Join-Path $root 'installation.json')
    if ($binding.installationId -notmatch '^[a-f0-9]{32}$' -or $state.schemaVersion -ne 1 -or $state.installationId -cne $binding.installationId -or $state.rootPath -cne $root -or $state.distroName -cne ('CastLink-Server-' + $binding.installationId.Substring(0,12)) -or $state.phase -notin @('imported','ready')) { throw (New-CastlinkMonitorError 'Native monitor installation identity does not match.') }
    $origin = $null
    if (-not [Uri]::TryCreate([string]$binding.origin, [UriKind]::Absolute, [ref]$origin) -or $origin.Scheme -cne 'https' -or $origin.UserInfo -or $origin.AbsolutePath -cne '/' -or $origin.Query -or $origin.Fragment -or $origin.GetLeftPart([UriPartial]::Authority) -cne $binding.origin) { throw (New-CastlinkMonitorError 'Native monitor requires a plain HTTPS origin.') }
    if ($binding.expectedInstallerSha256 -notmatch '^[a-f0-9]{64}$' -or $binding.expectedBuildId -notmatch '^[A-Za-z0-9.+-]{1,128}$' -or $state.releaseTag -cne ('server-wsl-v' + $binding.expectedBuildId)) { throw (New-CastlinkMonitorError 'Native monitor release binding does not match.') }
    foreach ($path in @([string]$binding.sourceScriptPath, (Join-Path $root 'install-server-windows.ps1'))) {
        Assert-CastlinkMonitorPlainPath $path
        if (-not (Test-Path -LiteralPath $path -PathType Leaf) -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $binding.expectedInstallerSha256) { throw (New-CastlinkMonitorError 'Original or staged installer checksum does not match.') }
    }
    return $binding
}

function Invoke-CastlinkMonitorInstaller($Binding, [ValidateSet('Status','OwnerAccess')][string]$Action) {
    $quotedScript = ([string]$Binding.sourceScriptPath).Replace("'", "''")
    $quotedRoot = ([string]$Binding.installRoot).Replace("'", "''")
    $command = "`$ErrorActionPreference='Stop'; try { & '$quotedScript' -Action $Action -InstallRoot '$quotedRoot'; if (`$LASTEXITCODE) { exit 1 } } catch { exit 1 }"
    $info = New-Object Diagnostics.ProcessStartInfo
    $info.FileName = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $info.Arguments = '-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand ' + [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
    $info.UseShellExecute = $false; $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true; $info.RedirectStandardError = $true
    $process = New-Object Diagnostics.Process
    $process.StartInfo = $info
    try {
        [void]$process.Start()
        $output = $process.StandardOutput.ReadToEndAsync(); $errors = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(120000)) { $process.Kill(); throw (New-CastlinkMonitorError 'Owned installer operation timed out.') }
        if ($process.ExitCode -ne 0 -or $output.Result.Length -gt 65536 -or $errors.Result.Length -gt 65536) { throw (New-CastlinkMonitorError 'Owned installer operation is unavailable.') }
        return $output.Result
    } finally { $process.Dispose() }
}

function Invoke-CastlinkMonitorRequest($Binding, [Net.CookieContainer]$Cookies, [string]$Path, [string]$Body = '') {
    if ($Path -notmatch '^/api/(version|super-admin-access|super-admin/metrics\?range=24h|super-admin/events\?level=all(?:&cursor=[1-9][0-9]{0,15})?)$') { throw (New-CastlinkMonitorError 'Unsupported native monitor request.') }
    $response = $null; $stream = $null; $memory = New-Object IO.MemoryStream
    try {
        # HttpWebRequest uses Windows system roots and normal hostname validation.
        $request = [Net.HttpWebRequest]::Create($Binding.origin + $Path)
        $request.AllowAutoRedirect = $false; $request.CookieContainer = $Cookies
        $request.Timeout = 10000; $request.ReadWriteTimeout = 10000
        $request.Proxy = $null
        $request.Accept = 'application/json'; $request.UserAgent = 'CastLink-Native-Monitor/1'
        if ($Body) {
            $request.Method = 'POST'; $request.ContentType = 'application/json'
            $request.Headers['Origin'] = $Binding.origin
            $bytes = [Text.Encoding]::UTF8.GetBytes($Body); $request.ContentLength = $bytes.Length
            $upload = $request.GetRequestStream()
            try { $upload.Write($bytes, 0, $bytes.Length) } finally { $upload.Dispose() }
        }
        try { $response = $request.GetResponse() }
        catch [Net.WebException] {
            $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
            if ($_.Exception.Response) { $_.Exception.Response.Dispose() }
            throw (New-CastlinkMonitorError 'Server monitoring request is unavailable or access was denied.' $status)
        }
        if ([int]$response.StatusCode -ne 200) { throw (New-CastlinkMonitorError 'Server monitoring returned an unexpected status.' ([int]$response.StatusCode)) }
        if ($response.ContentLength -gt 4194304 -or $response.ContentType -notmatch '^application/json(?:;|$)') { throw (New-CastlinkMonitorError 'Server monitoring response is invalid or too large.') }
        $stream = $response.GetResponseStream(); $buffer = New-Object byte[] 8192; $clock = [Diagnostics.Stopwatch]::StartNew()
        while (($count = $stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
            if ($memory.Length + $count -gt 4194304 -or $clock.ElapsedMilliseconds -gt 15000) { throw (New-CastlinkMonitorError 'Server monitoring response exceeded its limit.') }
            $memory.Write($buffer, 0, $count)
        }
        try { return (([Text.UTF8Encoding]::new($false, $true)).GetString($memory.ToArray()) | ConvertFrom-Json -ErrorAction Stop) }
        catch { throw (New-CastlinkMonitorError 'Server monitoring response is not valid JSON.') }
    } finally { $memory.Dispose(); if ($stream) { $stream.Dispose() }; if ($response) { $response.Dispose() } }
}

function Get-CastlinkMonitorEntropy($Binding) {
    return [Text.Encoding]::UTF8.GetBytes(($Binding.installationId + '|' + $Binding.origin + '|' + $Binding.expectedInstallerSha256))
}

function Get-CastlinkMonitorSession($Binding) {
    Add-Type -AssemblyName System.Security
    $cookies = New-Object Net.CookieContainer
    $cache = Join-Path $Binding.installRoot 'native-monitor-session.dat'
    Assert-CastlinkMonitorPlainPath $cache
    if (Test-Path -LiteralPath $cache) {
        try {
            if ((Get-Item -LiteralPath $cache).Length -gt 16384) { throw 'size' }
            $plain = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($cache), (Get-CastlinkMonitorEntropy $Binding), [Security.Cryptography.DataProtectionScope]::CurrentUser)
            $saved = [Text.Encoding]::UTF8.GetString($plain) | ConvertFrom-Json -ErrorAction Stop
            if ($saved.expiresUtcTicks -gt [DateTime]::UtcNow.Ticks -and $saved.value -match '^csa2\.[A-Za-z0-9_-]{43}$') {
                $cookie = [Net.Cookie]::new('castlink-super-admin-v2', $saved.value, '/', ([Uri]$Binding.origin).Host)
                $cookie.Secure = $true; $cookie.HttpOnly = $true
                $cookies.Add($cookie); return $cookies
            }
        } catch { } # Expired or unreadable current-user cache never grants access.
        Remove-Item -LiteralPath $cache -Force -ErrorAction Stop
    }
    $version = Invoke-CastlinkMonitorRequest $Binding $cookies '/api/version'
    if ($version.buildId -cne $Binding.expectedBuildId) { throw (New-CastlinkMonitorError 'The HTTPS server build does not match this installation.') }
    try { $status = (Invoke-CastlinkMonitorInstaller $Binding 'Status') | ConvertFrom-Json -ErrorAction Stop }
    catch { throw (New-CastlinkMonitorError 'Owned server status is unavailable.') }
    if ($status.origin -cne $Binding.origin -or $status.buildId -cne $Binding.expectedBuildId -or $status.ready -ne $true) { throw (New-CastlinkMonitorError 'Owned server origin or build does not match; server may be stopped.') }
    $before = @(Get-ChildItem -LiteralPath $Binding.installRoot -Filter 'owner-access-*.txt' -File | ForEach-Object { $_.FullName })
    $null = Invoke-CastlinkMonitorInstaller $Binding 'OwnerAccess'
    $created = @(Get-ChildItem -LiteralPath $Binding.installRoot -Filter 'owner-access-*.txt' -File | Where-Object { $before -notcontains $_.FullName })
    if ($created.Count -ne 1 -or $created[0].Name -notmatch '^owner-access-[a-f0-9]{32}\.txt$' -or $created[0].Length -gt 8192) { throw (New-CastlinkMonitorError 'Owned installer did not create one private owner invitation.') }
    $inviteFile = $created[0].FullName
    Assert-CastlinkMonitorPlainPath $inviteFile
    $uri = $null
    if (-not [Uri]::TryCreate([IO.File]::ReadAllText($inviteFile).Trim(), [UriKind]::Absolute, [ref]$uri) -or $uri.GetLeftPart([UriPartial]::Authority) -cne $Binding.origin -or $uri.AbsolutePath -cne '/super-admin' -or $uri.Query -or $uri.UserInfo -or $uri.Fragment -notmatch '^#access=(csa2\.[A-Za-z0-9_-]{43})$') { throw (New-CastlinkMonitorError 'Owned invitation origin or format does not match.') }
    $accepted = Invoke-CastlinkMonitorRequest $Binding $cookies '/api/super-admin-access' (@{action='accept';invite=$Matches[1]} | ConvertTo-Json -Compress)
    if ($accepted.allowed -ne $true) { throw (New-CastlinkMonitorError 'Owner access was not accepted.' 403) }
    Remove-Item -LiteralPath $inviteFile -Force -ErrorAction Stop
    $session = @($cookies.GetCookies([Uri]$Binding.origin) | Where-Object { $_.Name -ceq 'castlink-super-admin-v2' -and $_.Secure -and $_.HttpOnly })
    if ($session.Count -ne 1 -or $session[0].Value -notmatch '^csa2\.[A-Za-z0-9_-]{43}$' -or $session[0].Expires.ToUniversalTime() -le [DateTime]::UtcNow) { throw (New-CastlinkMonitorError 'Owner session cookie is unavailable.') }
    $bytes = [Text.Encoding]::UTF8.GetBytes((@{value=$session[0].Value;expiresUtcTicks=$session[0].Expires.ToUniversalTime().Ticks} | ConvertTo-Json -Compress))
    $protected = [Security.Cryptography.ProtectedData]::Protect($bytes, (Get-CastlinkMonitorEntropy $Binding), [Security.Cryptography.DataProtectionScope]::CurrentUser)
    [IO.File]::WriteAllBytes($cache, $protected)
    return $cookies
}

function Test-CastlinkMonitorNumber($Value) {
    return ($Value -is [byte] -or $Value -is [int16] -or $Value -is [int32] -or $Value -is [int64] -or $Value -is [single] -or $Value -is [double] -or $Value -is [decimal]) -and -not [double]::IsNaN([double]$Value) -and -not [double]::IsInfinity([double]$Value)
}

function Assert-CastlinkMonitorSnapshot($Snapshot) {
    if ($Snapshot.scope -notin @('host','wsl','container') -or $Snapshot.retentionMs -ne 86400000 -or $Snapshot.aggregation -notin @('raw','max') -or $Snapshot.intervalMs -le 0 -or $Snapshot.resolutionMs -le 0 -or -not (Test-CastlinkMonitorNumber $Snapshot.generatedAt) -or $null -eq $Snapshot.history -or @($Snapshot.history).Count -gt 20000 -or $Snapshot.storage.state -notin @('ok','unavailable')) { throw (New-CastlinkMonitorError 'Server monitoring snapshot shape is invalid.') }
    foreach ($sample in @($Snapshot.history)) { if (-not (Test-CastlinkMonitorNumber $sample.at) -or $sample.at -lt 0) { throw (New-CastlinkMonitorError 'Server monitoring sample timestamp is invalid.') } }
}

function Get-CastlinkNativeMonitorSnapshot {
    param([Parameter(Mandatory = $true)][string]$BindingFile)
    $binding = Read-CastlinkNativeMonitorBinding $BindingFile
    $lease = [IO.FileStream]::new((Join-Path $binding.installRoot 'native-monitor.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    try {
        $cookies = Get-CastlinkMonitorSession $binding
        try { $snapshot = Invoke-CastlinkMonitorRequest $binding $cookies '/api/super-admin/metrics?range=24h' }
        catch { if ($_.Exception.Data['StatusCode'] -in @(401,403)) { Remove-Item -LiteralPath (Join-Path $binding.installRoot 'native-monitor-session.dat') -Force -ErrorAction SilentlyContinue }; throw }
        Assert-CastlinkMonitorSnapshot $snapshot
        return $snapshot
    } finally { $lease.Dispose() }
}

function ConvertTo-CastlinkMonitorCsvCell($Value) {
    if ($null -eq $Value) { return '' }
    $text = if ($Value -is [ValueType]) { [Convert]::ToString($Value, [Globalization.CultureInfo]::InvariantCulture) } else { [string]$Value }
    if ($text -match '^[\s]*[=+\-@]' -and $Value -isnot [ValueType]) { $text = "'" + $text }
    return '"' + $text.Replace('"','""') + '"'
}

function ConvertTo-CastlinkMonitorMoscowTime($Milliseconds) {
    $utc = [DateTime]::SpecifyKind([DateTime]::new(1970,1,1), [DateTimeKind]::Utc).AddMilliseconds([double]$Milliseconds)
    return $utc.AddHours(3).ToString("yyyy-MM-dd HH:mm:ss 'MSK'", [Globalization.CultureInfo]::InvariantCulture)
}

function ConvertTo-CastlinkMonitorSafeEvent($Event) {
    # Fixed diagnostic types, never arbitrary identifiers, free text or credential-like strings.
    $types = @('server.observability.started','server.observability.stopped','server.observability.collection_failed','server.observability.collection_recovered','server.service.unavailable','server.service.recovered','auth.denied','auth.allowed','auth.logout','rooms.denied','rooms.mutation','rooms.mutation_failed','token.issue_failed','token.issued','browser.crash','control.rate_limited','super_admin.status_failed','super_admin.invite_accepted','super_admin.invite_created','super_admin.access_revoked','super_admin.access_failed','super_admin.overview','super_admin.overview_failed','super_admin.node_state_rejected','super_admin.node_state_failed','node.topology.denied','node.topology.allowed','node.topology.failed','control.studio_read.denied','control.studio_read.allowed','control.studio_transfer.denied','control.studio_transfer.committed','control.node.heartbeat_denied','control.node.heartbeat','control.node.heartbeat_rejected','transfer.prepare.accepted','transfer.started','transfer.start_failed','control.studios.denied','control.studios.listed','control.studios.failed','control.studio.created','control.studio_owner.checked','control.studio_owner.accepted','control.studio_owner.invite_created','control.studio_owner.revoked')
    $types += @('server.livekit.unavailable','server.livekit.unconfigured','server.livekit.recovered','server.room_store.unavailable','server.room_store.unconfigured','server.room_store.recovered','server.observability_storage.unavailable','server.observability_storage.recovered','server.uncaught_exception','server.unhandled_rejection')
    if ($Event.event -cnotin $types -or $Event.level -cnotin @('info','warn','error') -or -not (Test-CastlinkMonitorNumber $Event.at) -or $Event.at -lt 0 -or -not (Test-CastlinkMonitorNumber $Event.id) -or $Event.id -le 0) { return $null }
    $fields = [ordered]@{}
    foreach ($key in @('status','durationMs','latencyMs','count','nodes','studios','rooms','participants','tracks','success','ok','applied')) {
        $property = $Event.fields.PSObject.Properties[$key]
        if ($property -and ($property.Value -is [bool] -or (Test-CastlinkMonitorNumber $property.Value))) { $fields[$key] = $property.Value }
    }
    return [ordered]@{id=$Event.id;at=$Event.at;timeMoscow=(ConvertTo-CastlinkMonitorMoscowTime $Event.at);level=$Event.level;event=$Event.event;service='castlink-web';fields=$fields}
}

function Export-CastlinkNativeMonitorBundle {
    param([Parameter(Mandatory = $true)][string]$BindingFile, [Parameter(Mandatory = $true)][string]$Destination)
    $binding = Read-CastlinkNativeMonitorBinding $BindingFile
    Assert-CastlinkMonitorPlainPath $Destination
    if ([IO.Path]::GetExtension($Destination) -ine '.zip' -or (Test-Path -LiteralPath $Destination)) { throw (New-CastlinkMonitorError 'Choose a new ZIP destination.') }
    $lease = [IO.FileStream]::new((Join-Path $binding.installRoot 'native-monitor.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    $archive = $null; $file = $null; $complete = $false
    try {
        $cookies = Get-CastlinkMonitorSession $binding
        $snapshot = Invoke-CastlinkMonitorRequest $binding $cookies '/api/super-admin/metrics?range=24h'
        Assert-CastlinkMonitorSnapshot $snapshot
        $events = New-Object 'Collections.Generic.List[object]'; $cursor = $null; $pages = 0; $filtered = 0
        $eventStorageUnavailable = $false; $dropped = [long]$snapshot.storage.droppedEvents
        $clock = [Diagnostics.Stopwatch]::StartNew()
        do {
            if ($clock.Elapsed.TotalSeconds -gt 90) { break }
            $path = '/api/super-admin/events?level=all'; if ($null -ne $cursor) { $path += '&cursor=' + $cursor }
            $page = Invoke-CastlinkMonitorRequest $binding $cookies $path
            if ($page.retentionMs -ne 86400000 -or $null -eq $page.events -or @($page.events).Count -gt 50 -or $page.storage.state -notin @('ok','unavailable')) { throw (New-CastlinkMonitorError 'Server event snapshot shape is invalid.') }
            $pages++; $eventStorageUnavailable = $eventStorageUnavailable -or $page.storage.state -eq 'unavailable'; $dropped = [Math]::Max($dropped, [long]$page.storage.droppedEvents)
            foreach ($event in @($page.events)) {
                if ($event.at -le $snapshot.generatedAt -and $event.at -gt $snapshot.generatedAt - 86400000) {
                    $safe = ConvertTo-CastlinkMonitorSafeEvent $event
                    if ($null -eq $safe) { $filtered++ } else { $events.Add($safe) }
                }
            }
            $next = $page.nextCursor
            if ($null -ne $next -and (-not (Test-CastlinkMonitorNumber $next) -or $next -le 0 -or $next -gt 9007199254740991 -or [Math]::Floor([double]$next) -ne $next -or ($null -ne $cursor -and $next -ge $cursor))) { throw (New-CastlinkMonitorError 'Server event pagination did not advance.') }
            $cursor = $next
        } while ($null -ne $cursor -and $pages -lt 400)
        $columns = @('at','timeMoscow','from','gapBefore','cpuPercent','memoryUsedBytes','memoryTotalBytes','diskUsedBytes','diskTotalBytes','diskAvailableBytes','networkInMbps','networkOutMbps','processRssBytes','processUptimeSec','configuredRooms','activeRooms','connections','casters','web','livekit','roomStore')
        $csv = New-Object Text.StringBuilder; [void]$csv.AppendLine(($columns -join ','))
        foreach ($sample in @($snapshot.history)) {
            $values = foreach ($column in $columns) {
                $value = if ($column -eq 'timeMoscow') { ConvertTo-CastlinkMonitorMoscowTime $sample.at } elseif ($column -in @('web','livekit','roomStore')) { $service = $sample.services.PSObject.Properties[$column]; if ($service -and $service.Value -cin @('ok','unavailable','unconfigured')) { $service.Value } else { $null } } else { $property = $sample.PSObject.Properties[$column]; if ($property -and ($property.Value -is [bool] -or (Test-CastlinkMonitorNumber $property.Value))) { $property.Value } else { $null } }
                ConvertTo-CastlinkMonitorCsvCell $value
            }
            [void]$csv.AppendLine(($values -join ','))
        }
        $lines = New-Object Text.StringBuilder
        foreach ($event in @($events | Sort-Object { $_.id })) { [void]$lines.AppendLine(($event | ConvertTo-Json -Depth 5 -Compress)) }
        $summary = [ordered]@{schemaVersion=1;generatedAt=$snapshot.generatedAt;timeMoscow=(ConvertTo-CastlinkMonitorMoscowTime $snapshot.generatedAt);timezone='Europe/Moscow';windowMs=86400000;retentionMs=$snapshot.retentionMs;scope=$snapshot.scope;aggregation=$snapshot.aggregation;resolutionMs=$snapshot.resolutionMs;metricSamples=@($snapshot.history).Count;eventRecords=$events.Count;eventPages=$pages;filteredEvents=$filtered;metricsStorageUnavailable=($snapshot.storage.state -eq 'unavailable');eventsStorageUnavailable=$eventStorageUnavailable;samplerRunning=($snapshot.storage.samplerRunning -eq $true);droppedEvents=$dropped;eventsTruncated=($null -ne $cursor);historyAggregated=($snapshot.aggregation -ne 'raw');includesAllAvailableHistory=($snapshot.storage.state -eq 'ok')}
        Add-Type -AssemblyName System.IO.Compression
        $file = [IO.FileStream]::new($Destination, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
        $archive = [IO.Compression.ZipArchive]::new($file, [IO.Compression.ZipArchiveMode]::Create, $true)
        foreach ($entry in @(@('metrics.csv', $csv.ToString()), @('events.jsonl', $lines.ToString()), @('summary.json', ($summary | ConvertTo-Json -Depth 5)))) {
            $stream = $archive.CreateEntry($entry[0]).Open()
            try { $bytes = [Text.Encoding]::UTF8.GetBytes($entry[1]); $stream.Write($bytes, 0, $bytes.Length) } finally { $stream.Dispose() }
        }
        $archive.Dispose(); $archive = $null; $file.Flush($true); $complete = $true
        return [pscustomobject]$summary
    } finally {
        if ($archive) { $archive.Dispose() }; if ($file) { $file.Dispose(); if (-not $complete) { Remove-Item -LiteralPath $Destination -Force -ErrorAction SilentlyContinue } }; $lease.Dispose()
    }
}
