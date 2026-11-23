# Portable password/private-key SSH transport for Windows PowerShell 5.1 / .NET Framework 4.8.
# Dependencies come from the official pinned NuGet packages; credentials stay in memory.

function Get-SimpleSshPackagePins {
    @(
        @{Id='System.Runtime.CompilerServices.Unsafe';Version='6.1.2';Framework='net462';Dll='System.Runtime.CompilerServices.Unsafe.dll';Sha256='5f6a7f53af3465f92beb6da873ebe0e496206c313313b98badee4355a6b25937'},
        @{Id='System.Buffers';Version='4.6.1';Framework='net462';Dll='System.Buffers.dll';Sha256='b00451e91d016fbec091ad1e361f3a7015e1d91d4047f7e48a74455b2a673d79'},
        @{Id='System.Numerics.Vectors';Version='4.6.1';Framework='net462';Dll='System.Numerics.Vectors.dll';Sha256='2bc500a86dcb02f2032d6d877f9e2d6e9e4a79080e57239b4198679d4031f2c7'},
        @{Id='System.Memory';Version='4.6.3';Framework='net462';Dll='System.Memory.dll';Sha256='26078aeb758c9ae985e8bf851f973026061da6a5eb4837204d0c2d2204c72955'},
        @{Id='System.ValueTuple';Version='4.6.2';Framework='net47';Dll='System.ValueTuple.dll';Sha256='76fd0e366a2b90655fd15d557b0b79504197748358cb578fe3193f6d97bdd9aa'},
        @{Id='System.Threading.Tasks.Extensions';Version='4.6.3';Framework='net462';Dll='System.Threading.Tasks.Extensions.dll';Sha256='1abc92c7517a021ead7e79d0b7f3c70be75bce0fac7cfe3b38e157d32245ff1a'},
        @{Id='Microsoft.Bcl.AsyncInterfaces';Version='11.0.0';Framework='net462';Dll='Microsoft.Bcl.AsyncInterfaces.dll';Sha256='0aad37c8a5ac211d389b03ce6171023f9ff0271b357b2e9ce07cc028dd4763a6'},
        @{Id='System.Formats.Asn1';Version='11.0.0';Framework='net462';Dll='System.Formats.Asn1.dll';Sha256='4bfa5deb012efb78cd5afb550f182d530f58765523bd12d805fa3315326ef90b'},
        @{Id='Microsoft.Bcl.HashCode';Version='6.0.0';Framework='net462';Dll='Microsoft.Bcl.HashCode.dll';Sha256='f3b9b2bab0bf8cc717d5fdf6d7aee3ec54e36d9e85bd41347acae161319cbd6b'},
        @{Id='Microsoft.Bcl.Cryptography';Version='11.0.0';Framework='net462';Dll='Microsoft.Bcl.Cryptography.dll';Sha256='8b6252f5a7170ef1c1e30aafba518b4b131a5c9186bb574653c64116469b8631'},
        @{Id='System.Diagnostics.DiagnosticSource';Version='11.0.0';Framework='net462';Dll='System.Diagnostics.DiagnosticSource.dll';Sha256='16e694e83a96da9e27e15038b10c0a37a87605433287cb464fc4d1f9e4597647'},
        @{Id='Microsoft.Extensions.DependencyInjection.Abstractions';Version='11.0.0';Framework='net462';Dll='Microsoft.Extensions.DependencyInjection.Abstractions.dll';Sha256='2bb9ba44ab003c647b323e2c8a632b2e2ed54d735346340e1ea7787eaf37f270'},
        @{Id='Microsoft.Extensions.Logging.Abstractions';Version='11.0.0';Framework='net462';Dll='Microsoft.Extensions.Logging.Abstractions.dll';Sha256='8bf2e244848021a81502e342d7ae282f60f04c9d57a8c4e2ea5219293941fc71'},
        @{Id='BouncyCastle.Cryptography';Version='2.7.0';Framework='net461';Dll='BouncyCastle.Cryptography.dll';Sha256='f091ffccab4d03993e660bace277659a79dee0972f54d7f1f4bd46d680966241'},
        @{Id='SSH.NET';Version='2026.0.1';Framework='net462';Dll='Renci.SshNet.dll';Sha256='c933c4e0163cd7d78960796fcf27b5908cf2feb05fd95ccfd9d3cc37334a5b2b'}
    )
}

