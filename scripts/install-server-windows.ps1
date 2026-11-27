# CastLink Server for Windows 11 x64. No Docker; an isolated WSL 2 distribution.
# Release tooling replaces these four constants. Unpackaged source cannot install.
[CmdletBinding()]
param(
    [ValidateSet('Install', 'Start', 'Stop', 'Status', 'OwnerAccess', 'Cleanup')][string]$Action = 'Install',
    [string]$Address,
    [string]$MediaIp,
    [string]$TurnHost,
    [ValidateSet('ru', 'en', 'zh-CN')][string]$Lang = 'ru',
    [string]$InstallRoot,
    [string]$ReleaseTag,
    [string]$Repository,
    [string]$PackageDirectory,
    [switch]$Help,
    [switch]$NonInteractive,
    [switch]$KeepaliveTask
)
$script:PackagedReleaseTag = '@CASTLINK_WSL_RELEASE_TAG@'
$script:PackagedRootfsSha256 = '@CASTLINK_WSL_ROOTFS_SHA256@'
$script:PackagedManifestSha256 = '@CASTLINK_WSL_MANIFEST_SHA256@'
$script:PackagedRepository = '@CASTLINK_WSL_REPOSITORY@'
$script:InstallerSourcePath = $PSCommandPath
$script:RootfsFile = 'CastLink-Server-WSL-amd64.tar.gz'

function Assert-CastlinkAddress([string]$Value) {
    if ([string]::IsNullOrWhiteSpace($Value) -or $Value.Length -gt 253 -or $Value -notmatch '^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$') {
        throw 'Enter a public hostname or IPv4 address, without protocol, port or path.'
    }
    if ($Value -match '^[0-9.]+$') {
        $ip = $null
        if (-not [Net.IPAddress]::TryParse($Value, [ref]$ip) -or $ip.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork -or $ip.ToString() -ne $Value) { throw 'Invalid IPv4 address.' }
    } else {
        foreach ($label in $Value.Split('.')) { if ($label -notmatch '^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$') { throw 'Invalid hostname.' } }
    }
}

function Read-CastlinkWslConfig([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return '' }
    $bytes = [IO.File]::ReadAllBytes($Path)
    if (($bytes.Length -ge 2 -and (($bytes[0] -eq 255 -and $bytes[1] -eq 254) -or ($bytes[0] -eq 254 -and $bytes[1] -eq 255))) -or $bytes -contains 0) {
        throw 'Please save .wslconfig as UTF-8 before configuring mirrored networking.'
    }
    try { return ([Text.UTF8Encoding]::new($false, $true)).GetString($bytes).TrimStart([char]0xFEFF) }
    catch { throw 'Please save .wslconfig as valid UTF-8 before configuring WSL networking.' }
}

function Set-CastlinkMirroredNetworking([string]$Path, [string[]]$RunningDistros, [bool]$Consent) {
    $content = Read-CastlinkWslConfig $Path
    $section = ''; $wslCount = 0; $settings = @(); $insertion = -1
    $matches = [regex]::Matches($content, '(?m)^.*(?:\r?\n|$)')
    foreach ($lineMatch in $matches) {
        $line = $lineMatch.Value.Trim()
        if ($line -match '^\[([^\]]+)\]\s*(?:[#;].*)?$') {
            if ($section -eq 'wsl2' -and $insertion -lt 0) { $insertion = $lineMatch.Index }
            $section = $Matches[1].ToLowerInvariant()
            if ($section -eq 'wsl2') { $wslCount++ }
        } elseif ($section -eq 'wsl2' -and $line -match '^networkingMode\b') {
            if ($line -notmatch '^networkingMode\s*=\s*([^#;\s]+)\s*(?:[#;].*)?$') { throw 'Malformed networkingMode setting; .wslconfig was not changed.' }
            $settings += $Matches[1].ToLowerInvariant()
        }
    }
    if ($wslCount -gt 1 -or $settings.Count -gt 1) { throw 'Ambiguous or conflicting .wslconfig sections; configure networkingMode=mirrored manually.' }
    if ($settings.Count -eq 1) {
        if ($settings[0] -ne 'mirrored') { throw 'Existing conflicting networkingMode setting; set mirrored manually after reviewing your other WSL distributions.' }
        return
    }
    if ($RunningDistros.Count -gt 0) { throw 'WSL distributions are running. Close them and restart Windows before configuring mirrored networking; the installer will not stop other distributions.' }
    if (-not $Consent) { throw 'Mirrored networking is a shared WSL setting. Review and set [wsl2] networkingMode=mirrored in .wslconfig, then rerun.' }
    $newline = "`r`n"
    if ($content.Contains("`n") -and -not $content.Contains("`r`n")) { $newline = "`n" }
    # Insert only new ASCII bytes; retain every existing byte including BOM/comments.
    $bytes = if (Test-Path -LiteralPath $Path) { [IO.File]::ReadAllBytes($Path) } else { [byte[]]@() }
    if ($wslCount -eq 0) {
        $addition = $(if ($content.Length -gt 0 -and -not $content.EndsWith("`n")) { $newline } else { '' }) + '[wsl2]' + $newline + 'networkingMode=mirrored' + $newline
        $result = [byte[]]($bytes + [Text.Encoding]::UTF8.GetBytes($addition))
    } else {
        if ($insertion -lt 0) { $insertion = $content.Length }
        $offset = [Text.Encoding]::UTF8.GetByteCount($content.Substring(0, $insertion))
        if ($bytes.Length -ge 3 -and $bytes[0] -eq 239 -and $bytes[1] -eq 187 -and $bytes[2] -eq 191) { $offset += 3 }
        $addition = $(if ($insertion -gt 0 -and $content[$insertion-1] -ne "`n") { $newline } else { '' }) + 'networkingMode=mirrored' + $newline
        $stream = New-Object IO.MemoryStream
        try { $stream.Write($bytes, 0, $offset); $extra = [Text.Encoding]::UTF8.GetBytes($addition); $stream.Write($extra, 0, $extra.Length); $stream.Write($bytes, $offset, $bytes.Length-$offset); $result = $stream.ToArray() } finally { $stream.Dispose() }
    }
    [IO.File]::WriteAllBytes($Path, $result)
}

function Set-CastlinkHostAddressLoopback([string]$Path, [string[]]$RunningDistros, [bool]$Consent) {
    $content = Read-CastlinkWslConfig $Path
    $section = ''; $sectionCount = 0; $settings = @(); $insertion = -1
    foreach ($lineMatch in [regex]::Matches($content, '(?m)^.*(?:\r?\n|$)')) {
        $line = $lineMatch.Value.Trim()
        if ($line -match '^\[([^\]]+)\]\s*(?:[#;].*)?$') {
            $name = $Matches[1].ToLowerInvariant()
            if ($name.Trim() -eq 'experimental' -and $name -ne 'experimental') { throw 'Malformed experimental section in .wslconfig; it was not changed.' }
            if ($section -eq 'experimental' -and $insertion -lt 0) { $insertion = $lineMatch.Index }
            $section = $name
            if ($section -eq 'experimental') { $sectionCount++ }
        } elseif ($line.StartsWith('[')) {
            throw 'Malformed section in .wslconfig; it was not changed.'
        } elseif ($section -eq 'experimental' -and $line -match '^hostAddressLoopback\b') {
            if ($line -notmatch '^hostAddressLoopback\s*=\s*(true|false)\s*(?:[#;].*)?$') { throw 'Malformed hostAddressLoopback setting; .wslconfig was not changed.' }
            $settings += $Matches[1].ToLowerInvariant()
        }
    }
    if ($sectionCount -gt 1 -or $settings.Count -gt 1) { throw 'Ambiguous experimental sections or duplicate hostAddressLoopback settings; .wslconfig was not changed.' }
    if ($settings.Count -eq 1) {
        if ($settings[0] -ne 'true') { throw 'Existing conflicting hostAddressLoopback=false; review your other WSL distributions and configure it manually.' }
        return
    }
    if ($RunningDistros.Count -gt 0) { throw 'WSL distributions are running. Close them and restart Windows before changing hostAddressLoopback; the installer will not stop other distributions.' }
    if (-not $Consent) { throw 'Host IPv4 access is a shared WSL setting. Review and set [experimental] hostAddressLoopback=true in .wslconfig, then rerun.' }
    $newline = "`r`n"
    if ($content.Contains("`n") -and -not $content.Contains("`r`n")) { $newline = "`n" }
    # Preserve the original bytes; insert only the new ASCII setting/section.
    $bytes = if (Test-Path -LiteralPath $Path) { [IO.File]::ReadAllBytes($Path) } else { [byte[]]@() }
    if ($sectionCount -eq 0) {
        $addition = $(if ($content.Length -gt 0 -and -not $content.EndsWith("`n")) { $newline } else { '' }) + '[experimental]' + $newline + 'hostAddressLoopback=true' + $newline
        $result = [byte[]]($bytes + [Text.Encoding]::UTF8.GetBytes($addition))
    } else {
        if ($insertion -lt 0) { $insertion = $content.Length }
        $offset = [Text.Encoding]::UTF8.GetByteCount($content.Substring(0, $insertion))
        if ($bytes.Length -ge 3 -and $bytes[0] -eq 239 -and $bytes[1] -eq 187 -and $bytes[2] -eq 191) { $offset += 3 }
        $addition = $(if ($insertion -gt 0 -and $content[$insertion-1] -ne "`n") { $newline } else { '' }) + 'hostAddressLoopback=true' + $newline
        $stream = New-Object IO.MemoryStream
        try { $stream.Write($bytes, 0, $offset); $extra = [Text.Encoding]::UTF8.GetBytes($addition); $stream.Write($extra, 0, $extra.Length); $stream.Write($bytes, $offset, $bytes.Length-$offset); $result = $stream.ToArray() } finally { $stream.Dispose() }
    }
    [IO.File]::WriteAllBytes($Path, $result)
}

function Initialize-CastlinkWslNetworking([string]$Path, [string[]]$RunningDistros, [bool]$AllowPrompt) {
    $consented = $false
    while ($true) {
        # Check both settings before either writer can change the shared file.
        $missing = $false
        try { Set-CastlinkMirroredNetworking $Path $RunningDistros $false } catch {
            if ($_.Exception.Message -notlike 'Mirrored networking is a shared*') { throw }
            $missing = $true
        }
        try { Set-CastlinkHostAddressLoopback $Path $RunningDistros $false } catch {
            if ($_.Exception.Message -notlike 'Host IPv4 access is a shared*') { throw }
            $missing = $true
        }
        if (-not $missing) { return }
        if ($consented) {
            Set-CastlinkMirroredNetworking $Path $RunningDistros $true
            Set-CastlinkHostAddressLoopback $Path $RunningDistros $true
            throw 'Shared WSL settings saved. Restart Windows, or wait until the shared WSL VM has fully stopped, then rerun this command before importing or starting CastLink.'
        }
        if (-not $AllowPrompt) { throw 'Required shared WSL networking settings are missing. Run Install interactively or review networkingMode=mirrored and [experimental] hostAddressLoopback=true manually; .wslconfig was not changed.' }
        Write-Host 'CastLink requires mirrored networking and Windows host IPv4 access between Windows and WSL. These shared .wslconfig settings apply to all your WSL 2 distributions.'
        if ((Read-Host 'Add missing networkingMode=mirrored and hostAddressLoopback=true settings? [y/N]') -notmatch '^(y|yes)$') { throw 'Shared WSL networking consent declined; .wslconfig was not changed.' }
        # A distribution may have started while the consent prompt was open.
        $RunningDistros = @(Get-CastlinkDistros -Running)
        $consented = $true
    }
}

