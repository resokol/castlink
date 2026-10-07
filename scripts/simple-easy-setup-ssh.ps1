# Portable password SSH transport for Windows PowerShell 5.1 / .NET Framework 4.8.
# Dependencies come from the official pinned NuGet packages; credentials stay in memory.

function Get-SimpleSshPackagePins {
    @(
        @{Id='System.Runtime.CompilerServices.Unsafe';Version='4.5.3';Framework='net461';Dll='System.Runtime.CompilerServices.Unsafe.dll';Sha256='96764c52a44ee1161151e48ef07489f72047a851cb55b99e9f01d6908536d1a9'},
        @{Id='System.Buffers';Version='4.5.1';Framework='net461';Dll='System.Buffers.dll';Sha256='c30b3dd2c7e2f4cee4b823d692fd42118309b42ab1f5007f923d329a5b0d6b12'},
        @{Id='System.Numerics.Vectors';Version='4.5.0';Framework='net46';Dll='System.Numerics.Vectors.dll';Sha256='a9d49320581fda1b4f4be6212c68c01a22cdf228026099c20a8eabefcf90f9cf'},
        @{Id='System.Memory';Version='4.5.5';Framework='net461';Dll='System.Memory.dll';Sha256='10f43da352a29fb2b3188e4edd4dcf5100194c8b526e4f61fe2e2b5623775a22'},
        @{Id='System.Threading.Tasks.Extensions';Version='4.5.2';Framework='netstandard2.0';Dll='System.Threading.Tasks.Extensions.dll';Sha256='12a245f53a693074cabe947a7a6add03ad736a5316dc7c2b67b8fa067e1b06ea'},
        @{Id='Microsoft.Bcl.AsyncInterfaces';Version='1.0.0';Framework='net461';Dll='Microsoft.Bcl.AsyncInterfaces.dll';Sha256='702dbdb25f38878b95c89ab620f891364d46dbb671fc46e7ee12cf5db32abd01'},
        @{Id='System.Formats.Asn1';Version='8.0.1';Framework='net462';Dll='System.Formats.Asn1.dll';Sha256='99acbf5a0f9eb269b5375e244131b81123018be19028fa7466bac1a3fa3a3973'},
        @{Id='BouncyCastle.Cryptography';Version='2.4.0';Framework='net461';Dll='BouncyCastle.Cryptography.dll';Sha256='0e80d9356b5833ed0e2c872538467eb637065f2986957bddbead9930f9a20090'},
        @{Id='SSH.NET';Version='2024.2.0';Framework='net462';Dll='Renci.SshNet.dll';Sha256='0873cf5e9d72bd25c509ca86cb57e8301923e2dc2162e93207968b16c153894e'}
    )
    # System.ValueTuple and the netstandard2.0 facade are supplied by .NET Framework 4.8.
    # Tasks.Extensions 4.5.2 has assembly version 4.2.0.0, exactly referenced by SSH.NET.
}

function Get-SimpleSshLibraryDir {
    param([Parameter(Mandatory=$true)][string]$ToolsDir)
    return (Join-Path $ToolsDir 'sshnet-2024.2.0')
}

function Get-SimpleSshStreamHash {
    param([Parameter(Mandatory=$true)][IO.Stream]$Stream)
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($algorithm.ComputeHash($Stream))).Replace('-', '').ToLowerInvariant() }
    finally { $algorithm.Dispose() }
}

