param([Parameter(Mandatory=$true)][string]$ToolsDir)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../simple-easy-setup-ssh.ps1')
$null = Install-SimpleSshDependency -ToolsDir $ToolsDir
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
} finally {
    if ($keySession) { Disconnect-SimpleSsh -Client $keySession }
    if ($passwordSession) { Disconnect-SimpleSsh -Client $passwordSession }
    $password.Dispose()
    if ([IO.File]::Exists($keyPath)) { [IO.File]::Delete($keyPath) }
}