function Save-CastlinkInstallation([string]$Root, $State) {
    $path = Join-Path $Root 'installation.json'
    $temporary = Join-Path $Root 'installation.json.new'
    [IO.File]::WriteAllText($temporary, ($State | ConvertTo-Json -Depth 5), (New-Object Text.UTF8Encoding($false)))
    if (Test-Path -LiteralPath $path) {
        $replaceClock = [Diagnostics.Stopwatch]::StartNew()
        while ($true) {
            try { [IO.File]::Replace($temporary, $path, [NullString]::Value); break }
            catch {
                $cause = $_.Exception
                while ($cause.InnerException) { $cause = $cause.InnerException }
                # Readers outside the writer lease can briefly deny deletion of the old file.
                if ($cause -isnot [IO.IOException] -or ($cause.HResult -band 0x7fffffff) -notin @(0x70020,0x70021) -or $replaceClock.ElapsedMilliseconds -ge 2000) { throw }
                Start-Sleep -Milliseconds 50
            }
        }
    } else { [IO.File]::Move($temporary, $path) }
}

function Get-CastlinkInstallation([string]$Root, [string]$Tag, [string]$Repo, [string]$RootfsHash) {
    $statePath = Join-Path $Root 'installation.json'
    if (Test-Path -LiteralPath $statePath) {
        $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
        if ($state.schemaVersion -ne 1 -or $state.phase -notin @('created','imported','ready') -or $state.installationId -notmatch '^[a-f0-9]{32}$' -or $state.distroName -cne ('CastLink-Server-' + $state.installationId.Substring(0,12)) -or $state.rootPath -cne [IO.Path]::GetFullPath($Root)) { throw 'Installation identity is invalid; no distribution was changed.' }
        if ($state.releaseTag -cne $Tag -or $state.repository -cne $Repo -or $state.rootfsSha256 -cne $RootfsHash) { throw 'This directory belongs to a different release. Use its original installer; upgrades are not supported by this first installer.' }
        return $state
    }
    if ((Test-Path -LiteralPath $Root) -and @(Get-ChildItem -LiteralPath $Root -Force).Count -gt 0) { throw 'InstallRoot contains foreign files. Choose an empty CastLink directory.' }
    $id = [guid]::NewGuid().ToString('N')
    return [pscustomobject]@{schemaVersion=1;installationId=$id;distroName=('CastLink-Server-'+$id.Substring(0,12));rootPath=[IO.Path]::GetFullPath($Root);releaseTag=$Tag;repository=$Repo;rootfsSha256=$RootfsHash;releaseManifestSha256=$script:PackagedManifestSha256;phase='created'}
}

function Assert-CastlinkPackage([string]$Directory, [string]$Tag, [string]$Repo, [string]$RootfsHash, [string]$ManifestHash) {
    $manifestPath = Join-Path $Directory 'manifest.json'
    $rootfsPath = Join-Path $Directory $script:RootfsFile
    foreach ($entry in @(@($manifestPath,$ManifestHash,1048576), @($rootfsPath,$RootfsHash,12884901888))) {
        if (-not (Test-Path -LiteralPath $entry[0] -PathType Leaf) -or (Get-Item -LiteralPath $entry[0]).Length -gt $entry[2] -or (Get-FileHash -LiteralPath $entry[0] -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry[1]) { throw 'Release checksum or size verification failed. Nothing was imported.' }
    }
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    if ($manifest.schemaVersion -ne 1 -or $manifest.sourceCommit -notmatch '^[a-f0-9]{40}$' -or $manifest.releaseTag -cne ('server-wsl-v'+$manifest.version+'-'+$manifest.sourceCommit.Substring(0,12)) -or $manifest.rootfs.size -ne (Get-Item -LiteralPath $rootfsPath).Length -or $manifest.channel -cne 'server-wsl' -or $manifest.architecture -cne 'amd64' -or $manifest.releaseTag -cne $Tag -or $manifest.repository -cne $Repo -or $manifest.rootfs.file -cne $script:RootfsFile -or $manifest.rootfs.sha256 -cne $RootfsHash) { throw 'Release manifest identity does not match the pinned installer.' }
}

function Receive-CastlinkAsset([string]$Url, [string]$Path, [long]$Limit) {
    $request = [Net.HttpWebRequest]::Create($Url)
    $request.UserAgent = 'CastLink-Windows-Server-Installer/1'
    $request.Timeout = 60000; $request.ReadWriteTimeout = 60000
    $response = $null; $inputStream = $null; $outputStream = $null
    try {
        $response = $request.GetResponse()
        if ($response.ResponseUri.Scheme -ne 'https' -or $response.ContentLength -gt $Limit) { throw 'Release download exceeded its allowed size or used an insecure redirect.' }
        $inputStream = $response.GetResponseStream()
        $outputStream = [IO.File]::Create($Path)
        $buffer = New-Object byte[] 1048576; $total = 0L; $timer = [Diagnostics.Stopwatch]::StartNew()
        while (($count = $inputStream.Read($buffer,0,$buffer.Length)) -gt 0) {
            $total += $count
            if ($total -gt $Limit -or $timer.Elapsed.TotalMinutes -gt 30) { throw 'Release download exceeded its size or time limit.' }
            $outputStream.Write($buffer,0,$count)
        }
    } finally { if ($outputStream) { $outputStream.Dispose() }; if ($inputStream) { $inputStream.Dispose() }; if ($response) { $response.Dispose() } }
}

function Invoke-CastlinkWsl([string[]]$Arguments) {
    & $script:WslExe @Arguments
    if ($LASTEXITCODE -ne 0) { throw "WSL command failed (exit $LASTEXITCODE). No other distribution was changed." }
}

function Get-CastlinkDistros([switch]$Running) {
    $arguments = @('--list','--quiet')
    if ($Running) { $arguments += '--running' }
    $result = @(Invoke-CastlinkWsl $arguments)
    return @($result | ForEach-Object { ($_ -replace "`0", '').Trim() } | Where-Object { $_ })
}

function Assert-CastlinkGuestIdentity($State) {
    $identity = @(Invoke-CastlinkWsl @('--distribution',$State.distroName,'--user','root','--exec','cat','/var/lib/castlink-server-wsl-installation-id')) -join ''
    if ($identity.Trim() -cne $State.installationId) { throw 'WSL distribution ownership could not be verified. Refusing to adopt or alter it.' }
}

function Assert-CastlinkMirroredRuntime($State) {
    $mode = @(Invoke-CastlinkWsl @('--distribution',$State.distroName,'--user','root','--exec','/usr/bin/wslinfo','--networking-mode')) -join ''
    if ($mode.Trim() -cne 'mirrored') { throw 'WSL is not currently using mirrored networking. Restart Windows, then rerun this command. Other distributions were not stopped.' }
}

function Get-CastlinkKeepaliveArguments($State) {
    if ($State.distroName -cne ('CastLink-Server-'+$State.installationId.Substring(0,12))) { throw 'Invalid keepalive distribution identity.' }
    return '--distribution '+$State.distroName+' --user root --exec /bin/sleep infinity'
}

function Get-CastlinkKeepaliveHandle([int]$ProcessId) {
    try {
        $process = [Diagnostics.Process]::GetProcessById($ProcessId)
        # Hold a Windows process handle before checking identity, including against PID reuse.
        [void]$process.Handle
        return $process
    } catch { return $null }
}

function Get-CastlinkProcessEvidence([int]$ProcessId) {
    return Get-CimInstance Win32_Process -Filter ('ProcessId = '+$ProcessId) -ErrorAction SilentlyContinue
}

function Get-CastlinkKeepaliveProcess($State) {
    if (-not $State.PSObject.Properties['keepalive'] -or -not $State.keepalive) { return $null }
    $receipt = $State.keepalive
    if ($receipt.processId -le 0 -or $receipt.startTimeUtcTicks -notmatch '^\d+$') { return $null }
    $process = Get-CastlinkKeepaliveHandle ([int]$receipt.processId)
    if (-not $process) { return $null }
    $accepted = $false
    try {
        if ($process.HasExited -or $process.StartTime.ToUniversalTime().Ticks.ToString() -cne $receipt.startTimeUtcTicks) { return $null }
        $evidence = Get-CastlinkProcessEvidence ([int]$receipt.processId)
        $arguments = Get-CastlinkKeepaliveArguments $State
        $quotedPrefix = '"'+$script:WslExe+'" '
        $unquotedPrefix = $script:WslExe+' '
        $commandMatches = $false
        if ($evidence -and $evidence.CommandLine) {
            foreach ($prefix in @($quotedPrefix,$unquotedPrefix)) {
                if ($evidence.CommandLine.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase) -and $evidence.CommandLine.Substring($prefix.Length).TrimEnd([char]32) -ceq $arguments) { $commandMatches = $true }
            }
        }
        # CIM represents creation timestamps at microsecond precision; compare that
        # precision while the held process handle retains the full timestamp.
        if (-not $evidence -or $evidence.ExecutablePath -ine $script:WslExe -or -not $commandMatches -or $evidence.CreationDate.ToUniversalTime().ToString('yyyyMMddHHmmssffffff') -cne ([DateTime]::new([long]$receipt.startTimeUtcTicks,[DateTimeKind]::Utc)).ToString('yyyyMMddHHmmssffffff')) { return $null }
        $accepted = $true
        return $process
    } catch { return $null } finally { if (-not $accepted) { $process.Dispose() } }
}

function Assert-CastlinkKeepaliveAlive($State) {
    $process = Get-CastlinkKeepaliveProcess $State
    if (-not $process) { throw 'The owned WSL keepalive is not running. Server readiness was not confirmed.' }
    $process.Dispose()
}

function Start-CastlinkKeepalive([string]$Root, $State) {
    $existing = Get-CastlinkKeepaliveProcess $State
    if ($existing) { $existing.Dispose(); return }
    Assert-CastlinkGuestIdentity $State
    $process = Start-Process -FilePath $script:WslExe -ArgumentList (Get-CastlinkKeepaliveArguments $State) -WindowStyle Hidden -PassThru
    try {
        if ($process.WaitForExit(1500)) { throw 'WSL keepalive exited before the server could remain running.' }
        $receipt = [pscustomobject]@{processId=$process.Id;startTimeUtcTicks=$process.StartTime.ToUniversalTime().Ticks.ToString()}
        $State | Add-Member NoteProperty keepalive $receipt -Force
        Save-CastlinkInstallation $Root $State
        Assert-CastlinkKeepaliveAlive $State
    } finally { $process.Dispose() }
}

function Stop-CastlinkKeepalive([string]$Root, $State) {
    if (-not $State.PSObject.Properties['keepalive'] -or -not $State.keepalive) { return }
    $process = Get-CastlinkKeepaliveProcess $State
    if ($process) {
        try { $process.Kill(); if (-not $process.WaitForExit(10000)) { throw 'Owned keepalive did not stop.' } } finally { $process.Dispose() }
    } elseif (Get-CastlinkProcessEvidence ([int]$State.keepalive.processId)) { throw 'Keepalive process identity is not owned by this installation. No process was stopped.' }
    $State | Add-Member NoteProperty keepalive $null -Force
    Save-CastlinkInstallation $Root $State
}