function Read-SimpleSshPackage {
    param([Parameter(Mandatory=$true)]$Pin, [Parameter(Mandatory=$true)][string]$PackageFile)
    if (-not (Test-Path -LiteralPath $PackageFile -PathType Leaf)) { throw 'SSH dependency is missing. Download it with Install-SimpleSshDependency.' }
    if ((Get-FileHash -LiteralPath $PackageFile -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant() -cne $Pin.Sha256) {
        throw ('SSH dependency checksum failed: ' + $Pin.Id)
    }
    $archive = [IO.Compression.ZipFile]::OpenRead($PackageFile)
    try {
        $specEntry = $archive.GetEntry($Pin.Id + '.nuspec')
        $dllEntry = $archive.GetEntry('lib/' + $Pin.Framework + '/' + $Pin.Dll)
        if ($null -eq $specEntry -or $null -eq $dllEntry) { throw 'SSH dependency package layout is invalid.' }
        $reader = New-Object IO.StreamReader($specEntry.Open())
        try { [xml]$spec = $reader.ReadToEnd() } finally { $reader.Dispose() }
        $id = $spec.SelectSingleNode('/*[local-name()="package"]/*[local-name()="metadata"]/*[local-name()="id"]').InnerText
        $version = $spec.SelectSingleNode('/*[local-name()="package"]/*[local-name()="metadata"]/*[local-name()="version"]').InnerText
        if ($id -cne $Pin.Id -or $version -cne $Pin.Version) { throw 'SSH dependency identity is invalid.' }
        return $archive
    } catch { $archive.Dispose(); throw }
}

function Install-SimpleSshDependency {
    [CmdletBinding()]
    param([Parameter(Mandatory=$true)][string]$ToolsDir)
    Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction Stop
    $libraryDir = Get-SimpleSshLibraryDir -ToolsDir $ToolsDir
    [void][IO.Directory]::CreateDirectory($libraryDir)
    $previousProtocol = [Net.ServicePointManager]::SecurityProtocol
    try {
        [Net.ServicePointManager]::SecurityProtocol = $previousProtocol -bor [Net.SecurityProtocolType]::Tls12
        foreach ($pin in Get-SimpleSshPackagePins) {
            $packageFile = Join-Path $libraryDir ($pin.Id + '.' + $pin.Version + '.nupkg')
            if (-not (Test-Path -LiteralPath $packageFile -PathType Leaf)) {
                $lowerId = $pin.Id.ToLowerInvariant()
                $url = 'https://api.nuget.org/v3-flatcontainer/' + $lowerId + '/' + $pin.Version + '/' + $lowerId + '.' + $pin.Version + '.nupkg'
                $temporaryFile = $packageFile + '.' + [Guid]::NewGuid().ToString('N') + '.download'
                $response = $null
                $output = $null
                try {
                    $request = [Net.HttpWebRequest]::Create($url)
                    $request.Timeout = 30000
                    $request.ReadWriteTimeout = 30000
                    $response = $request.GetResponse()
                    $inputStream = $response.GetResponseStream()
                    $output = [IO.File]::Open($temporaryFile, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
                    try { $inputStream.CopyTo($output) } finally { $inputStream.Dispose(); $output.Dispose(); $output = $null }
                    $verified = Read-SimpleSshPackage -Pin $pin -PackageFile $temporaryFile
                    $verified.Dispose()
                    [IO.File]::Move($temporaryFile, $packageFile)
                } finally {
                    if ($null -ne $output) { $output.Dispose() }
                    if ($null -ne $response) { $response.Dispose() }
                    if (Test-Path -LiteralPath $temporaryFile) { Remove-Item -LiteralPath $temporaryFile -Force -ErrorAction Stop }
                }
            }
            $archive = Read-SimpleSshPackage -Pin $pin -PackageFile $packageFile
            try {
                $entry = $archive.GetEntry('lib/' + $pin.Framework + '/' + $pin.Dll)
                $dllFile = Join-Path $libraryDir $pin.Dll
                $dllStream = $entry.Open()
                try { $expectedHash = Get-SimpleSshStreamHash $dllStream } finally { $dllStream.Dispose() }
                $alreadyPresent = (Test-Path -LiteralPath $dllFile -PathType Leaf)
                if ($alreadyPresent) { $alreadyPresent = ((Get-FileHash -LiteralPath $dllFile -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant() -ceq $expectedHash) }
                if (-not $alreadyPresent) {
                    $sourceStream = $entry.Open()
                    try {
                        $targetStream = [IO.File]::Open($dllFile, [IO.FileMode]::Create, [IO.FileAccess]::Write)
                        try { $sourceStream.CopyTo($targetStream) } finally { $targetStream.Dispose() }
                    } finally { $sourceStream.Dispose() }
                }
            } finally { $archive.Dispose() }
        }
        return $libraryDir
    } finally { [Net.ServicePointManager]::SecurityProtocol = $previousProtocol }
}

function Import-SimpleSshDependency {
    param([Parameter(Mandatory=$true)][string]$ToolsDir)
    $ErrorActionPreference = 'Stop'
    if ($PSVersionTable.PSEdition -ne 'Desktop' -or [Environment]::Version.Major -ne 4) {
        throw 'Password SSH requires Windows PowerShell 5.1 with .NET Framework 4.8.'
    }
    $frameworkRelease = (Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full' -Name Release -ErrorAction Stop).Release
    if ($frameworkRelease -lt 528040) { throw 'Install .NET Framework 4.8 to use password SSH.' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction Stop
    $libraryDir = Get-SimpleSshLibraryDir $ToolsDir
    $references = @()
    foreach ($pin in Get-SimpleSshPackagePins) {
        $archive = Read-SimpleSshPackage -Pin $pin -PackageFile (Join-Path $libraryDir ($pin.Id + '.' + $pin.Version + '.nupkg'))
        try {
            $stream = $archive.GetEntry('lib/' + $pin.Framework + '/' + $pin.Dll).Open()
            try { $expectedHash = Get-SimpleSshStreamHash $stream } finally { $stream.Dispose() }
            $dllFile = Join-Path $libraryDir $pin.Dll
            if (-not (Test-Path -LiteralPath $dllFile -PathType Leaf) -or (Get-FileHash -LiteralPath $dllFile -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant() -cne $expectedHash) {
                throw ('SSH dependency DLL checksum failed: ' + $pin.Id)
            }
            [void][Reflection.Assembly]::LoadFrom($dllFile)
            $references += $dllFile
        } finally { $archive.Dispose() }
    }
    if ($null -eq ('CastLink.SimpleSshHostKeyGate' -as [type])) {
        # HostKeyReceived runs on SSH.NET's worker thread. No PowerShell callback is used there.
        Add-Type -ReferencedAssemblies ($references + @('System.dll', 'System.Core.dll')) -TypeDefinition @'
using System;
using System.Security;
using System.Security.Cryptography;
using System.Runtime.InteropServices;
using System.Text;
using Renci.SshNet;
using Renci.SshNet.Common;
namespace CastLink {
    public sealed class SimpleSshHostKeyGate {
        public volatile string AllowedFingerprint;
        public volatile string ObservedFingerprint;
        public void Attach(BaseClient client) { client.HostKeyReceived += OnHostKey; }
        private void OnHostKey(object sender, HostKeyEventArgs args) {
            using (SHA256 sha = SHA256.Create()) {
                ObservedFingerprint = "SHA256:" + Convert.ToBase64String(sha.ComputeHash(args.HostKey)).TrimEnd('=');
            }
            args.CanTrust = AllowedFingerprint != null && String.Equals(AllowedFingerprint, ObservedFingerprint, StringComparison.Ordinal);
        }
        public static byte[] PasswordBytes(SecureString secret) {
            IntPtr pointer = IntPtr.Zero;
            char[] chars = new char[secret.Length];
            try {
                pointer = Marshal.SecureStringToGlobalAllocUnicode(secret);
                Marshal.Copy(pointer, chars, 0, chars.Length);
                return Encoding.UTF8.GetBytes(chars);
            } finally {
                Array.Clear(chars, 0, chars.Length);
                if (pointer != IntPtr.Zero) Marshal.ZeroFreeGlobalAllocUnicode(pointer);
            }
        }
    }
}
'@ -ErrorAction Stop
    }
}

function New-SimpleSshClients {
    param([string]$HostName, [string]$Login, [Security.SecureString]$Password, [int]$Port, [string]$ToolsDir)
    $ErrorActionPreference = 'Stop'
    Import-SimpleSshDependency -ToolsDir $ToolsDir
    $passwordBytes = [CastLink.SimpleSshHostKeyGate]::PasswordBytes($Password)
    $session = [pscustomobject]@{SshClient=$null;SftpClient=$null;Gate=$null;Authentication=$null;PasswordBytes=$passwordBytes}
    try {
        $auth = New-Object Renci.SshNet.PasswordAuthenticationMethod -ArgumentList $Login, $passwordBytes
        $session.Authentication = $auth
        $info = New-Object Renci.SshNet.ConnectionInfo -ArgumentList $HostName, $Port, $Login, ([Renci.SshNet.AuthenticationMethod[]]@($auth))
        $info.Timeout = [TimeSpan]::FromSeconds(30)
        $session.SshClient = New-Object Renci.SshNet.SshClient -ArgumentList $info
        $session.SftpClient = New-Object Renci.SshNet.SftpClient -ArgumentList $info
        $session.Gate = New-Object CastLink.SimpleSshHostKeyGate
        $session.Gate.Attach($session.SshClient)
        $session.Gate.Attach($session.SftpClient)
        $session.SshClient.KeepAliveInterval = [TimeSpan]::FromSeconds(30)
        $session.SftpClient.KeepAliveInterval = [TimeSpan]::FromSeconds(30)
        return $session
    } catch { Disconnect-SimpleSsh $session; throw 'Could not initialize SSH password transport.' }
}

function Connect-SimpleSsh {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()][string]$HostName,
        [Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()][string]$Login,
        [Parameter(Mandatory=$true)][Security.SecureString]$Password,
        [Parameter(Mandatory=$true)][string]$ToolsDir,
        [ValidateRange(1,65535)][int]$Port=22
    )
    if ($HostName -match '[\s\x00]' -or $Login -match '[\x00\r\n]' -or $Password.Length -eq 0) { throw 'SSH host, login, or password is invalid.' }
    $knownHostsFile = Join-Path $ToolsDir 'simple-ssh-known-hosts.json'
    $endpoint = '[' + $HostName.ToLowerInvariant() + ']:' + $Port
    $knownHosts = @()
    if (Test-Path -LiteralPath $knownHostsFile -PathType Leaf) {
        $knownHosts = @([IO.File]::ReadAllText($knownHostsFile) | ConvertFrom-Json -ErrorAction Stop)
    }
    $existing = @($knownHosts | Where-Object { $_.endpoint -ceq $endpoint })
    if ($existing.Count -gt 1) { throw 'SSH known hosts file contains duplicate entries.' }
    $session = New-SimpleSshClients -HostName $HostName -Login $Login -Password $Password -Port $Port -ToolsDir $ToolsDir
    $connected = $false
    try {
        if ($existing.Count -eq 1) { $session.Gate.AllowedFingerprint = [string]$existing[0].fingerprint }
        try { $session.SshClient.Connect() } catch {
            if ([string]::IsNullOrEmpty($session.Gate.ObservedFingerprint)) { throw 'SSH connection failed. Check the address, port, login, and password.' }
            if ($existing.Count -eq 1) {
                if ($session.Gate.ObservedFingerprint -cne $session.Gate.AllowedFingerprint) { throw 'SSH server key changed. Verify the server before updating the known hosts file.' }
                throw 'SSH authentication or connection failed. Check the login and password.'
            }
            $answer = Read-Host ('SSH ' + $endpoint + ' fingerprint ' + $session.Gate.ObservedFingerprint + '. Trust this server? Type yes')
            if ($answer.Trim() -ine 'yes') { throw 'SSH server key was not accepted.' }
            $session.Gate.AllowedFingerprint = $session.Gate.ObservedFingerprint
            try { $session.SshClient.Connect() } catch { throw 'SSH authentication or connection failed. Check the login and password.' }
        }
        try { $session.SftpClient.Connect() } catch { throw 'SSH file transfer connection failed.' }
        if ($existing.Count -eq 0) {
            $knownHosts += [pscustomobject]@{endpoint=$endpoint;fingerprint=$session.Gate.AllowedFingerprint}
            [IO.File]::WriteAllText($knownHostsFile, (ConvertTo-Json -InputObject @($knownHosts) -Depth 4), (New-Object Text.UTF8Encoding($false)))
        }
        $connected = $true
        return $session
    } finally { if (-not $connected) { Disconnect-SimpleSsh -Client $session } }
}

function Invoke-SimpleSshCommand {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]$Client,
        [Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()][string]$Command,
        [AllowNull()][AllowEmptyString()][string]$Stdin=$null,
        [ValidateRange(1,3600)][int]$TimeoutSeconds=300
    )
    if (-not $Client.SshClient.IsConnected) { throw 'SSH is disconnected.' }
    $operation = $Client.SshClient.CreateCommand($Command)
    try {
        $operation.CommandTimeout = [TimeSpan]::FromSeconds($TimeoutSeconds)
        $pending = $operation.BeginExecute()
        if ($PSBoundParameters.ContainsKey('Stdin') -and $null -ne $Stdin) {
            $inputStream = $operation.CreateInputStream()
            $bytes = [Text.Encoding]::UTF8.GetBytes($Stdin)
            try { $inputStream.Write($bytes, 0, $bytes.Length) }
            finally { [Array]::Clear($bytes, 0, $bytes.Length); $inputStream.Dispose() }
        }
        [void]$operation.EndExecute($pending)
        if ($null -eq $operation.ExitStatus) { throw 'SSH command returned no exit status.' }
        return [pscustomobject]@{code=[int]$operation.ExitStatus;stdout=[string]$operation.Result;stderr=[string]$operation.Error}
    } catch { throw 'SSH command failed or timed out.' }
    finally { $operation.Dispose() }
}

function Upload-SimpleSshFile {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]$Client,
        [Parameter(Mandatory=$true)][string]$LocalFile,
        [Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()][string]$RemoteFile,
        [ValidateRange(1,3600)][int]$TimeoutSeconds=300
    )
    if (-not $Client.SftpClient.IsConnected) { throw 'SSH file transfer is disconnected.' }
    if ($RemoteFile.IndexOf([char]0) -ge 0) { throw 'SFTP destination is invalid.' }
    $Client.SftpClient.OperationTimeout = [TimeSpan]::FromSeconds($TimeoutSeconds)
    $stream = [IO.File]::OpenRead($LocalFile)
    try { $Client.SftpClient.UploadFile($stream, $RemoteFile, $true) }
    catch { throw 'SSH file transfer failed or timed out.' }
    finally { $stream.Dispose() }
}

function Disconnect-SimpleSsh {
    param([Parameter(Mandatory=$true)]$Client)
    if ($null -eq $Client) { return }
    try {
        foreach ($connection in @($Client.SftpClient, $Client.SshClient)) {
            if ($null -ne $connection) { try { $connection.Dispose() } catch {} }
        }
        if ($null -ne $Client.Authentication) { try { $Client.Authentication.Dispose() } catch {} }
    } finally {
        if ($null -ne $Client.PasswordBytes) { [Array]::Clear($Client.PasswordBytes, 0, $Client.PasswordBytes.Length) }
    }
}

function ConvertTo-SimplePosixLiteral {
    param([Parameter(Mandatory=$true)][AllowEmptyString()][string]$Value)
    if ($Value.IndexOf([char]0) -ge 0) { throw 'POSIX argument contains a null character.' }
    $quote = [string][char]39
    $escapedQuote = $quote + [char]34 + $quote + [char]34 + $quote
    return $quote + $Value.Replace($quote, $escapedQuote) + $quote
}
