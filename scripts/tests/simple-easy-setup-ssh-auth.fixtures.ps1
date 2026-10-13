param([string]$EntryPath=(Join-Path $PSScriptRoot '../windows-simple-easy-setup.ps1'),[string]$HelperPath=(Join-Path $PSScriptRoot '../simple-easy-setup-ssh.ps1'))
$ErrorActionPreference='Stop'
. $EntryPath -FunctionsOnly
. $HelperPath
function Assert-True($Value,[string]$Message){if(-not $Value){throw $Message}}
$folder=Join-Path ([IO.Path]::GetTempPath()) ('castlink-ssh-auth-'+[Guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory $folder
$script:answers=New-Object 'Collections.Generic.Queue[string]'
$script:secureText=''
function Read-SimpleValue($Prompt,$Default){return $script:answers.Dequeue()}
function Read-Host {param($Prompt,[switch]$AsSecureString);if(-not $AsSecureString){throw 'Expected a secure prompt'};return ConvertTo-SecureString $script:secureText -AsPlainText -Force}
try{
  $script:secureText='fixture-password';$script:answers.Enqueue('1')
  $authentication=Read-SimpleSshAuthentication
  $secret=$authentication.Password
  Assert-True ($secret -is [Security.SecureString] -and $secret.Length -eq 16 -and -not $authentication.PrivateKeyPath) 'Password choice changed'
  Close-SimpleSshAuthentication $authentication
  Assert-True ($authentication.Count -eq 0) 'Credential reference retained'
  $path=Join-Path $folder 'private-key.pem'
  $key=New-SimpleSshKey $path
  Assert-True ($key.path -ceq $path -and $key.publicKey -match '^ssh-rsa [A-Za-z0-9+/]+=* castlink$') 'Generated public key format invalid'
  $original=[IO.File]::ReadAllBytes($path)
  Assert-True (([Text.Encoding]::ASCII.GetString($original)).StartsWith('-----BEGIN RSA PRIVATE KEY-----')) 'Generated private key format invalid'
  $acl=Get-Acl -LiteralPath $path
  $user=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $rules=@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
  Assert-True ($acl.AreAccessRulesProtected -and $rules.Count -eq 1 -and $rules[0].IdentityReference.Value -ceq $user) 'Generated private file is not owner-only'
  $refused=$false;try{$null=New-SimpleSshKey $path}catch{$refused=$true}
  Assert-True ($refused -and [Convert]::ToBase64String([IO.File]::ReadAllBytes($path)) -ceq [Convert]::ToBase64String($original)) 'Key generator replaced an existing file'
  $script:secureText='fixture-passphrase';$script:answers.Enqueue('2');$script:answers.Enqueue($path)
  $authentication=Read-SimpleSshAuthentication
  Assert-True ($authentication.PrivateKeyPath -ceq $path -and $authentication.Passphrase -is [Security.SecureString] -and -not $authentication.Password) 'Key choice lost path/secure passphrase'
  Close-SimpleSshAuthentication $authentication
  $script:secureText=('x'*1025);$refused=$false;try{$null=Read-SimpleSshAuthentication 'private-key' $path}catch{$refused=$true};Assert-True $refused 'Oversized passphrase accepted'
  $script:captured=@();$script:logs=@();$script:connections=0;$script:disposed=@();$script:failFresh=$false
  function Write-Host {param([Parameter(ValueFromRemainingArguments=$true)]$Object);$script:logs+=($Object -join ' ')}
  function Upload-SimpleSshFile {param($Client,$LocalFile,$RemoteFile);$script:captured+=@{upload=$RemoteFile}}
  function Invoke-SimpleSshCommand {param($Client,$Command,$Stdin,$TimeoutSeconds);$script:captured+=@{command=$Command;stdin=$Stdin};return [pscustomobject]@{code=0;stdout='{"ok":true,"added":true,"fingerprint":"SHA256:fixture"}'}}
  function Connect-SimpleSsh {param($HostName,$Login,$Port,$ToolsDir,$PrivateKeyPath);$script:connections++;Assert-True (Test-Path -LiteralPath $PrivateKeyPath) 'Fresh verification before save';if($script:failFresh){throw 'fixture-only-failure'};return [pscustomobject]@{id='fresh'}}
  function Disconnect-SimpleSsh($Client){$script:disposed+=$Client.id}
  $old=[pscustomobject]@{id='old'}
  $script:answers.Enqueue('нет');$selected=Add-SimpleGeneratedSshKey $old 'fixture.invalid' 'root' 22 $folder 'fixture-helper'
  Assert-True ([object]::ReferenceEquals($selected,$old) -and $script:captured.Count -eq 0) 'Declined generation mutated server'
  $script:answers.Enqueue('да');$script:answers.Enqueue((Join-Path $folder 'generated.pem'))
  $selected=Add-SimpleGeneratedSshKey $old 'fixture.invalid' 'root' 22 $folder 'fixture-helper'
  $authorization=@($script:captured|Where-Object{$_.stdin})
  $request=$authorization[0].stdin|ConvertFrom-Json
  Assert-True ($selected.id -ceq 'fresh' -and $script:connections -eq 1 -and $script:disposed -contains 'old' -and $request.publicKey -match '^ssh-rsa ' -and @($request.PSObject.Properties).Count -eq 1) 'Generation did not authorize only public key and verify fresh connection'
  Assert-True (@($script:captured|Where-Object{$_.command -like 'rm -f -- *'}).Count -eq 1) 'Generation left helper on server'
  Assert-True (($script:logs -join ' ') -notmatch 'BEGIN RSA|fixture-passphrase|fixture-password') 'Generation logged a credential'
  $script:failFresh=$true;$script:answers.Enqueue('да');$failedPath=Join-Path $folder 'retry.pem';$script:answers.Enqueue($failedPath)
  $selected=Add-SimpleGeneratedSshKey $old 'fixture.invalid' 'root' 22 $folder 'fixture-helper'
  Assert-True ([object]::ReferenceEquals($selected,$old) -and (Test-Path -LiteralPath $failedPath)) 'Failed fresh verification lost old access or saved key'
  Write-Output 'SSH_AUTH_KEYGEN_PASS password key SecureString bounds RSA3072 ownerACL no-overwrite public-only verify-before-switch fallback'
}finally{Remove-Item -LiteralPath $folder -Recurse -Force}
