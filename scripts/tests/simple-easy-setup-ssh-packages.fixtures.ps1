param([Parameter(Mandatory=$true)][string]$ToolsDir)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../simple-easy-setup-ssh.ps1')
$library = Install-SimpleSshDependency -ToolsDir $ToolsDir
$password = ConvertTo-SecureString 'fixture-not-a-real-password' -AsPlainText -Force
$keyPath = Join-Path $ToolsDir ('fixture-' + [Guid]::NewGuid().ToString('N'))
$passwordSession = $null
$keySession = $null
try {
    $passwordSession = New-SimpleSshClients -HostName '127.0.0.1' -Login 'fixture' -Password $password -Port 22 -ToolsDir $ToolsDir
    if ($passwordSession.SshClient.ConnectionInfo.HostKeyAlgorithms.Count -eq 0) { throw 'No host key algorithms were loaded.' }
    $null = New-SimpleSshKey -Path $keyPath
    $keySession = New-SimpleSshClients -HostName '127.0.0.1' -Login 'fixture' -PrivateKeyPath $keyPath -Port 22 -ToolsDir $ToolsDir
    if (-not $keySession.SftpClient -or -not $keySession.PrivateKey) { throw 'Private key SFTP client was not constructed.' }
    # Resolve public method signatures in addition to exercising both constructors.
    $null = [Renci.SshNet.SshClient].Assembly.GetExportedTypes()
    # These methods exercise the older BCL strong names referenced by the logging
    # and task assemblies, alongside the newer versions referenced by SSH.NET.
    $null = [Microsoft.Extensions.Logging.LoggerMessage]::Define(
        [Microsoft.Extensions.Logging.LogLevel]::Information, [Microsoft.Extensions.Logging.EventId]::new(1), 'fixture')
    if ([System.Threading.Tasks.ValueTask[int]]::new(123).GetAwaiter().GetResult() -ne 123) {
        throw 'ValueTask dependency failed.'
    }

    # An already loaded, valid assembly must not mask a corrupt file in a new cache.
    $badTools = Join-Path $ToolsDir ('bad-cache-' + [Guid]::NewGuid().ToString('N'))
    $badLibrary = Get-SimpleSshLibraryDir $badTools
    $pin = (Get-SimpleSshPackagePins)[0]
    $baseName = $pin.Id + '.' + $pin.Version
    [void][IO.Directory]::CreateDirectory($badLibrary)
    try {
        [IO.File]::Copy((Join-Path $library ($baseName + '.nupkg')), (Join-Path $badLibrary ($baseName + '.nupkg')))
        [IO.File]::WriteAllText((Join-Path $badLibrary ($baseName + '.dll')), 'fixture-corrupt')
        try {
            Import-SimpleSshDependency $badTools
            throw 'A corrupt cached SSH assembly was accepted.'
        } catch {
            if ($_.Exception.Message -cne ('SSH dependency DLL checksum failed: ' + $pin.Id)) { throw }
        }
    } finally { [IO.Directory]::Delete($badTools, $true) }
} finally {
    if ($keySession) { Disconnect-SimpleSsh -Client $keySession }
    if ($passwordSession) { Disconnect-SimpleSsh -Client $passwordSession }
    $password.Dispose()
    if ([IO.File]::Exists($keyPath)) { [IO.File]::Delete($keyPath) }
}
