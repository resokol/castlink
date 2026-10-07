# Genuine PS5.1 fixtures: no network, credentials, remote command, or package download.
param([string]$HelperPath = (Join-Path $PSScriptRoot '..\simple-easy-setup-ssh.ps1'))
$ErrorActionPreference = 'Stop'
$parseTokens = $null
$parseErrors = $null
[void][Management.Automation.Language.Parser]::ParseFile($HelperPath, [ref]$parseTokens, [ref]$parseErrors)
if (@($parseErrors).Count -ne 0) { throw 'Helper must parse in stock PowerShell' }
. $HelperPath
function Assert-True($Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
function Assert-Refused([scriptblock]$Operation) {
    $refused = $false
    try { & $Operation } catch { $refused = $true }
    Assert-True $refused 'Expected refusal'
}

$literal = "a'b; `$(`"do not execute`")`nend"
$quote = [char]39
$escape = [string]$quote + [char]34 + $quote + [char]34 + $quote
Assert-True ((ConvertTo-SimplePosixLiteral $literal) -ceq ($quote + $literal.Replace([string]$quote, $escape) + $quote)) 'POSIX argument escaping lost literal data'
Assert-Refused { ConvertTo-SimplePosixLiteral ([string][char]0) }

$script:commandFixture = [pscustomobject]@{ CommandTimeout = [TimeSpan]::Zero; ExitStatus = 7; Result = 'stdout-only'; Error = 'stderr-only'; Disposed = $false; Input = New-Object IO.MemoryStream }
$script:commandFixture | Add-Member ScriptMethod BeginExecute { return [pscustomobject]@{Complete=$true} }
$script:commandFixture | Add-Member ScriptMethod CreateInputStream { return $this.Input }
$script:commandFixture | Add-Member ScriptMethod EndExecute { param($Async) return $this.Result }
$script:commandFixture | Add-Member ScriptMethod Dispose { $this.Disposed = $true }
$ssh = [pscustomobject]@{ IsConnected = $true; LastCommand = '' }
$ssh | Add-Member ScriptMethod CreateCommand { param($Text) $this.LastCommand = $Text; return $script:commandFixture }
$sftp = [pscustomobject]@{IsConnected=$true;OperationTimeout=[TimeSpan]::Zero;LastPath='';Bytes=$null;Overwrite=$null}
$sftp | Add-Member ScriptMethod UploadFile { param($Stream,$Remote,$Overwrite) $memory=New-Object IO.MemoryStream; $Stream.CopyTo($memory); $this.Bytes=$memory.ToArray(); $this.LastPath=$Remote; $this.Overwrite=$Overwrite; $memory.Dispose() }
$session = [pscustomobject]@{SshClient=$ssh;SftpClient=$sftp}
$payload = 'literal password-like ; $(command) "quotes"'
$result = Invoke-SimpleSshCommand -Client $session -Command 'cat' -Stdin $payload -TimeoutSeconds 9
Assert-True ($ssh.LastCommand -ceq 'cat') 'stdin changed command text'
Assert-True ([Text.Encoding]::UTF8.GetString($script:commandFixture.Input.ToArray()) -ceq $payload) 'stdin was not sent as UTF8 data'
Assert-True ($result.code -eq 7 -and $result.stdout -ceq 'stdout-only' -and $result.stderr -ceq 'stderr-only') 'Exit status or stream separation lost'
Assert-True ($script:commandFixture.Disposed -and $script:commandFixture.CommandTimeout.TotalSeconds -eq 9) 'Command lifetime is unbounded'
$script:commandFixture.Disposed=$false
$script:commandFixture.ExitStatus=$null
Assert-Refused { Invoke-SimpleSshCommand -Client $session -Command 'true' }
Assert-True $script:commandFixture.Disposed 'Failure did not dispose command'
$script:commandFixture.ExitStatus=0
$script:commandFixture | Add-Member ScriptMethod CreateInputStream { throw 'A command without stdin must not open an input stream after it may have completed' } -Force
Assert-True ((Invoke-SimpleSshCommand -Client $session -Command 'true').code -eq 0) 'Command without stdin raced opening a channel input stream'

$tempFile = [IO.Path]::GetTempFileName()
try {
    [IO.File]::WriteAllBytes($tempFile,[byte[]](0,1,2,128,255))
    $remote = "/tmp/file 'literal';`$(not-a-command)"
    Upload-SimpleSshFile -Client $session -LocalFile $tempFile -RemoteFile $remote -TimeoutSeconds 13
    Assert-True ($sftp.LastPath -ceq $remote -and $sftp.Overwrite -eq $true) 'SFTP path must be literal data'
    Assert-True (($sftp.Bytes -join ',') -ceq '0,1,2,128,255') 'Upload changed file bytes'
    Assert-True ($sftp.OperationTimeout.TotalSeconds -eq 13) 'SFTP timeout missing'
    Assert-Refused { Upload-SimpleSshFile -Client $session -LocalFile $tempFile -RemoteFile '/tmp/a' -TimeoutSeconds 0 }
    Assert-Refused { Upload-SimpleSshFile -Client $session -LocalFile ($tempFile+'.absent') -RemoteFile '/tmp/a' }
} finally { Remove-Item -LiteralPath $tempFile -Force }

# Exercise the actual first-key decision, known-host reuse, and cleanup around mocked clients.
$script:fixtureFingerprint = 'SHA256:fixture-key'
$script:trustPromptCount = 0
$script:passwordPassed = $null
function Read-Host { param([string]$Prompt) $script:trustPromptCount++; return 'yes' }
function New-SimpleSshClients {
    param($HostName,$Login,$Password,$Port,$ToolsDir)
    $script:passwordPassed = $Password
    $gate = [pscustomobject]@{AllowedFingerprint=$null;ObservedFingerprint=$null}
    $fakeSsh = [pscustomobject]@{IsConnected=$false;Disposed=$false;Gate=$gate;Attempts=0}
    $fakeSsh | Add-Member ScriptMethod Connect {
        $this.Attempts++
        $this.Gate.ObservedFingerprint=$script:fixtureFingerprint
        if ($this.Gate.AllowedFingerprint -cne $script:fixtureFingerprint) { throw 'untrusted key' }
        $this.IsConnected=$true
    }
    $fakeSsh | Add-Member ScriptMethod Dispose { $this.Disposed=$true; $this.IsConnected=$false }
    $fakeSftp = [pscustomobject]@{IsConnected=$false;Disposed=$false}
    $fakeSftp | Add-Member ScriptMethod Connect { $this.IsConnected=$true }
    $fakeSftp | Add-Member ScriptMethod Dispose { $this.Disposed=$true; $this.IsConnected=$false }
    $script:lastFixtureSession = [pscustomobject]@{SshClient=$fakeSsh;SftpClient=$fakeSftp;Gate=$gate;Authentication=$null;PasswordBytes=[byte[]](1,2,3)}
    return $script:lastFixtureSession
}
$temporaryDir = Join-Path ([IO.Path]::GetTempPath()) ('castlink-ssh-fixture-' + [Guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($temporaryDir)
try {
    $secure = ConvertTo-SecureString 'fixture-memory-only' -AsPlainText -Force
    $first = Connect-SimpleSsh -HostName 'fixture.invalid' -Login 'root' -Password $secure -ToolsDir $temporaryDir
    Assert-True ([object]::ReferenceEquals($secure,$script:passwordPassed)) 'Password did not remain a SecureString at transport creation'
    Assert-True ($script:trustPromptCount -eq 1 -and $first.SshClient.Attempts -eq 2 -and $first.SftpClient.IsConnected) 'First host key should require one explicit trust decision before reuse'
    $knownFile=Join-Path $temporaryDir 'simple-ssh-known-hosts.json'
    $knownText=[IO.File]::ReadAllText($knownFile)
    Assert-True (-not $knownText.Contains('fixture-memory-only') -and -not $knownText.Contains('root')) 'Known-host file must contain no credentials'
    Disconnect-SimpleSsh -Client $first
    Assert-True ($first.SshClient.Disposed -and $first.SftpClient.Disposed -and ($first.PasswordBytes -join ',') -ceq '0,0,0') 'Disconnect must dispose both clients and clear password bytes'
    $second = Connect-SimpleSsh -HostName 'fixture.invalid' -Login 'root' -Password $secure -ToolsDir $temporaryDir
    Assert-True ($second.SshClient.Attempts -eq 1 -and $script:trustPromptCount -eq 1) 'Known host prompted again'
    Disconnect-SimpleSsh -Client $second
    $script:fixtureFingerprint='SHA256:changed-key'
    Assert-Refused { Connect-SimpleSsh -HostName 'fixture.invalid' -Login 'root' -Password $secure -ToolsDir $temporaryDir }
    Assert-True ($script:trustPromptCount -eq 1 -and $script:lastFixtureSession.SshClient.Disposed -and $script:lastFixtureSession.SftpClient.Disposed) 'Changed key must fail without another trust prompt and release clients'
    Assert-True ([IO.File]::ReadAllText($knownFile) -ceq $knownText) 'Changed key replaced known host'
    $secure.Dispose()
} finally { Remove-Item -LiteralPath $temporaryDir -Recurse -Force }
Write-Output 'SSH behavioral fixtures passed'