function Stage-CastlinkPinnedInstaller([string]$Root, [string]$SourcePath) {
    $target = Join-Path $Root 'install-server-windows.ps1'
    $hash = (Get-FileHash -LiteralPath $SourcePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if (Test-Path -LiteralPath $target) {
        if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -cne $hash) { throw 'A different staged installer already exists. It was preserved.' }
    } else {
        $bytes = [IO.File]::ReadAllBytes($SourcePath)
        $stream = [IO.FileStream]::new($target,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
        try { $stream.Write($bytes,0,$bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
    }
    Initialize-CastlinkLegacyRetention $Root
    return $target
}

function Build-CastlinkNativePanelHost([string]$Directory, [string]$Output) {
    # The compiler helper requires .NET Framework's csc.exe even when the installer
    # was invoked from PowerShell 7. Pass paths as native argv, never command text.
    $powershell = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $helper = Join-Path $Directory 'build-server-native-panel-host.ps1'
    & $powershell -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $helper -Output $Output
    if ($LASTEXITCODE -ne 0) { throw 'Native panel compiler child failed.' }
    if (-not (Test-Path -LiteralPath $Output -PathType Leaf)) { throw 'Native panel compiler did not produce its Windows host.' }
}

function Assert-CastlinkNativePanelReceipt([string]$Root, $State) {
    if (-not $State.PSObject.Properties['nativePanel'] -or -not $State.nativePanel) { throw 'This installation has no staged native panel.' }
    $panel = $State.nativePanel
    $directory = Join-Path $Root 'native-panel'
    if ($panel.schemaVersion -ne 1 -or $panel.hostPath -cne (Join-Path $directory 'CastLinkServer.exe') -or $panel.bindingPath -cne (Join-Path $directory 'server-native-binding.json') -or $panel.manifestSha256 -cne $script:PackagedManifestSha256) { throw 'Native panel installation identity differs; no panel or task was changed.' }
    foreach ($entry in @(@($panel.hostPath,$panel.hostSha256), @($panel.bindingPath,$panel.bindingSha256))) {
        if ($entry[1] -notmatch '^[a-f0-9]{64}$' -or -not (Test-Path -LiteralPath $entry[0] -PathType Leaf) -or (Get-FileHash -LiteralPath $entry[0] -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry[1]) { throw 'Native panel checksum verification failed.' }
    }
    return $panel
}

function Prepare-CastlinkNativePanel([string]$Root, $State, $Status, [string]$Directory, [string]$SourcePath, [bool]$AllowDownload) {
    $manifestPath = Join-Path $Directory 'manifest.json'
    $url = 'https://github.com/'+$script:PackagedRepository+'/releases/download/'+$script:PackagedReleaseTag+'/'
    if ($AllowDownload) {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        [void][IO.Directory]::CreateDirectory($Directory)
        if (-not (Test-Path -LiteralPath $manifestPath)) { Receive-CastlinkAsset ($url+'manifest.json') $manifestPath 1048576 }
    }
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf) -or (Get-Item -LiteralPath $manifestPath).Length -gt 1048576 -or (Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $script:PackagedManifestSha256) { throw 'Pinned native panel manifest checksum verification failed.' }
    $manifest = [IO.File]::ReadAllText($manifestPath) | ConvertFrom-Json
    if ($manifest.schemaVersion -ne 1 -or $manifest.channel -cne 'server-wsl' -or $manifest.releaseTag -cne $State.releaseTag -or $manifest.releaseTag -cne $script:PackagedReleaseTag -or $manifest.repository -cne $script:PackagedRepository -or $manifest.rootfs.sha256 -cne $State.rootfsSha256) { throw 'Native panel manifest does not belong to this installed release.' }
    # Old manifests continue to use the original console controller and logon task.
    if (-not $manifest.PSObject.Properties['nativePanel']) { return $null }
    $bundle = $manifest.nativePanel
    $names = @('server-native-panel-files.json','server-native-control.ps1','server-native-monitor.ps1','simple-easy-setup-control.ps1','simple-easy-setup-language.ps1','simple-easy-setup-network.ps1','simple-easy-setup-control.ico','server-native-panel-host.cs','build-server-native-panel-host.ps1')
    if ($manifest.PSObject.Properties['lifecycle']) { $names += @('server-wsl-maintenance.ps1','server-wsl-maintenance-ui.ps1') }
    if ('castlink-updater.ps1' -cin @($bundle.files|ForEach-Object {$_.file})) { $names += @('castlink-updater.ps1') }
    if ($bundle.schemaVersion -ne 1 -or $bundle.host -cne 'CastLinkServer.exe' -or $bundle.binding -cne 'server-native-binding.json' -or @($bundle.files).Count -ne $names.Count) { throw 'Native panel helper inventory is invalid.' }
    $seen = @{}
    foreach ($entry in $bundle.files) {
        if ($entry.file -cnotin $names -or $seen.ContainsKey($entry.file) -or $entry.sha256 -notmatch '^[a-f0-9]{64}$' -or $entry.size -le 0 -or $entry.size -gt 4194304) { throw 'Native panel helper inventory is invalid.' }
        $seen[$entry.file] = $true
        $source = Join-Path $Directory $entry.file
        $valid = (Test-Path -LiteralPath $source -PathType Leaf) -and (Get-Item -LiteralPath $source).Length -eq $entry.size -and (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant() -ceq $entry.sha256
        if (-not $valid -and $AllowDownload) { Receive-CastlinkAsset ($url+$entry.file) $source $entry.size }
        if (-not (Test-Path -LiteralPath $source -PathType Leaf) -or (Get-Item -LiteralPath $source).Length -ne $entry.size -or (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256) { throw 'Native panel helper checksum verification failed.' }
    }
    $panelRoot = Join-Path $Root 'native-panel'
    if (Test-Path -LiteralPath $panelRoot) {
        if ((Get-Item -LiteralPath $panelRoot -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Native panel directory cannot use a link.' }
        foreach ($existing in Get-ChildItem -LiteralPath $panelRoot -Force) {
            if ($existing.Name -cnotin ($names+@($bundle.host,$bundle.binding)) -or $existing.PSIsContainer -or ($existing.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Native panel directory contains unknown files; they were preserved.' }
        }
    } else { [void][IO.Directory]::CreateDirectory($panelRoot) }
    foreach ($entry in $bundle.files) {
        $target = Join-Path $panelRoot $entry.file
        if (Test-Path -LiteralPath $target) {
            if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256) { throw 'A different staged panel helper exists; it was preserved.' }
        } else { [IO.File]::Copy((Join-Path $Directory $entry.file),$target,$false) }
    }
    $stagedInstaller = Stage-CastlinkPinnedInstaller $Root $SourcePath
    $installerHash = (Get-FileHash -LiteralPath $stagedInstaller -Algorithm SHA256).Hash.ToLowerInvariant()
    $hostPath = Join-Path $panelRoot $bundle.host
    $bindingPath = Join-Path $panelRoot $bundle.binding
    if ($State.PSObject.Properties['nativePanel'] -and $State.nativePanel) {
        return Assert-CastlinkNativePanelReceipt $Root $State
    }
    if ((Test-Path -LiteralPath $hostPath) -or (Test-Path -LiteralPath $bindingPath)) { throw 'An unrecorded panel host or binding exists; it was preserved.' }
    if ($Status.buildId -cne ($State.releaseTag -creplace '^server-wsl-v','') -or $Status.ready -ne $true) { throw 'Native panel requires a verified matching ready server.' }
    Build-CastlinkNativePanelHost $panelRoot $hostPath
    $binding = [ordered]@{installationId=$State.installationId;installRoot=$Root;origin=$Status.origin;expectedBuildId=$Status.buildId;sourceScriptPath=$stagedInstaller;expectedInstallerSha256=$installerHash}
    $updaterEntry = $bundle.files | Where-Object { $_.file -ceq 'castlink-updater.ps1' }
    if ($updaterEntry) { $binding.expectedUpdaterSha256 = $updaterEntry.sha256 }
    Write-CastlinkPrivateFile $bindingPath ($binding | ConvertTo-Json)
    $panel = [pscustomobject]@{schemaVersion=1;hostPath=$hostPath;bindingPath=$bindingPath;hostSha256=(Get-FileHash -LiteralPath $hostPath -Algorithm SHA256).Hash.ToLowerInvariant();bindingSha256=(Get-FileHash -LiteralPath $bindingPath -Algorithm SHA256).Hash.ToLowerInvariant();manifestSha256=$script:PackagedManifestSha256}
    $State | Add-Member NoteProperty nativePanel $panel -Force
    Save-CastlinkInstallation $Root $State
    return $panel
}

function Open-CastlinkNativePanel([string]$Root, $State) {
    $panel = Assert-CastlinkNativePanelReceipt $Root $State
    $process = Start-Process -FilePath $panel.hostPath -ArgumentList ('--binding "'+$panel.bindingPath+'"') -PassThru
    try { if ($process.WaitForExit(1500) -and $process.ExitCode -ne 0) { throw 'The native panel exited without opening. Server services remain running.' } } finally { $process.Dispose() }
}

function Get-CastlinkCurrentUserSid {
    return [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
}

function Get-CastlinkLogonTaskSpec([string]$Root, $State, [string]$SourcePath) {
    $staged = Join-Path $Root 'install-server-windows.ps1'
    $hash = (Get-FileHash -LiteralPath $SourcePath -Algorithm SHA256).Hash.ToLowerInvariant()
    $mode = if ($State.PSObject.Properties['logonTaskMode']) { [string]$State.logonTaskMode } elseif ($State.PSObject.Properties['autoStartAtLogon'] -and $State.autoStartAtLogon) { 'installer' } elseif ($State.PSObject.Properties['nativePanel'] -and $State.nativePanel) { 'native-panel' } else { 'installer' }
    if ($mode -cnotin @('installer','native-panel')) { throw 'Unknown recorded logon task mode.' }
    $spec = [pscustomobject]@{
        mode=$mode
        taskName=('CastLink-Server-'+$State.installationId+'-Start')
        taskPath='\'
        userSid=(Get-CastlinkCurrentUserSid)
        execute=(Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe')
        arguments=('-NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+$staged+'" -Action Start -InstallRoot "'+$Root+'" -NonInteractive -KeepaliveTask')
        stagedPath=$staged
        sha256=$hash
        description=('CastLink owned installation '+$State.installationId+'; script SHA256 '+$hash)
    }
    if ($mode -ceq 'native-panel') {
        $panel = Assert-CastlinkNativePanelReceipt $Root $State
        $spec.execute = $panel.hostPath
        $spec.arguments = '--binding "'+$panel.bindingPath+'" --startup'
        $spec.description += '; panel SHA256 '+$panel.hostSha256
    }
    return $spec
}

function Test-CastlinkAccountSid([string]$Identity, [string]$ExpectedSid) {
    try {
        $sid = if ($Identity -match '^S-\d-') { [Security.Principal.SecurityIdentifier]::new($Identity) } else { ([Security.Principal.NTAccount]::new($Identity)).Translate([Security.Principal.SecurityIdentifier]) }
        return $sid.Value -ceq $ExpectedSid
    } catch { return $false }
}

function Assert-CastlinkLogonTask($Task, $Spec) {
    if (-not $Task) { return }
    if ($Task.TaskName -cne $Spec.taskName -or $Task.TaskPath -cne $Spec.taskPath -or $Task.Description -cne $Spec.description -or -not (Test-CastlinkAccountSid $Task.Principal.UserId $Spec.userSid) -or [string]$Task.Principal.LogonType -notin @('Interactive','InteractiveToken') -or [string]$Task.Principal.RunLevel -notin @('Limited','LUA') -or @($Task.Actions).Count -ne 1 -or $Task.Actions[0].Execute -ine $Spec.execute -or $Task.Actions[0].Arguments -cne $Spec.arguments -or @($Task.Triggers).Count -ne 1 -or -not (Test-CastlinkAccountSid $Task.Triggers[0].UserId $Spec.userSid) -or $Task.Triggers[0].CimClass.CimClassName -cne 'MSFT_TaskLogonTrigger' -or -not $Task.Triggers[0].Enabled -or -not $Task.Settings.Enabled -or [string]$Task.Settings.ExecutionTimeLimit -cne 'PT0S' -or [string]$Task.Settings.MultipleInstances -cne 'IgnoreNew') { throw 'A conflicting scheduled task already exists. It was preserved; no task or script was changed.' }
}

function Register-CastlinkLogonTask([string]$Root, $State, [string]$SourcePath) {
    $spec = Get-CastlinkLogonTaskSpec $Root $State $SourcePath
    $existing = Get-ScheduledTask -TaskName $spec.taskName -TaskPath $spec.taskPath -ErrorAction SilentlyContinue
    Assert-CastlinkLogonTask $existing $spec
    $null = Stage-CastlinkPinnedInstaller $Root $SourcePath
    if (-not $existing) {
        $taskAction = New-ScheduledTaskAction -Execute $spec.execute -Argument $spec.arguments
        $trigger = New-ScheduledTaskTrigger -AtLogOn -User $spec.userSid
        $principal = New-ScheduledTaskPrincipal -UserId $spec.userSid -LogonType Interactive -RunLevel Limited
        $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval ([TimeSpan]::FromMinutes(1))
        Register-ScheduledTask -TaskName $spec.taskName -TaskPath $spec.taskPath -Description $spec.description -Action $taskAction -Trigger $trigger -Principal $principal -Settings $settings | Out-Null
        Assert-CastlinkLogonTask (Get-ScheduledTask -TaskName $spec.taskName -TaskPath $spec.taskPath) $spec
    }
    $State | Add-Member NoteProperty logonTaskMode $spec.mode -Force
    $State | Add-Member NoteProperty autoStartAtLogon $true -Force
    Save-CastlinkInstallation $Root $State
    Write-Host 'CastLink will start for your Windows user at sign-in. The task uses only this owned installation and stores no password.'
}

function Wait-CastlinkScheduledKeepalive {
    # Invoked after releasing the installation lease so Stop can operate normally.
    $state = Get-CastlinkInstallation $InstallRoot $script:PackagedReleaseTag $script:PackagedRepository $script:PackagedRootfsSha256
    $process = Get-CastlinkKeepaliveProcess $state
    if (-not $process) {
        # Stop can win the race immediately after Start releases its lease.
        $current = Get-CastlinkInstallation $InstallRoot $script:PackagedReleaseTag $script:PackagedRepository $script:PackagedRootfsSha256
        if ($current.PSObject.Properties['desiredRunning'] -and -not $current.desiredRunning) { return }
        throw 'Scheduled WSL keepalive was not established.'
    }
    try { $process.WaitForExit() } finally { $process.Dispose() }
    $current = Get-CastlinkInstallation $InstallRoot $script:PackagedReleaseTag $script:PackagedRepository $script:PackagedRootfsSha256
    if ($current.PSObject.Properties['desiredRunning'] -and $current.desiredRunning) { throw 'WSL keepalive exited unexpectedly; the task may retry.' }
}

function Protect-CastlinkInstallationDirectory([string]$Root) {
    # Only the proven owned installation directory is changed; never its ancestors.
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    # Grant the private DACL first: an existing owner may have WRITE_DAC without WRITE_OWNER.
    $acl = ([IO.DirectoryInfo]::new($Root)).GetAccessControl([Security.AccessControl.AccessControlSections]'Access, Owner')
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($existingRule in @($acl.Access)) { [void]$acl.RemoveAccessRuleSpecific($existingRule) }
    $inheritance = [Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit'
    foreach ($principal in @($sid, [Security.Principal.SecurityIdentifier]::new('S-1-5-18'))) {
        $rule = [Security.AccessControl.FileSystemAccessRule]::new($principal, [Security.AccessControl.FileSystemRights]::FullControl, $inheritance, [Security.AccessControl.PropagationFlags]::None, [Security.AccessControl.AccessControlType]::Allow)
        [void]$acl.AddAccessRule($rule)
    }
    $directory = [IO.DirectoryInfo]::new($Root)
    $directory.SetAccessControl($acl)
    $ownerAcl = $directory.GetAccessControl([Security.AccessControl.AccessControlSections]::Owner)
    if ($ownerAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value -cne $sid.Value) {
        # Elevated Windows tokens can create directories owned by Administrators.
        # The preceding DACL grant makes a necessary take-ownership-to-self legal.
        $ownerAcl.SetOwner($sid)
        $directory.SetAccessControl($ownerAcl)
    }
    $verified = $directory.GetAccessControl([Security.AccessControl.AccessControlSections]'Access, Owner')
    if (-not $verified.AreAccessRulesProtected -or $verified.GetOwner([Security.Principal.SecurityIdentifier]).Value -cne $sid.Value) {
        throw 'The owned installation directory could not be secured for the current Windows user.'
    }
}

function Write-CastlinkPrivateFile([string]$Path, [string]$Content) {
    # The owned parent has a current-user/SYSTEM ACL before a secret is created.
    $stream = [IO.FileStream]::new($Path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes($Content)
        $stream.Write($bytes, 0, $bytes.Length)
        $stream.Flush($true)
    } finally { $stream.Dispose() }
}

function Export-CastlinkOwnerAccess([string]$Root, $State) {
    Assert-CastlinkGuestIdentity $State
    $metadata = (@(Invoke-CastlinkWsl @('--distribution',$State.distroName,'--user','root','--exec','/usr/local/bin/castlink-server','owner-access')) -join "`n") | ConvertFrom-Json
    if ($metadata.expiresInSeconds -ne 900 -or $metadata.ownerAccessFile -notmatch '^/var/lib/castlink-server/owner-access-[A-Za-z0-9-]+\.txt$') { throw 'Unexpected protected owner access file response.' }
    $content = @(Invoke-CastlinkWsl @('--distribution',$State.distroName,'--user','root','--exec','cat',$metadata.ownerAccessFile)) -join "`n"
    $uri = $null
    if ($content.Length -gt 8192 -or -not [Uri]::TryCreate($content.Trim(),[UriKind]::Absolute,[ref]$uri) -or $uri.Scheme -cne 'https' -or $uri.AbsolutePath -cne '/super-admin' -or -not $uri.Fragment.StartsWith('#access=') -or $uri.UserInfo) { throw 'Invalid owner access file. Its content was not printed.' }
    $path = Join-Path $Root ('owner-access-'+[guid]::NewGuid().ToString('N')+'.txt')
    Write-CastlinkPrivateFile $path ($content.Trim()+"`r`n")
    Write-Host ('Private owner access saved to: '+$path)
    Write-Host 'Open this file locally and follow its link to /super-admin. The invitation is single use and expires in 15 minutes. Do not share the file.'
}

function Get-CastlinkPublicCertificate([string]$Content) {
    if ($Content.Length -gt 32768 -or $Content -notmatch '^\s*-----BEGIN CERTIFICATE-----\s+([A-Za-z0-9+/=\r\n]+)\s+-----END CERTIFICATE-----\s*$') { throw 'Only a public PEM certificate can be imported; no private key or other material is accepted.' }
    $certificate = [Security.Cryptography.X509Certificates.X509Certificate2]::new([Convert]::FromBase64String(($Matches[1] -replace '\s','')))
    $extension = @($certificate.Extensions | Where-Object { $_.Oid.Value -eq '2.5.29.19' })
    if ($extension.Count -ne 1) { throw 'The exported certificate is not a CA certificate.' }
    $constraints = [Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($extension[0],$extension[0].Critical)
    if (-not $constraints.CertificateAuthority -or $certificate.Subject -cne $certificate.Issuer -or $certificate.HasPrivateKey -or $certificate.NotAfter -le [DateTime]::Now -or $certificate.NotBefore -gt [DateTime]::Now) { throw 'The exported certificate is not a current public root CA.' }
    return $certificate
}

function Export-CastlinkCertificate([string]$Root, $State, $Status) {
    if (-not $Status.caPath) { return }
    if ($Status.caPath -cne '/var/lib/castlink-server/data/server-origin-ca.pem' -and $Status.caPath -cne '/var/lib/castlink-server/caddy/caddy/pki/authorities/local/root.crt') { throw 'Unexpected public certificate location in server status.' }
    $content = @(Invoke-CastlinkWsl @('--distribution',$State.distroName,'--user','root','--exec','cat',$Status.caPath)) -join "`n"
    $certificate = Get-CastlinkPublicCertificate $content
    try {
        $path = Join-Path $Root ('server-origin-ca-'+$certificate.Thumbprint.ToLowerInvariant()+'.pem')
        if (-not (Test-Path -LiteralPath $path)) { Write-CastlinkPrivateFile $path ($content.Trim()+"`r`n") } else {
            $existingCertificate = Get-CastlinkPublicCertificate ([IO.File]::ReadAllText($path))
            try {
                if ([Convert]::ToBase64String($existingCertificate.RawData) -cne [Convert]::ToBase64String($certificate.RawData)) { throw 'Existing certificate file differs from the verified server CA; it was preserved.' }
            } finally { $existingCertificate.Dispose() }
        }
        Write-Host ('This server uses a private HTTPS CA. Public certificate saved to: '+$path)
        Write-Host ('CA fingerprint (SHA-1): '+$certificate.Thumbprint)
        if ((Read-Host 'Trust this server CA for your current Windows user? [y/N]') -match '^(y|yes)$') {
            # Import only the verified public certificate into this user's store.
            Import-Certificate -FilePath $path -CertStoreLocation 'Cert:\CurrentUser\Root' | Out-Null
            Write-Host 'The server CA is trusted for the current Windows user. Other devices need this public certificate separately.'
        } else {
            Write-Host ('Certificate trust was not changed. Before opening '+$Status.origin+'/super-admin, import the public certificate above into your current-user Trusted Root Certification Authorities store, or use a trusted public HTTPS certificate. Other devices require their own trust setup.')
        }
    } finally { $certificate.Dispose() }
}

function Assert-CastlinkWindows {
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT -or -not [Environment]::Is64BitOperatingSystem -or $env:PROCESSOR_ARCHITECTURE -ne 'AMD64') { throw 'Supported platform: Windows 11 x64, build 22621 or later, with current WSL 2.' }
    $os = Get-CimInstance Win32_OperatingSystem
    $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
    if ($cpu.Architecture -ne 9) { throw 'Windows on ARM is not supported; an x64 processor is required.' }
    if ([int]$os.BuildNumber -lt 22621 -or $os.ProductType -ne 1) { throw 'Windows 11 x64 build 22621 or later is required; Windows Server and Windows 10 are not supported.' }
    $script:WslExe = Join-Path $env:WINDIR 'System32\wsl.exe'
    if (-not (Test-Path -LiteralPath $script:WslExe)) { throw 'WSL is not available. Install current WSL using elevated PowerShell: wsl --install --no-distribution. Restart Windows and rerun this installer.' }
}

function Initialize-CastlinkWsl {
    & $script:WslExe --status *> $null
    if ($LASTEXITCODE -ne 0) {
        if ($NonInteractive) { throw 'WSL prerequisites are unavailable; run this installer interactively.' }
        Write-Host 'Windows needs WSL 2 and virtualization. Administrator consent opens the standard WSL installation. Windows may require a restart.'
        if ((Read-Host 'Install WSL prerequisites now? [y/N]') -notmatch '^(y|yes)$') { throw 'Run elevated: wsl --install --no-distribution; restart Windows, then rerun this same installer.' }
        $process = Start-Process -FilePath $script:WslExe -ArgumentList @('--install','--no-distribution') -Verb RunAs -PassThru -Wait
        if ($process.ExitCode -notin @(0,3010)) { throw "WSL prerequisite installation failed (exit $($process.ExitCode)). Enable CPU virtualization in firmware if needed." }
        throw 'WSL prerequisites were requested. Restart Windows, then rerun this same command. The installer never restarts Windows automatically.'
    }
    $versionText = (@(Invoke-CastlinkWsl @('--version')) -join ' ') -replace '\x00', ''
    $versionMatch = [regex]::Match($versionText,'\d+\.\d+\.\d+(?:\.\d+)?')
    if (-not $versionMatch.Success -or [version]$versionMatch.Value -lt [version]'2.4.13') { throw 'Update WSL first: wsl --update. WSL 2.4.13 or newer is required for mirrored networking and its firewall.' }
}

function Initialize-CastlinkFirewall([string]$Root) {
    $creator = '{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}'
    if (-not (Get-Command Get-NetFirewallHyperVRule -ErrorAction SilentlyContinue)) { throw 'Hyper-V firewall commands are unavailable. Update Windows 11 and WSL before continuing.' }
    $required = @(@('TCP','80,443,7881'), @('UDP','3478,7882,30000-30031'))
    $complete = $true
    foreach ($entry in $required) {
        $rule = Get-NetFirewallHyperVRule -Name ('CastLink-Server-'+$entry[0]) -ErrorAction SilentlyContinue
        if (-not $rule -or ([guid]$rule.VMCreatorId) -ne ([guid]$creator) -or [string]$rule.Enabled -ne 'True' -or [string]$rule.Direction -ne 'Inbound' -or [string]$rule.Action -ne 'Allow' -or [string]$rule.Protocol -notin @($entry[0],$(if ($entry[0] -eq 'TCP') {'6'} else {'17'})) -or (($rule.LocalPorts -join ',') -ne $entry[1])) { $complete = $false }
    }
    if ($complete) { return }
    if ($NonInteractive) { throw 'The required WSL firewall rules are missing; run this installer interactively.' }
    Write-Host 'CastLink requires inbound WSL firewall rules: TCP 80,443,7881; UDP 3478,7882,30000-30031. Other firewall policy is preserved.'
    if ((Read-Host 'Add these named WSL firewall rules with administrator consent? [y/N]') -notmatch '^(y|yes)$') { throw 'The required WSL firewall rules are missing. Configure the listed inbound ports for the WSL VMCreatorId and rerun.' }
    $helper = Join-Path $Root 'configure-firewall.ps1'
    $code = @'
$ErrorActionPreference = 'Stop'
try {
    $creator = '{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}'
    $entries = @(@('TCP',@('80','443','7881')), @('UDP',@('3478','7882','30000-30031')))
    foreach ($entry in $entries) {
        $name = 'CastLink-Server-' + $entry[0]
        $rule = Get-NetFirewallHyperVRule -Name $name -ErrorAction SilentlyContinue
        if ($rule -and (([guid]$rule.VMCreatorId) -ne ([guid]$creator) -or [string]$rule.Enabled -ne 'True' -or [string]$rule.Direction -ne 'Inbound' -or [string]$rule.Action -ne 'Allow' -or [string]$rule.Protocol -notin @($entry[0],$(if ($entry[0] -eq 'TCP') {'6'} else {'17'})) -or (($rule.LocalPorts -join ',') -ne ($entry[1] -join ',')))) { throw "A conflicting named rule already exists: $name. Review it manually; it was preserved." }
    }
    foreach ($entry in $entries) {
        $name = 'CastLink-Server-' + $entry[0]
        if (-not (Get-NetFirewallHyperVRule -Name $name -ErrorAction SilentlyContinue)) {
            New-NetFirewallHyperVRule -Name $name -DisplayName ('CastLink Server '+$entry[0]) -Direction Inbound -VMCreatorId $creator -Protocol $entry[0] -LocalPorts $entry[1] -Action Allow | Out-Null
        }
    }
    exit 0
} catch { Write-Error $_; exit 1 }
'@
    [IO.File]::WriteAllText($helper, $code, (New-Object Text.UTF8Encoding($false)))
    try {
        $powershell = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
        $process = Start-Process -FilePath $powershell -ArgumentList ('-NoLogo -NoProfile -ExecutionPolicy Bypass -File "' + $helper + '"') -Verb RunAs -Wait -PassThru
        if ($process.ExitCode -ne 0) { throw 'Firewall setup did not complete. Existing rules were preserved; review the CastLink-Server-TCP/UDP rules and rerun.' }
    } finally { Remove-Item -LiteralPath $helper -ErrorAction SilentlyContinue }
}

function Invoke-CastlinkUpdaterRegistration([string]$File,[string]$Language){
    & (Join-Path $env:WINDIR 'System32/WindowsPowerShell/v1.0/powershell.exe') -NoLogo -NoProfile -STA -ExecutionPolicy Bypass -File $File -Install -Language $Language
    if($LASTEXITCODE -ne 0){throw 'Permanent updater registration failed'}
}
function Register-CastlinkPersistentUpdater($State,$Status,[string]$Directory,[bool]$NewInstallation,[string]$Language){
    # Only newly completed installations opt in. Repeated installer/control runs never execute another updater.
    if(-not $NewInstallation){return $false}
    if($State.phase -cne 'ready' -or $Status.ready -ne $true -or $Status.buildId -cne ($State.releaseTag -creplace '^server-wsl-v','')){throw 'Updater registration requires a newly ready exact server'}
    $path=Join-Path $Directory 'manifest.json'
    if(-not (Test-Path -LiteralPath $path) -or (Get-Item -LiteralPath $path).Length -gt 1048576 -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $script:PackagedManifestSha256){throw 'Updater manifest checksum mismatch'}
    $manifest=[IO.File]::ReadAllText($path,[Text.Encoding]::UTF8)|ConvertFrom-Json
    if($manifest.schemaVersion -ne 1 -or $manifest.channel -cne 'server-wsl' -or $manifest.repository -cne 'resokol/castlink' -or $manifest.releaseTag -cne $State.releaseTag -or $manifest.rootfs.sha256 -cne $State.rootfsSha256){throw 'Updater manifest installation identity mismatch'}
    if(-not $manifest.PSObject.Properties['nativePanel']){return $false}
    $entries=@($manifest.nativePanel.files|Where-Object {$_.file -ceq 'castlink-updater.ps1'});if(-not $entries.Count){return $false};if($entries.Count -ne 1){throw 'Updater helper inventory is duplicated'}
    $entry=$entries[0];$file=Join-Path $Directory 'castlink-updater.ps1';$ancestor=[IO.Path]::GetFullPath($file)
    while($ancestor){if((Test-Path -LiteralPath $ancestor) -and ((Get-Item -LiteralPath $ancestor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Updater helper cannot use reparse points'};$ancestor=[IO.Path]::GetDirectoryName($ancestor)}
    if($entry.size -le 0 -or $entry.size -gt 4194304 -or $entry.sha256 -cnotmatch '^[a-f0-9]{64}$' -or -not (Test-Path -LiteralPath $file -PathType Leaf) -or (Get-Item -LiteralPath $file).Length -ne $entry.size -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256){throw 'Updater helper checksum or size mismatch'}
    Invoke-CastlinkUpdaterRegistration $file $Language;return $true
}

# Host housekeeping owns only inventoried package files. It never invokes WSL.
function Assert-CastlinkRetentionPath([string]$Path) {
    $full=[IO.Path]::GetFullPath($Path);$base=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'CastLinkServer')).TrimEnd('\')
    if($full -ine $base -and -not $full.StartsWith($base+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Retention path is outside CastLinkServer'}
    $ancestor=$full
    while($ancestor){if((Test-Path -LiteralPath $ancestor) -and ((Get-Item -LiteralPath $ancestor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Retention path contains a reparse point'};$ancestor=[IO.Path]::GetDirectoryName($ancestor)}
    return $full
}
function Read-CastlinkRetentionJson([string]$Path) {
    $p=Assert-CastlinkRetentionPath $Path
    if((Get-Item -LiteralPath $p).Length -gt 4194304){throw 'Retention receipt exceeds size bound'}
    return [IO.File]::ReadAllText($p,[Text.Encoding]::UTF8)|ConvertFrom-Json
}
function Write-CastlinkRetention([string]$Root,$Record) {
    $p=Assert-CastlinkRetentionPath (Join-Path $Root 'disk-retention.json');$tmp=$p+'.new'
    $null=Assert-CastlinkRetentionPath $tmp
    $text=$Record|ConvertTo-Json -Depth 16
    if(@($Record.releases).Count -gt 1024 -or [Text.Encoding]::UTF8.GetByteCount($text) -gt 4194304){throw 'Retention receipt exceeds bounded inventory; previous receipt preserved'}
    [IO.File]::WriteAllText($tmp,$text,[Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $tmp -Destination $p -Force
}
function Read-CastlinkRetention([string]$Root,$State) {
    $r=Read-CastlinkRetentionJson (Join-Path $Root 'disk-retention.json')
    if($r.schemaVersion -ne 1 -or $r.owner -cne 'castlink-wsl-retention-v1' -or $r.installationId -cne $State.installationId -or $r.rootPath -cne $Root -or @($r.releases).Count -gt 1024){throw 'Retention ownership mismatch'}
    return $r
}
function Get-CastlinkRetentionVersion([string]$Tag) {
    $identifier='(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)'
    $pattern='^server-wsl-v((?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-'+$identifier+'(?:\.'+$identifier+')*)?)-[a-f0-9]+$'
    if($Tag -cnotmatch $pattern){throw 'Invalid retention product version'}
    return $Matches[1]
}
function Compare-CastlinkRetentionVersion([string]$Left,[string]$Right) {
    $a=($Left -split '\+',2)[0] -split '-',2;$b=($Right -split '\+',2)[0] -split '-',2
    $av=[version]$a[0];$bv=[version]$b[0];$n=$av.CompareTo($bv);if($n){return $n}
    if($a.Count -eq 1 -and $b.Count -eq 1){return 0};if($a.Count -eq 1){return 1};if($b.Count -eq 1){return -1}
    $ap=$a[1].Split('.');$bp=$b[1].Split('.')
    for($i=0;$i -lt [Math]::Min($ap.Count,$bp.Count);$i++){
        $an=$ap[$i] -cmatch '^[0-9]+$';$bn=$bp[$i] -cmatch '^[0-9]+$'
        if($an -and $bn){$n=$ap[$i].Length.CompareTo($bp[$i].Length);if(-not $n){$n=[string]::CompareOrdinal($ap[$i],$bp[$i])}}
        elseif($an){$n=-1}elseif($bn){$n=1}else{$n=[string]::CompareOrdinal($ap[$i],$bp[$i])}
        if($n){return $n}
    }
    return $ap.Count.CompareTo($bp.Count)
}
function Get-CastlinkRetentionKeepTags($State,$Record) {
    $current=Get-CastlinkRetentionVersion $State.releaseTag;$latest=New-Object 'Collections.Generic.Dictionary[string,string]' ([StringComparer]::Ordinal);$prior=New-Object Collections.Generic.List[string]
    foreach($r in @($Record.releases)){
        if((Get-CastlinkRetentionVersion $r.releaseTag) -cne $r.version){throw 'Retention version metadata mismatch'}
        $version=($r.version -split '\+',2)[0]
        # Registration appends successful records. Rebuild hashes never count as versions.
        $latest[$version]=$r.releaseTag
        if((Compare-CastlinkRetentionVersion $version $current) -lt 0 -and -not $prior.Contains($version)){$prior.Add($version);for($i=$prior.Count-1;$i -gt 0;$i--){if((Compare-CastlinkRetentionVersion $prior[$i] $prior[$i-1]) -le 0){break};$v=$prior[$i];$prior[$i]=$prior[$i-1];$prior[$i-1]=$v};if($prior.Count -gt 2){$prior.RemoveAt(2)}}
    }
    for($i=0;$i -lt $prior.Count;$i++){for($j=$i+1;$j -lt $prior.Count;$j++){if((Compare-CastlinkRetentionVersion $prior[$i] $prior[$j]) -lt 0){$v=$prior[$i];$prior[$i]=$prior[$j];$prior[$j]=$v}}}
    # An exact active build wins even if another build of its version was recorded later.
    $State.releaseTag
    foreach($version in @($prior|Select-Object -First 2)){$latest[$version]}
    # Preserve one newer successful package per version when inspecting a downgrade.
    foreach($version in $latest.Keys){if((Compare-CastlinkRetentionVersion $version $current) -gt 0){$latest[$version]}}
}
function Get-CastlinkRetentionReferences {
    $base=Assert-CastlinkRetentionPath (Join-Path $env:LOCALAPPDATA 'CastLinkServer')
    $queue=New-Object 'Collections.Generic.Queue[string]';$queue.Enqueue($base);$count=0;$installations=@();$retired=@{}
    while($queue.Count){
        $dir=Assert-CastlinkRetentionPath $queue.Dequeue();$count++;if($count -gt 4096){throw 'Retention discovery bound exceeded'}
        $receipt=Join-Path $dir 'installation.json'
        if(Test-Path -LiteralPath $receipt){$s=Read-CastlinkRetentionJson $receipt;$installations+=@([pscustomobject]@{directory=$dir;state=$s})}
        foreach($child in @(Get-ChildItem -LiteralPath $dir -Directory -Force)){
            $null=Assert-CastlinkRetentionPath $child.FullName
            if($child.Name -in @('distribution','release','native-panel','lifecycle-cache','lifecycle-packages','retention-packages')){continue}
            if($child.Name -ceq 'lifecycle-transactions'){
                foreach($transaction in @(Get-ChildItem -LiteralPath $child.FullName -Directory -Force)){
                    $journal=Join-Path $transaction.FullName 'journal.json'
                    if(-not (Test-Path -LiteralPath $journal)){throw 'Unrecorded lifecycle transaction; cleanup deferred'}
                    $j=Read-CastlinkRetentionJson $journal
                    if($j.phase -cnotin @('completed','removed','rolled-back','restored')){throw 'Pending lifecycle transaction; cleanup deferred'}
                    if($j.phase -ceq 'completed' -and $j.kind -ceq 'update' -and $j.sourceRoot -and $j.source.installationId){$retired[(Assert-CastlinkRetentionPath $j.sourceRoot)]=$j.source.installationId}
                }
                continue
            }
            $queue.Enqueue($child.FullName)
        }
    }
    foreach($item in $installations){
        $s=$item.state;if($s.phase -ceq 'removed' -or ($retired.ContainsKey($item.directory) -and $retired[$item.directory] -ceq $s.installationId)){continue}
        if(-not $s.releaseTag){throw 'Incomplete neighboring installation'};$s.releaseTag
        $ledgerPath=Join-Path $item.directory 'disk-retention.json'
        if(Test-Path -LiteralPath $ledgerPath){$ledger=Read-CastlinkRetention $item.directory $s;Get-CastlinkRetentionKeepTags $s $ledger}
    }
}
function Get-CastlinkRetentionPlan([string]$Root,$State,$Record) {
    $null=Assert-CastlinkRetentionPath $Root
    if($State.phase -cne 'ready' -or $Record.owner -cne 'castlink-wsl-retention-v1' -or $Record.installationId -cne $State.installationId -or $Record.rootPath -cne $Root){throw 'Retention installation ownership mismatch'}
    $keep=@(Get-CastlinkRetentionKeepTags $State $Record)+@(Get-CastlinkRetentionReferences);$protected=@{}
    foreach($r in @($Record.releases)){
        if($r.releaseTag -cin $keep){foreach($f in @($r.files)){$protected[$f.path]=$true}}
    }
    $base=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'CastLinkServer')).TrimEnd('\');$seen=@{}
    foreach($r in @($Record.releases)){
        foreach($f in @($r.files)){
            $p=Assert-CastlinkRetentionPath $f.path
            if(-not (Test-Path -LiteralPath $p)){continue}
            $releaseRoot=if($r.ownedRoot){Assert-CastlinkRetentionPath $r.ownedRoot}else{$Root}
            # Only verified package archives/helpers. No data, VHDs, exports, logs or arbitrary backups.
            if(-not ($p.StartsWith((Get-CastlinkRetentionPackageRoot $State)+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or $p.StartsWith((Join-Path $releaseRoot 'release')+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase))){throw 'Retention file scope mismatch'}
            if($f.sha256 -cnotmatch '^[a-f0-9]{64}$' -or [long]$f.size -le 0){throw 'Invalid retention file identity'}
            if($protected.ContainsKey($p) -or $seen.ContainsKey($p) -or -not (Test-Path -LiteralPath $p -PathType Leaf)){continue}
            if((Get-Item -LiteralPath $p).Length -eq $f.size -and (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant() -ceq $f.sha256){$seen[$p]=$true;$f}
        }
    }
}
function Enter-CastlinkPackageLease {
    $base=Assert-CastlinkRetentionPath (Join-Path $env:LOCALAPPDATA 'CastLinkServer')
    $path=Assert-CastlinkRetentionPath (Join-Path $base '.package-operation.lock')
    try{return [IO.File]::Open($path,'OpenOrCreate','ReadWrite','None')}catch{throw 'Another CastLink package operation is running; housekeeping deferred'}
}
function Get-CastlinkRetentionPackageRoot($State) {
    $id=if($State.logicalInstallationId){$State.logicalInstallationId}else{$State.installationId}
    if($id -cnotmatch '^[a-f0-9]{32}$'){throw 'Retention package installation identity mismatch'}
    # Windows PowerShell 5.1 Join-Path preserves embedded forward slashes;
    # use the same canonical form as the file ownership/scope checks.
    return [IO.Path]::GetFullPath((Join-Path (Join-Path $env:LOCALAPPDATA 'CastLinkServer/retention-packages') $id))
}
function Test-CastlinkRetentionPackageDirectory([string]$Root,$State,[string]$Directory) {
    if(-not $Directory){return $false}
    $base=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'CastLinkServer')).TrimEnd('\')
    $dir=[IO.Path]::GetFullPath($Directory).TrimEnd('\')
    return ($dir -ieq (Join-Path $Root 'release') -or $dir.StartsWith((Get-CastlinkRetentionPackageRoot $State)+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase))
}
function Compress-CastlinkRetention($State,$Record) {
    $keep=@(Get-CastlinkRetentionKeepTags $State $Record);$merged=New-Object 'Collections.Generic.Dictionary[string,object]' ([StringComparer]::Ordinal);$ordered=New-Object Collections.Generic.List[string]
    foreach($r in @($Record.releases)){
        $files=@($r.files|Where-Object {Test-Path -LiteralPath (Assert-CastlinkRetentionPath $_.path)})
        if(-not $files.Count -and $r.releaseTag -cnotin $keep){continue}
        $key=$r.releaseTag+'|'+$r.ownedRoot
        if(-not $merged.ContainsKey($key)){$merged[$key]=[pscustomobject]@{version=$r.version;releaseTag=$r.releaseTag;ownedRoot=$r.ownedRoot;files=@()}}else{$null=$ordered.Remove($key)}
        $ordered.Add($key)
        $known=@{};foreach($f in @($merged[$key].files)+$files){$known[$f.path+'|'+$f.sha256]=$f}
        $merged[$key].files=@($known.Values)
    }
    $Record.releases=@($ordered|ForEach-Object{$merged[$_]})
    return $Record
}
function Initialize-CastlinkLegacyRetention([string]$Root) {
    # Published pre-feature managers call this target-owned function at staging.
    # Only their durable exact readiness receipt permits preparing housekeeping.
    $base=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'CastLinkServer'))
    if(-not ([IO.Path]::GetFullPath($Root)).StartsWith($base+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){return}
    $transactions=Join-Path $base 'lifecycle-transactions'
    if(-not (Test-Path -LiteralPath $transactions)){return}
    foreach($dir in @(Get-ChildItem -LiteralPath $transactions -Directory)){
        $path=Join-Path $dir.FullName 'journal.json';if(-not (Test-Path -LiteralPath $path)){continue}
        $j=Read-CastlinkRetentionJson $path
        if($j.retentionManaged -or $j.kind -cne 'update' -or $j.phase -cne 'prepare-bindings' -or $j.candidateRoot -cne $Root){continue}
        $state=Read-CastlinkRetentionJson (Join-Path $Root 'installation.json')
        if($j.manifestSha256 -cne $script:PackagedManifestSha256 -or $j.candidate.installationId -cne $state.installationId -or $j.candidate.releaseTag -cne $state.releaseTag -or -not $j.ready.ready -or $j.ready.buildId -cne ($state.releaseTag -creplace '^server-wsl-v','')){throw 'Legacy retention readiness identity mismatch'}
        $lease=Enter-CastlinkPackageLease
        try{
            $source=Read-CastlinkRetentionJson (Join-Path $j.sourceRoot 'installation.json')
            $pin=(Get-FileHash -LiteralPath (Assert-CastlinkRetentionPath $j.sourceManifest) -Algorithm SHA256).Hash.ToLowerInvariant()
            $source|Add-Member NoteProperty releaseManifestSha256 $pin -Force
            $package=Get-CastlinkRetentionPackage $j.sourceRoot $source (Join-Path $j.sourceRoot 'release')
            $cache=Join-Path (Get-CastlinkRetentionPackageRoot $state) ('retained-'+$source.releaseTag+'-'+$pin)
            $null=Assert-CastlinkRetentionPath $cache;[void][IO.Directory]::CreateDirectory($cache)
            foreach($f in @($package.files)){
                $dest=Assert-CastlinkRetentionPath (Join-Path $cache ([IO.Path]::GetFileName($f.path)))
                if(-not (Test-Path -LiteralPath $dest)){[IO.File]::Copy($f.path,$dest,$false)}
                if((Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash.ToLowerInvariant() -cne $f.sha256){throw 'Retained legacy package copy differs'}
            }
            $copied=Get-CastlinkRetentionPackage $j.sourceRoot $source $cache
            $state.phase='ready' # Only the task receipt is prepared; installed state remains imported until the manager commits.
            Register-CastlinkRetention $Root $state $j.targetDirectory $j.sourceRoot $pin
            $record=Read-CastlinkRetention $Root $state;$record|Add-Member NoteProperty preparedTransaction $path -Force
            foreach($r in @($record.releases)){if($r.releaseTag -ceq $source.releaseTag){$r.files=@($r.files|Where-Object {-not $_.path.StartsWith((Join-Path $j.sourceRoot 'release')+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)})}}
            $record.releases+=@($copied);$record=Compress-CastlinkRetention $state $record;Write-CastlinkRetention $Root $record
        }finally{$lease.Dispose()}
    }
}
function Get-CastlinkRetentionPackage([string]$Root,$State,[string]$Directory) {
    $version=Get-CastlinkRetentionVersion $State.releaseTag;$files=@()
    $base=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'CastLinkServer')).TrimEnd('\')
    if(-not (Test-CastlinkRetentionPackageDirectory $Root $State $Directory)){return [pscustomobject]@{version=$version;releaseTag=$State.releaseTag;ownedRoot=$Root;files=@()}}
    if(Test-Path -LiteralPath (Join-Path $Directory 'manifest.json')){
        $directoryPath=Assert-CastlinkRetentionPath $Directory;$path=Join-Path $directoryPath 'manifest.json'
        $manifest=Read-CastlinkRetentionJson $path
        $pin=if($State.releaseManifestSha256){$State.releaseManifestSha256}elseif($State.nativePanel -and $State.nativePanel.manifestSha256){$State.nativePanel.manifestSha256}else{$script:PackagedManifestSha256}
        if((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $pin -or $manifest.repository -cne 'resokol/castlink' -or $manifest.channel -cne 'server-wsl' -or $manifest.releaseTag -cne $State.releaseTag -or $manifest.version -cne $version -or $manifest.rootfs.sha256 -cne $State.rootfsSha256){throw 'Retention package provenance mismatch'}
        $entries=@($manifest.rootfs,$manifest.sources,$manifest.upstreamSources,$manifest.inventory)+@($manifest.nativePanel.files)+@($manifest.lifecycle.helpers)
        $entries+=@([pscustomobject]@{file='manifest.json';sha256=$pin;size=(Get-Item -LiteralPath $path).Length})
        $seen=@{}
        foreach($entry in $entries){
            if(-not $entry){continue};if($entry.file -cnotmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$' -or $entry.file.Contains('..')){throw 'Invalid retention package asset'}
            $p=Assert-CastlinkRetentionPath (Join-Path $directoryPath $entry.file)
            if(-not (Test-Path -LiteralPath $p)){continue}
            if(-not $entry.PSObject.Properties['size'] -and $entry.file -ceq 'packages.tsv' -and (Get-Item -LiteralPath $p).Length -le 4194304){$entry|Add-Member NoteProperty size (Get-Item -LiteralPath $p).Length}
            if($entry.sha256 -cnotmatch '^[a-f0-9]{64}$' -or $entry.size -le 0 -or (Get-Item -LiteralPath $p).Length -ne $entry.size -or (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256){throw 'Retention package file identity mismatch'}
            if(-not $seen.ContainsKey($p)){$seen[$p]=$true;$files+=@([pscustomobject]@{path=$p;sha256=$entry.sha256;size=[long]$entry.size})}
        }
    }
    return [pscustomobject]@{version=$version;releaseTag=$State.releaseTag;ownedRoot=$Root;files=$files}
}
function Assert-CastlinkRetentionTask($Task,$Spec) {
    if(-not $Task){return}
    if($Task.TaskName -cne $Spec.taskName -or $Task.TaskPath -cne '\' -or $Task.Description -cne $Spec.description -or -not (Test-CastlinkAccountSid $Task.Principal.UserId $Spec.userSid) -or [string]$Task.Principal.LogonType -cnotin @('Interactive','InteractiveToken') -or [string]$Task.Principal.RunLevel -cnotin @('Limited','LUA') -or @($Task.Actions).Count -ne 1 -or $Task.Actions[0].Execute -ine $Spec.execute -or $Task.Actions[0].Arguments -cne $Spec.arguments -or @($Task.Triggers).Count -ne 1 -or $Task.Triggers[0].CimClass.CimClassName -cne 'MSFT_TaskTimeTrigger' -or [string]$Task.Triggers[0].Repetition.Interval -cne 'PT1H' -or -not $Task.Triggers[0].Enabled -or -not $Task.Settings.Enabled -or [string]$Task.Settings.MultipleInstances -cne 'IgnoreNew' -or [string]$Task.Settings.ExecutionTimeLimit -cne 'PT5M'){throw 'Foreign or edited retention task preserved'}
}
function Register-CastlinkRetention([string]$Root,$State,[string]$Directory,[string]$PreviousRoot,[string]$PreviousManifestPin) {
    $null=Assert-CastlinkRetentionPath $Root
    if($State.phase -cne 'ready'){throw 'Retention registration requires a ready installation'}
    $history=@();$previous=$null
    if($PreviousRoot -and (Test-Path -LiteralPath (Join-Path $PreviousRoot 'disk-retention.json'))){$s=Read-CastlinkRetentionJson (Join-Path $PreviousRoot 'installation.json');$previous=Read-CastlinkRetention $PreviousRoot $s;$history+=@($previous.releases)}
    $record=$null
    if(Test-Path -LiteralPath (Join-Path $Root 'disk-retention.json')){$record=Read-CastlinkRetention $Root $State;$history+=@($record.releases)}
    $package=Get-CastlinkRetentionPackage $Root $State $Directory;$history+=@($package)
    if($Directory -ine (Join-Path $Root 'release')){$history+=@(Get-CastlinkRetentionPackage $Root $State (Join-Path $Root 'release'))}
    if($PreviousRoot -and $PreviousRoot -ine $Root){$old=Read-CastlinkRetentionJson (Join-Path $PreviousRoot 'installation.json');if($PreviousManifestPin){$old|Add-Member NoteProperty releaseManifestSha256 $PreviousManifestPin -Force};$history+=@(Get-CastlinkRetentionPackage $PreviousRoot $old (Join-Path $PreviousRoot 'release'))}
    $staged=Join-Path $Root 'install-server-windows.ps1';$null=Assert-CastlinkRetentionPath $staged
    if(-not (Test-Path -LiteralPath $staged)){throw 'Pinned retention installer missing'}
    $hash=(Get-FileHash -LiteralPath $staged -Algorithm SHA256).Hash.ToLowerInvariant()
    $spec=[pscustomobject]@{taskName=('CastLink-Server-'+$State.installationId+'-Retention');userSid=(Get-CastlinkCurrentUserSid);execute=(Join-Path $env:WINDIR 'System32/WindowsPowerShell/v1.0/powershell.exe');arguments=('-NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+$staged+'" -Action Cleanup -InstallRoot "'+$Root+'" -NonInteractive');description=('CastLink owned hourly package retention '+$State.installationId+'; script SHA256 '+$hash);helperSha256=$hash}
    $existing=Get-ScheduledTask -TaskName $spec.taskName -TaskPath '\' -ErrorAction SilentlyContinue
    if($existing){if(-not $record -or -not $record.task){throw 'Unrecorded retention task preserved'};Assert-CastlinkRetentionTask $existing $record.task}
    # Compaction owns deduplication and preserves the last successful occurrence.
    $releases=@($history)
    $record=[pscustomobject]@{schemaVersion=1;owner='castlink-wsl-retention-v1';installationId=$State.installationId;rootPath=$Root;releases=$releases;task=$spec;leaseProtocol='shared-packages-v1'}
    $record=Compress-CastlinkRetention $State $record
    Write-CastlinkRetention $Root $record
    $action=New-ScheduledTaskAction -Execute $spec.execute -Argument $spec.arguments
    $trigger=New-ScheduledTaskTrigger -Once -At ([datetime]::Now.AddMinutes(15)) -RepetitionInterval ([TimeSpan]::FromHours(1))
    $principal=New-ScheduledTaskPrincipal -UserId $spec.userSid -LogonType Interactive -RunLevel Limited
    $settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::FromMinutes(5))
    Register-ScheduledTask -TaskName $spec.taskName -TaskPath '\' -Description $spec.description -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force|Out-Null
    Assert-CastlinkRetentionTask (Get-ScheduledTask -TaskName $spec.taskName -TaskPath '\') $spec
}
function Unregister-CastlinkRetention([string]$Root,$State) {
    if(-not (Test-Path -LiteralPath (Join-Path $Root 'disk-retention.json'))){return}
    $record=Read-CastlinkRetention $Root $State;$spec=$record.task
    if(-not $spec -or $spec.taskName -cne ('CastLink-Server-'+$State.installationId+'-Retention')){throw 'Retention scheduler receipt mismatch'}
    $existing=Get-ScheduledTask -TaskName $spec.taskName -TaskPath '\' -ErrorAction SilentlyContinue
    Assert-CastlinkRetentionTask $existing $spec
    if($existing){Unregister-ScheduledTask -TaskName $spec.taskName -TaskPath '\' -Confirm:$false}
}
function Invoke-CastlinkRetention([string]$Root) {
    $null=Assert-CastlinkRetentionPath $Root
    $lease=[IO.File]::Open((Join-Path $Root 'operation.lock'),'OpenOrCreate','ReadWrite','None')
    $packageLease=$null
    try{
        $packageLease=Enter-CastlinkPackageLease
        $state=Read-CastlinkRetentionJson (Join-Path $Root 'installation.json');$record=Read-CastlinkRetention $Root $state
        if($record.preparedTransaction){$transaction=Read-CastlinkRetentionJson $record.preparedTransaction;if($transaction.phase -ceq 'rolled-back' -and $transaction.candidateRoot -ceq $Root -and $transaction.candidate.installationId -ceq $state.installationId){Unregister-CastlinkRetention $Root $state;return 0};if($transaction.phase -cne 'completed'){throw 'Prepared retention transaction is not complete'}}
        if($state.rootPath -cne $Root -or $state.repository -cne 'resokol/castlink' -or $state.phase -cne 'ready' -or (Get-FileHash -LiteralPath $script:InstallerSourcePath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $record.task.helperSha256){throw 'Retention runtime identity mismatch'}
        $plan=@(Get-CastlinkRetentionPlan $Root $state $record)
        foreach($f in $plan){$p=Assert-CastlinkRetentionPath $f.path;if((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant() -cne $f.sha256){throw 'Retention file changed'};Remove-Item -LiteralPath $p -Force}
        $record=Compress-CastlinkRetention $state $record;Write-CastlinkRetention $Root $record
        # Keep provenance and unknown/changed files; this receipt never grants directory deletion.
        return $plan.Count
    }finally{if($packageLease){$packageLease.Dispose()};$lease.Dispose()}
}

function Invoke-CastlinkWindowsInstaller {
    if($Action -ceq 'Cleanup'){if(-not $InstallRoot){throw 'Explicit retention installation root required'};$null=Invoke-CastlinkRetention $InstallRoot;return}
    if ($Help) {
        Write-Host 'CastLink Server (no Docker): Windows 11 x64 22621+, current WSL 2, mirrored networking and hostAddressLoopback=true (shared WSL settings). Install: .\install-server-windows.ps1 -Address meet.example.com [-MediaIp PUBLIC_IPV4] [-TurnHost turn.example.com]. Controls: -Action Start|Stop|Status|OwnerAccess. New release packages prepare and open the native Start/Stop, tray and statistics panel after installation; it delegates control to this same pinned installer. OwnerAccess writes a private, single-use 15-minute /super-admin invitation to a local file. Initial WSL setup may require administrator consent and a Windows restart. Dedicated distribution/data are preserved on rerun. Use CastLink-Maintenance.cmd or the native Maintenance button for explicit WSL update/removal/restore. Automatic start at sign-in is offered explicitly. An owned background WSL process keeps services running after the installer closes. Public DNS/router forwarding TCP80/443/7881 and UDP3478/7882/30000-30031 are required. Use a released pinned script; this source is not a release.'
        return
    }
    if ($NonInteractive -and $Action -notin @('Start','Stop','Status')) { throw 'NonInteractive is supported only for Start, Stop and Status.' }
    if ($KeepaliveTask -and ($Action -ne 'Start' -or -not $NonInteractive)) { throw 'KeepaliveTask is reserved for the noninteractive Start task.' }
    Assert-CastlinkWindows
    if ($script:PackagedReleaseTag -notmatch '^server-wsl-v[0-9][A-Za-z0-9.+-]*$' -or $script:PackagedRepository -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$' -or $script:PackagedRootfsSha256 -notmatch '^[a-f0-9]{64}$' -or $script:PackagedManifestSha256 -notmatch '^[a-f0-9]{64}$') { throw 'This source installer has no pinned release. Use the installer asset from a reviewed server-wsl release.' }
    if (-not $ReleaseTag) { $ReleaseTag = $script:PackagedReleaseTag }
    if (-not $Repository) { $Repository = $script:PackagedRepository }
    if ($ReleaseTag -cne $script:PackagedReleaseTag -or $Repository -cne $script:PackagedRepository) { throw 'Requested repository/tag does not match this pinned release installer.' }
    $base = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'CastLinkServer'))
    if (-not $InstallRoot) { $InstallRoot = $base }
    $InstallRoot = [IO.Path]::GetFullPath($InstallRoot).TrimEnd('\')
    if ($InstallRoot -ine $base -and -not $InstallRoot.StartsWith($base+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'InstallRoot must be LocalAppData\CastLinkServer or a directory below it.' }
    $ancestor = $InstallRoot
    while ($ancestor) {
        if ((Test-Path -LiteralPath $ancestor) -and ((Get-Item -LiteralPath $ancestor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'InstallRoot cannot use directory links or reparse points.' }
        $ancestor = [IO.Path]::GetDirectoryName($ancestor)
    }
    if ($Action -ne 'Install' -and -not (Test-Path -LiteralPath (Join-Path $InstallRoot 'installation.json'))) { throw 'No owned CastLink installation exists at InstallRoot.' }
    $state = Get-CastlinkInstallation $InstallRoot $ReleaseTag $Repository $script:PackagedRootfsSha256
    [void][IO.Directory]::CreateDirectory($InstallRoot)
    $lock = [IO.FileStream]::new((Join-Path $InstallRoot 'operation.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None,4096,[IO.FileOptions]::DeleteOnClose)
    $packageLease=$null
    try {
        $packageLease=Enter-CastlinkPackageLease
        # Re-read after acquiring the lease; another invocation may have finished.
        if (Test-Path -LiteralPath (Join-Path $InstallRoot 'installation.json')) { $state = Get-CastlinkInstallation $InstallRoot $ReleaseTag $Repository $script:PackagedRootfsSha256 }
        $newInstallation = $state.phase -cne 'ready'
        Protect-CastlinkInstallationDirectory $InstallRoot
        Save-CastlinkInstallation $InstallRoot $state
        Initialize-CastlinkWsl
        $distros = @(Get-CastlinkDistros)
        if ($Action -ne 'Install') {
            if ($distros -cnotcontains $state.distroName) { throw 'Owned WSL distribution is missing; no other distribution was used.' }
            Assert-CastlinkGuestIdentity $state
            if ($Action -eq 'OwnerAccess') { Export-CastlinkOwnerAccess $InstallRoot $state; return }
            if ($Action -eq 'Start') {
                Initialize-CastlinkWslNetworking (Join-Path $env:USERPROFILE '.wslconfig') @(Get-CastlinkDistros -Running) $false
                Initialize-CastlinkFirewall $InstallRoot
            }
            if ($Action -eq 'Start') {
                Assert-CastlinkMirroredRuntime $state
                $state | Add-Member NoteProperty desiredRunning $true -Force
                Start-CastlinkKeepalive $InstallRoot $state
                Save-CastlinkInstallation $InstallRoot $state
            }
            if ($Action -eq 'Stop') { $state | Add-Member NoteProperty desiredRunning $false -Force; Save-CastlinkInstallation $InstallRoot $state }
            $controlOutput = @(Invoke-CastlinkWsl @('--distribution',$state.distroName,'--user','root','--exec','/usr/local/bin/castlink-server',$Action.ToLowerInvariant()))
            if ($Action -in @('Start','Status')) { Assert-CastlinkKeepaliveAlive $state }
            if ($Action -eq 'Stop') { Stop-CastlinkKeepalive $InstallRoot $state }
            $controlOutput | Write-Output
            return
        }
        if (-not $Address) { $Address = Read-Host 'Public hostname or IPv4 address of this server' }
        Assert-CastlinkAddress $Address
        if ($MediaIp) { Assert-CastlinkAddress $MediaIp; $parsed = $null; if (-not [Net.IPAddress]::TryParse($MediaIp,[ref]$parsed) -or $parsed.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork) { throw 'MediaIp must be an IPv4 address.' } }
        if ($TurnHost) { Assert-CastlinkAddress $TurnHost }
        $configPath = Join-Path $env:USERPROFILE '.wslconfig'
        Initialize-CastlinkWslNetworking $configPath @(Get-CastlinkDistros -Running) $true
        Initialize-CastlinkFirewall $InstallRoot
        $cache = if ($PackageDirectory) { [IO.Path]::GetFullPath($PackageDirectory) } else { Join-Path $InstallRoot 'release' }
        if ($distros -ccontains $state.distroName) { Assert-CastlinkGuestIdentity $state } else {
            if ($state.phase -ne 'created') { throw 'Previously imported distribution is missing. Data recovery requires review; it will not be recreated automatically.' }
            $cache = Join-Path $InstallRoot 'release'
            if ($PackageDirectory) { $cache = [IO.Path]::GetFullPath($PackageDirectory) } else {
                [void][IO.Directory]::CreateDirectory($cache)
                [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
                $url = 'https://github.com/'+$Repository+'/releases/download/'+$ReleaseTag+'/'
                Write-Host ('Downloading pinned release '+$ReleaseTag+' (this may take several minutes)...')
                Receive-CastlinkAsset ($url+'manifest.json') (Join-Path $cache 'manifest.json') 1048576
                Receive-CastlinkAsset ($url+$script:RootfsFile) (Join-Path $cache $script:RootfsFile) 12884901888
            }
            Assert-CastlinkPackage $cache $ReleaseTag $Repository $script:PackagedRootfsSha256 $script:PackagedManifestSha256
            $vhdDirectory = Join-Path $InstallRoot 'distribution'
            if (Test-Path -LiteralPath $vhdDirectory) { throw 'Distribution directory already exists without an imported distribution; it was preserved for recovery.' }
            Invoke-CastlinkWsl @('--import',$state.distroName,$vhdDirectory,(Join-Path $cache $script:RootfsFile),'--version','2')
            # stdin transports only the installation identity. Password stays in the guest's hidden interactive prompt.
            $state.installationId | & $script:WslExe --distribution $state.distroName --user root --exec /usr/bin/tee /var/lib/castlink-server-wsl-installation-id *> $null
            if ($LASTEXITCODE -ne 0) { throw 'Imported distribution identity could not be recorded. Distribution preserved; manual recovery is required.' }
            Assert-CastlinkGuestIdentity $state
            $state.phase = 'imported'; Save-CastlinkInstallation $InstallRoot $state
        }
        Assert-CastlinkMirroredRuntime $state
        $state | Add-Member NoteProperty desiredRunning $true -Force
        Start-CastlinkKeepalive $InstallRoot $state
        $arguments = @('--distribution',$state.distroName,'--user','root','--exec','/usr/local/bin/castlink-server','init','--address',$Address,'--lang',$Lang)
        if ($MediaIp) { $arguments += @('--media-ip',$MediaIp) }
        if ($TurnHost) { $arguments += @('--turn-host',$TurnHost) }
        Write-Host 'Create the room-creation password in the private Linux prompt. The password is never passed as a command argument or written by PowerShell.'
        Invoke-CastlinkWsl $arguments
        $null = @(Invoke-CastlinkWsl @('--distribution',$state.distroName,'--user','root','--exec','/usr/local/bin/castlink-server','start'))
        $status = (@(Invoke-CastlinkWsl @('--distribution',$state.distroName,'--user','root','--exec','/usr/local/bin/castlink-server','status')) -join "`n") | ConvertFrom-Json
        if (-not $status.ready) { throw 'Server status did not confirm readiness.' }
        Export-CastlinkCertificate $InstallRoot $state $status
        if ($state.phase -ne 'ready') { Export-CastlinkOwnerAccess $InstallRoot $state }
        Assert-CastlinkKeepaliveAlive $state
        $panelReady = $null; $panelFailure = $null
        try { $panelReady = Prepare-CastlinkNativePanel $InstallRoot $state $status $cache $script:InstallerSourcePath (-not [bool]$PackageDirectory) }
        catch { $panelFailure = $_.Exception.Message }
        if (-not $panelFailure -and -not $state.PSObject.Properties['autoStartAtLogon']) {
            if ((Read-Host 'Start this CastLink server automatically when you sign in to Windows? [y/N]') -match '^(y|yes)$') {
                Register-CastlinkLogonTask $InstallRoot $state $script:InstallerSourcePath
            } else { $state | Add-Member NoteProperty autoStartAtLogon $false -Force }
        }
        Assert-CastlinkKeepaliveAlive $state
        $state.phase = 'ready'; Save-CastlinkInstallation $InstallRoot $state
        $null=Stage-CastlinkPinnedInstaller $InstallRoot $script:InstallerSourcePath
        Register-CastlinkRetention $InstallRoot $state $cache
        if($newInstallation -and $panelReady){
            try{$null=Register-CastlinkPersistentUpdater $state $status $cache $true $Lang}
            catch{$notice=@{ru='Сервер работает. Постоянный обновлятор не зарегистрирован; запустите install-updater-windows.cmd отдельно.';en='Server is running. The permanent updater was not registered; run install-updater-windows.cmd separately.';'zh-CN'='服务器正在运行。永久更新程序未注册；请单独运行 install-updater-windows.cmd。'};Write-Warning ($notice[$Lang]+' '+$_.Exception.Message)}
        }
        Write-Host ('CastLink is running in '+$state.distroName+'. Open https://'+$Address+'/ after DNS and router forwarding are configured. Internet access and remote WebRTC still require an external client check.')
    } finally { if($packageLease){$packageLease.Dispose()};$lock.Dispose() }
    if ($panelFailure) { throw ('Server services are verified running, but native panel setup failed: '+$panelFailure) }
    if ($panelReady -and -not $NonInteractive) {
        Write-Host ('Native Start/Stop and statistics panel: '+$panelReady.hostPath)
        Open-CastlinkNativePanel $InstallRoot $state
    }
}

if ($MyInvocation.InvocationName -ne '.') {
    $ErrorActionPreference = 'Stop'
    try { Invoke-CastlinkWindowsInstaller; if ($KeepaliveTask) { Wait-CastlinkScheduledKeepalive } } catch { Write-Error $_; exit 1 }
}