function Get-SimpleSshLibraryDir {
    param([Parameter(Mandatory=$true)][string]$ToolsDir)
    return (Join-Path $ToolsDir 'sshnet-2026.0.1')
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
                try {
                    if (-not (Get-Command Invoke-SimpleDownload -ErrorAction SilentlyContinue)) { . (Join-Path $PSScriptRoot 'simple-easy-setup-download.ps1') }
                    Invoke-SimpleDownload -Uri $url -OutFile $temporaryFile -Label ($pin.Id+' '+$pin.Version) -TimeoutSec 30
                    $verified = Read-SimpleSshPackage -Pin $pin -PackageFile $temporaryFile
                    $verified.Dispose()
                    [IO.File]::Move($temporaryFile, $packageFile)
                } finally {
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
        throw 'SSH requires Windows PowerShell 5.1 with .NET Framework 4.8.'
    }
    $frameworkRelease = (Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full' -Name Release -ErrorAction Stop).Release
    if ($frameworkRelease -lt 528040) { throw 'Install .NET Framework 4.8 to use SSH.' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction Stop
    $libraryDir = Get-SimpleSshLibraryDir $ToolsDir
    $references = @()
    $assemblies = @()
    foreach ($pin in Get-SimpleSshPackagePins) {
        $archive = Read-SimpleSshPackage -Pin $pin -PackageFile (Join-Path $libraryDir ($pin.Id + '.' + $pin.Version + '.nupkg'))
        try {
            $stream = $archive.GetEntry('lib/' + $pin.Framework + '/' + $pin.Dll).Open()
            try { $expectedHash = Get-SimpleSshStreamHash $stream } finally { $stream.Dispose() }
            $dllFile = Join-Path $libraryDir $pin.Dll
            if (-not (Test-Path -LiteralPath $dllFile -PathType Leaf) -or (Get-FileHash -LiteralPath $dllFile -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant() -cne $expectedHash) {
                throw ('SSH dependency DLL checksum failed: ' + $pin.Id)
            }
            $loaded = [Reflection.Assembly]::LoadFrom($dllFile)
            if ((Get-FileHash -LiteralPath $loaded.Location -Algorithm SHA256 -ErrorAction Stop).Hash.ToLowerInvariant() -cne $expectedHash) {
                throw ('Conflicting SSH dependency already loaded: ' + $pin.Id)
            }
            $assemblies += $loaded
            $references += $dllFile
        } finally { $archive.Dispose() }
    }
    # Windows PowerShell cannot set bindingRedirect for a private library. Only
    # redirect the exact strong names compiled into the verified SSH.NET assembly.
    if ($null -eq ('CastLink.SimpleSshBindings' -as [type])) {
        Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Reflection;
namespace CastLink {
    public static class SimpleSshBindings {
        private static Assembly owner;
        private static readonly Dictionary<string, Assembly> bindings =
            new Dictionary<string, Assembly>(StringComparer.OrdinalIgnoreCase);

        public static void Install(Assembly ssh, Assembly[] verified) {
            lock (bindings) {
                if (owner == ssh) return;
                if (owner != null) throw new InvalidOperationException("Restart PowerShell before changing SSH libraries.");
                foreach (AssemblyName request in ssh.GetReferencedAssemblies()) {
                    foreach (Assembly candidate in verified) {
                        AssemblyName actual = candidate.GetName();
                        if (request.Name == actual.Name && actual.Version > request.Version &&
                            request.CultureName == actual.CultureName && request.GetPublicKeyToken().Length > 0 &&
                            BitConverter.ToString(request.GetPublicKeyToken()) == BitConverter.ToString(actual.GetPublicKeyToken())) {
                            bindings.Add(request.FullName, candidate);
                        }
                    }
                }
                owner = ssh;
                AppDomain.CurrentDomain.AssemblyResolve += Resolve;
            }
        }

        private static Assembly Resolve(object sender, ResolveEventArgs args) {
            Assembly target;
            return args.RequestingAssembly == owner && bindings.TryGetValue(args.Name, out target) ? target : null;
        }
    }
}
'@ -ErrorAction Stop
    }
    [CastLink.SimpleSshBindings]::Install($assemblies[-1], [Reflection.Assembly[]]$assemblies)
    if ($null -eq ('CastLink.SimpleSshHostKeyGate' -as [type])) {
        # HostKeyReceived runs on SSH.NET's worker thread. No PowerShell callback is used there.
        Add-Type -ReferencedAssemblies ($references + @('System.dll', 'System.Core.dll')) -TypeDefinition @'
using System;
using System.IO;
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
        public static PrivateKeyFile ReadPrivateKey(string path, SecureString passphrase) {
            IntPtr pointer = IntPtr.Zero;
            try {
                using (FileStream stream = File.OpenRead(path)) {
                    if (stream.Length == 0 || stream.Length > 65536 || (passphrase != null && passphrase.Length > 1024)) throw new InvalidDataException();
                    if (passphrase == null || passphrase.Length == 0) return new PrivateKeyFile(stream);
                    pointer = Marshal.SecureStringToGlobalAllocUnicode(passphrase);
                    return new PrivateKeyFile(stream, Marshal.PtrToStringUni(pointer));
                }
            } finally {
                if (pointer != IntPtr.Zero) Marshal.ZeroFreeGlobalAllocUnicode(pointer);
            }
        }

    }
}
'@ -ErrorAction Stop
    }
}

function New-SimpleSshClients {
    param([string]$HostName, [string]$Login, [Security.SecureString]$Password, [int]$Port, [string]$ToolsDir, [string]$PrivateKeyPath='', [Security.SecureString]$Passphrase)
    $ErrorActionPreference = 'Stop'
    Import-SimpleSshDependency -ToolsDir $ToolsDir
    $session = [pscustomobject]@{SshClient=$null;SftpClient=$null;Gate=$null;Authentication=$null;PasswordBytes=$null;PrivateKey=$null}
    try {
        if ($PrivateKeyPath) {
            $session.PrivateKey = [CastLink.SimpleSshHostKeyGate]::ReadPrivateKey($PrivateKeyPath, $Passphrase)
            $auth = New-Object Renci.SshNet.PrivateKeyAuthenticationMethod -ArgumentList $Login, ([Renci.SshNet.IPrivateKeySource[]]@($session.PrivateKey))
        } else {
            $session.PasswordBytes = [CastLink.SimpleSshHostKeyGate]::PasswordBytes($Password)
            $auth = New-Object Renci.SshNet.PasswordAuthenticationMethod -ArgumentList $Login, $session.PasswordBytes
        }
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
    } catch { Disconnect-SimpleSsh $session; throw 'Не удалось подготовить SSH вход. Проверь пароль либо приватный ключ и парольную фразу.' }
}

function Connect-SimpleSsh {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()][string]$HostName,
        [Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()][string]$Login,
        [Security.SecureString]$Password,
        [string]$PrivateKeyPath='',
        [Security.SecureString]$Passphrase,
        [Parameter(Mandatory=$true)][string]$ToolsDir,
        [ValidateRange(1,65535)][int]$Port=22
    )
    if ($HostName -match '[\s\x00]' -or $Login -match '[\x00\r\n]') { throw 'SSH host or login is invalid.' }
    if ($PrivateKeyPath) {
        if ($null -ne $Password -or -not (Test-Path -LiteralPath $PrivateKeyPath -PathType Leaf)) { throw 'Выбери пароль либо существующий файл приватного ключа.' }
    } elseif ($null -eq $Password -or $Password.Length -eq 0 -or $null -ne $Passphrase) { throw 'SSH password is invalid.' }
    $knownHostsFile = Join-Path $ToolsDir 'simple-ssh-known-hosts.json'
    $endpoint = '[' + $HostName.ToLowerInvariant() + ']:' + $Port
    $knownHosts = @()
    if (Test-Path -LiteralPath $knownHostsFile -PathType Leaf) {
        $knownHosts = @([IO.File]::ReadAllText($knownHostsFile) | ConvertFrom-Json -ErrorAction Stop)
    }
    $existing = @($knownHosts | Where-Object { $_.endpoint -ceq $endpoint })
    if ($existing.Count -gt 1) { throw 'SSH known hosts file contains duplicate entries.' }
    $session = New-SimpleSshClients -HostName $HostName -Login $Login -Password $Password -PrivateKeyPath $PrivateKeyPath -Passphrase $Passphrase -Port $Port -ToolsDir $ToolsDir
    $connected = $false
    try {
        if ($existing.Count -eq 1) { $session.Gate.AllowedFingerprint = [string]$existing[0].fingerprint }
        try { $session.SshClient.Connect() } catch {
            if ([string]::IsNullOrEmpty($session.Gate.ObservedFingerprint)) { throw 'SSH connection failed. Check the address, port, login, and authentication.' }
            if ($existing.Count -eq 1) {
                if ($session.Gate.ObservedFingerprint -cne $session.Gate.AllowedFingerprint) { throw 'SSH server key changed. Verify the server before updating the known hosts file.' }
                throw 'SSH authentication or connection failed. Check the login and authentication.'
            }
            $answer = Read-Host ('SSH ' + $endpoint + ' fingerprint ' + $session.Gate.ObservedFingerprint + '. Trust this server? Type yes')
            if ($answer.Trim() -ine 'yes') { throw 'SSH server key was not accepted.' }
            $session.Gate.AllowedFingerprint = $session.Gate.ObservedFingerprint
            try { $session.SshClient.Connect() } catch { throw 'SSH authentication or connection failed. Check the login and authentication.' }
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
        if ($null -ne $Client.PrivateKey) { try { $Client.PrivateKey.Dispose() } catch {} }
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


function New-SimpleSshKey([string]$Path) {
    if ($null -eq ('CastLink.SimpleSshKeyGenerator' -as [type])) {
        Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Text;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Security.Cryptography;
namespace CastLink {
    public static class SimpleSshKeyGenerator {
        private static byte[] Join(params byte[][] parts) {
            int length=0; foreach(byte[] part in parts) length+=part.Length;
            byte[] result=new byte[length]; int at=0;
            foreach(byte[] part in parts) { Buffer.BlockCopy(part,0,result,at,part.Length);at+=part.Length; }
            return result;
        }
        private static byte[] Integer(byte[] value) {
            if(value[0]>=128) value=Join(new byte[]{0},value);
            return Der(2,value);
        }
        private static byte[] Der(byte tag, byte[] value) {
            byte[] length;
            if(value.Length<128) length=new byte[]{(byte)value.Length};
            else if(value.Length<256) length=new byte[]{129,(byte)value.Length};
            else length=new byte[]{130,(byte)(value.Length>>8),(byte)value.Length};
            return Join(new byte[]{tag},length,value);
        }
        private static byte[] Field(byte[] value) {
            int n=value.Length; return Join(new byte[]{(byte)(n>>24),(byte)(n>>16),(byte)(n>>8),(byte)n},value);
        }
        private static byte[] Positive(byte[] value) { return value[0]>=128 ? Join(new byte[]{0},value) : value; }
        public static string Save(string path) {
            using(RSACryptoServiceProvider rsa=new RSACryptoServiceProvider(3072)) {
                rsa.PersistKeyInCsp=false;
                RSAParameters p=rsa.ExportParameters(true); byte[] der=null, pem=null;
                try {
                    der=Der(48,Join(Integer(new byte[]{0}),Integer(p.Modulus),Integer(p.Exponent),Integer(p.D),Integer(p.P),Integer(p.Q),Integer(p.DP),Integer(p.DQ),Integer(p.InverseQ)));
                    string base64=Convert.ToBase64String(der);
                    StringBuilder text=new StringBuilder("-----BEGIN RSA PRIVATE KEY-----\n");
                    for(int i=0;i<base64.Length;i+=64)text.Append(base64.Substring(i,Math.Min(64,base64.Length-i))).Append('\n');
                    text.Append("-----END RSA PRIVATE KEY-----\n");pem=Encoding.ASCII.GetBytes(text.ToString());
                    SecurityIdentifier user=WindowsIdentity.GetCurrent().User;
                    FileSecurity acl=new FileSecurity();acl.SetOwner(user);acl.SetAccessRuleProtection(true,false);
                    acl.AddAccessRule(new FileSystemAccessRule(user,FileSystemRights.FullControl,AccessControlType.Allow));
                    using(FileStream file=new FileStream(path,FileMode.CreateNew,FileSystemRights.FullControl,FileShare.None,4096,FileOptions.None,acl))file.Write(pem,0,pem.Length);
                    byte[] blob=Join(Field(Encoding.ASCII.GetBytes("ssh-rsa")),Field(Positive(p.Exponent)),Field(Positive(p.Modulus)));
                    return "ssh-rsa "+Convert.ToBase64String(blob)+" castlink";
                } finally {
                    foreach(byte[] value in new byte[][]{p.D,p.P,p.Q,p.DP,p.DQ,p.InverseQ,der,pem})if(value!=null)Array.Clear(value,0,value.Length);
                    rsa.Clear();
                }
            }
        }
    }
}
'@ -ErrorAction Stop
    }
    try {
        $full=[IO.Path]::GetFullPath($Path)
        $public=[CastLink.SimpleSshKeyGenerator]::Save($full)
        return [pscustomobject]@{path=$full;publicKey=$public}
    } catch { throw 'Не удалось сохранить новый SSH ключ. Выбери новый файл в существующей доступной для записи папке.' }
}
