param([string]$HelperPath)
$ErrorActionPreference="Stop"
. $HelperPath
function Assert-Kit([bool]$Condition,[string]$Message) { if (-not $Condition) { throw $Message } }
$base=Join-Path ([IO.Path]::GetTempPath()) ("castlink-trust-fixture-"+[Guid]::NewGuid())
$null=New-Item -ItemType Directory -Path $base
try {
  [IO.File]::WriteAllBytes((Join-Path $base "root.crt"),[Convert]::FromBase64String("MIIDMTCCAhmgAwIBAgIUWEpJnGwWEaUml3uz66+PnW/D+QEwDQYJKoZIhvcNAQELBQAwIDEeMBwGA1UEAwwVQ2FzdExpbmstRml4dHVyZS1Sb290MB4XDTI2MTAwNzE1MTI1N1oXDTM2MTAwNDE1MTI1N1owIDEeMBwGA1UEAwwVQ2FzdExpbmstRml4dHVyZS1Sb290MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAlezOPaaA9lpZI/QvMAeseIxdiU8AVYq32+qNHAYqjxRMUtb+wQ8vmoAlJjITlB6tSisBY7U8akNnW1sP59e9TldCIjCSDHO3yrytAr+c4hQZsOjv9+eKoOAEV+lzyuJocop49R4G7M4Wf9xumO7sELSeaWx5CPhYENV5PMScGFABBSSP4Y4ZDIuaPreDMbye7C6Amy7m0rzW1Wi4O1HsUv24pbIqr11C8JCofWexfyY956XOzFxv9pfuK/gfgW5gqO+9Q1CeKYZTld5DnYgHXZ0E99ilU3yhFF/6LXAt/QTnOk1QkrJtS7U7Y6fApU8EH1WtSn2OpIomE80D/ULWjQIDAQABo2MwYTAdBgNVHQ4EFgQUlKwBVUYvszGNb9AguV8Hfsc5kuMwHwYDVR0jBBgwFoAUlKwBVUYvszGNb9AguV8Hfsc5kuMwDwYDVR0TAQH/BAUwAwEB/zAOBgNVHQ8BAf8EBAMCAQYwDQYJKoZIhvcNAQELBQADggEBAB/dwt+fwvlHTNygwxbGC0uPeQl/qGSanG3Ob/s7nZQaAO0zO9Cpv7o400oPBCkAqzvHOi2iSbnK1FB0hkNETaecXEdZFuknh2prcE2sgzADynlXP/5I8JzswMKRuC2+OOFBhLLJNcnM/5QVm/bXdWZhJJT+Vxc5s+vcCR8dt5KHar8KGJPgIEIp0FVMG0RFUtBb23CHgDNFLaq1pHGdGzlteQgGWMvWsSRAkoeKhcqQnLIkNJqIkj1B5GO3K0sTXk6FRag/57NrIHwLFazkDwPMEyjYOdbfcYUltwHPVA3tluFBNX5qcaMF6f47BwjqoZ2/F3u2mgVby7ZbM5AyLy8="))
  [IO.File]::WriteAllBytes((Join-Path $base "leaf.crt"),[Convert]::FromBase64String("MIIDHjCCAgagAwIBAgIUIBE2uEo5FlI7Uh9gEiZeWO+l+1YwDQYJKoZIhvcNAQELBQAwIDEeMBwGA1UEAwwVQ2FzdExpbmstRml4dHVyZS1MZWFmMB4XDTI2MTAwNzE1MTI1N1oXDTM2MTAwNDE1MTI1N1owIDEeMBwGA1UEAwwVQ2FzdExpbmstRml4dHVyZS1MZWFmMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmmoy+lz8+4YZRCRNc8o6heB2LxsyLBYJ6qlAC0XhiwJBQU/SWLn/Ss2S/kTFdAgz5ysXKy1ngDjc7L12KVujs0AfBF5AlGLMN5FHJDfsNGE3RUie8vzbHez/dzhEtkqsumv5AhVQN2PoabhcWnIGvZJ0X84DRb76m/lxSSjfSmHnBCyS2nrYZ+fyAX4t3FXDofDiLcOvC0VpS1RHdJojI57OidaSIo6kWO9iJOgIV2GcI/RS7IPV0GVGgIYhQ7UWGEmEJLNexyNcvmrdpHdTuJHAxRWyEO9ZWjOtG0hUISoctEq9u+6LBIu9/tbf1NplsL9kSSp5dNaJQ83knbvBmQIDAQABo1AwTjAdBgNVHQ4EFgQUqUxSb3l8CbuN0V2796dqZHr6cy0wHwYDVR0jBBgwFoAUqUxSb3l8CbuN0V2796dqZHr6cy0wDAYDVR0TAQH/BAIwADANBgkqhkiG9w0BAQsFAAOCAQEAV4jyikURatKAsBRSdZRVllcf1uk4KvMKPrVD6Tg07XBQNuYvwyu80sKGwh8gyxvj2ugeXk+Vk+EaoxGTBerRJYUlMgVL0Il8zDM8BbEZ7UuAbYwh68KNT54B1h5Lls44lDH5f51Oxo/X0H/TqAtTP3fdW8M9Ww0pBHye10VucsxWKAKdKQ/HR2/LG4vYbzQUggU9wk/COVQdwSO0x76bpKDY7dTcd1n1M6jpl58iLP7egOrsvvOAwSbf/RNf/mxKe9tHzTzugraeewXA/FLPQQHqDLiy7LOYp+xzGLvIjKEUegBZZwRi2KuiRunBvJXXQlGCNbMOL5YTcPCN1pkpUA=="))
  [IO.File]::WriteAllBytes((Join-Path $base "expired.crt"),[Convert]::FromBase64String("MIICzzCCAbegAwIBAgICAUEwDQYJKoZIhvcNAQELBQAwIDEeMBwGA1UEAwwVQ2FzdExpbmstRml4dHVyZS1Sb290MB4XDTIwMDEwMTAwMDAwMFoXDTIxMDEwMTAwMDAwMFowIDEeMBwGA1UEAwwVQ2FzdExpbmstRml4dHVyZS1Sb290MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAlezOPaaA9lpZI/QvMAeseIxdiU8AVYq32+qNHAYqjxRMUtb+wQ8vmoAlJjITlB6tSisBY7U8akNnW1sP59e9TldCIjCSDHO3yrytAr+c4hQZsOjv9+eKoOAEV+lzyuJocop49R4G7M4Wf9xumO7sELSeaWx5CPhYENV5PMScGFABBSSP4Y4ZDIuaPreDMbye7C6Amy7m0rzW1Wi4O1HsUv24pbIqr11C8JCofWexfyY956XOzFxv9pfuK/gfgW5gqO+9Q1CeKYZTld5DnYgHXZ0E99ilU3yhFF/6LXAt/QTnOk1QkrJtS7U7Y6fApU8EH1WtSn2OpIomE80D/ULWjQIDAQABoxMwETAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQBBmDeIm3/TtOKS0tvKTIIQP8ubvwkgdXxRYIJKcU0/Jmkq1zsUM5jf22uSYXaWrrkqxz99Pgwc5sFDYVK1+EAwyDDKdmlOlkWSgnItLkOnHPOGQ3k962ekUPhpzvKTKe7UW+hVNl3sP1iUfOBahAb0NMSKVc321busR2gunq7Q7ys5KjUrZl4ZNGaIBEAR10hVYl3Sbupi0ZM6WQhjaJsk/B1kJnBW+chu3qCSilzF+7byydTzHlP0wZw6LjZElZZxilJ3gmY02qF0LtCAShDokoNqkVJCn2Q0zNEguFGGL3hIgBhn7UhwjA94iuqbnBpHRaQCQOndLlFiPkuKGE4m"))
  [IO.File]::WriteAllBytes((Join-Path $base "new.crt"),[Convert]::FromBase64String("MIIDOTCCAiGgAwIBAgIUT2Y+eVSdrua9APmmN7aWgETeDCEwDQYJKoZIhvcNAQELBQAwJDEiMCAGA1UEAwwZQ2FzdExpbmstRml4dHVyZS1OZXctUm9vdDAeFw0yNjEwMDcxNTE4MjBaFw0zNjEwMDQxNTE4MjBaMCQxIjAgBgNVBAMMGUNhc3RMaW5rLUZpeHR1cmUtTmV3LVJvb3QwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDgrlUO3ZQng5RY7Eqopc5NFrm5Dy26wl6n9j9cKY7yAwPKbX9S9mv1KdXTPPnJ3KzNRcJAbcUjaDbQoXZKxH6XEtKg6Uyxn3h/gYSTrDhtewUxtOAqxUaPOkpwU7eHbzoo2bw0OaKiOb8mCg8NQGIKt6Bp3HYIGU6jD4iMte9xjSsZ/8H8yBAbaBQQ8VaRfsEcDr4zRMjqMjroD8O6UgEq88OI005D84o/hC/S23qtvcr2PXVPus0L2W0DpGd35lAV6b6j0gyQG6fjDPmhyd76izyP2sSczgEfhQHI0qcn38Q3+RfE9p9O+cvviOdXnHSGCKc4oeVUWAUW2Frkx1S7AgMBAAGjYzBhMB0GA1UdDgQWBBQoqnBgKrU4+5Ekjg8upbrqGcGtCDAfBgNVHSMEGDAWgBQoqnBgKrU4+5Ekjg8upbrqGcGtCDAPBgNVHRMBAf8EBTADAQH/MA4GA1UdDwEB/wQEAwIBBjANBgkqhkiG9w0BAQsFAAOCAQEAp+8w15Ct56vFzo1pfawiYdeRCkeV6/NvEV8rJUt5CFghznJ4h62JFzvvqnyiRP9L/bNZ6LKJHuzP11Uasc+55CT/0PLWEoWA9MmQ/5KbojpruU9E1H4iJeEQAPeo/X93ezFNKPvrxgbIysSlX2DJE/raTXN4KhRG9fhyNkP/prD8TgIbkpeF/Pj58dxr7dzJhBrDKe/bT7a3vCmEa3huPxM8kkLHErVtog1p7ocfBKuY5+nUKdArZgudU5e8ayUhS73wnGx0Eu52OVKaKRg0f8iR2KnHK6tkg5GdrLpy0vOEJYona05Cy36C7E3HTOaIgURBzuF+rOoVbz4+CCRAsA=="))
  $root=Join-Path $base 'root.crt'
  $kit=New-SimpleCertificateKit $base $root '192.168.1.6'
  Assert-Kit ($kit.files.Count -eq 6) 'Expected six newly owned files'
  $certificate=Get-SimpleKitCertificate (Join-Path $kit.folder 'castlink-local-root.crt')
  try { Assert-Kit (-not $certificate.HasPrivateKey) 'Kit carried private key' } finally { $certificate.Dispose() }
  $again=New-SimpleCertificateKit $base $root '192.168.1.6'
  Assert-Kit ($again.files.Count -eq 0) 'Reused files falsely claimed as newly owned'
  $errors=$null;$tokens=$null
  $client=Join-Path $kit.folder 'Trust-Certificate.ps1'
  $null=[Management.Automation.Language.Parser]::ParseFile($client,[ref]$tokens,[ref]$errors)
  Assert-Kit ($errors.Count -eq 0) 'Generated PS syntax'
  $cmd=[IO.File]::ReadAllBytes((Join-Path $kit.folder 'Install-Certificate.cmd'))
  Assert-Kit ($cmd[0] -eq 64 -and [Text.Encoding]::UTF8.GetString($cmd) -match '%~dp0Trust-Certificate.ps1') 'CMD BOM or relative-path quoting'
  . $client
  # Store boundaries mocked: no real certificate import/removal on any OS.
  $script:trusted=$false;$script:added=0;$script:removed=0
  function Get-KitAccount { return 'fixture-account' }
  function Get-KitTrustedCertificate([string]$Thumbprint) { if ($script:trusted) { return [pscustomobject]@{Thumbprint=$Thumbprint} } }
  function Add-KitTrustedCertificate([string]$Path) { $script:trusted=$true;$script:added++ }
  function Remove-KitTrustedCertificate([string]$Thumbprint) { Assert-Kit ($Thumbprint -ceq $kit.thumbprint) 'Wrong certificate removed';$script:trusted=$false;$script:removed++ }
  Invoke-CastLinkCertificate Install
  Invoke-CastLinkCertificate Install
  Assert-Kit ($script:added -eq 1) 'Import was not idempotent'
  Invoke-CastLinkCertificate Remove
  Invoke-CastLinkCertificate Remove
  Assert-Kit ($script:removed -eq 1 -and -not $script:trusted) 'Owned removal was not exact/idempotent'
  # Preexisting trust is never owned and never removed.
  $script:trusted=$true
  Invoke-CastLinkCertificate Install
  Invoke-CastLinkCertificate Remove
  Assert-Kit ($script:added -eq 1 -and $script:removed -eq 1 -and $script:trusted) 'Preexisting trust removed'
  $receipt=Join-Path $kit.folder '.trust-import.json'
  $foreign=[pscustomobject]@{schemaVersion=1;added=$true;thumbprint=$kit.thumbprint;account='another-account';computer=[Environment]::MachineName}
  [IO.File]::WriteAllText($receipt,($foreign | ConvertTo-Json))
  Invoke-CastLinkCertificate Remove
  Assert-Kit ($script:removed -eq 1) 'Foreign account receipt authorized removal'
  $foreign.account='fixture-account';$foreign.computer='another-computer'
  [IO.File]::WriteAllText($receipt,($foreign | ConvertTo-Json))
  Invoke-CastLinkCertificate Remove
  Assert-Kit ($script:removed -eq 1) 'USB receipt authorized removal on another PC'
  $crt=Join-Path $kit.folder 'castlink-local-root.crt'
  $original=[IO.File]::ReadAllBytes($crt)
  [IO.File]::WriteAllBytes($crt,[IO.File]::ReadAllBytes((Join-Path $base 'leaf.crt')))
  $refused=$false;try { Invoke-CastLinkCertificate Install } catch { $refused=$true }
  Assert-Kit ($refused -and $script:added -eq 1) 'Altered cert imported'
  [IO.File]::WriteAllBytes($crt,$original)
  foreach($name in @('leaf','expired')) {
    $invalid=Join-Path $base ('bad-'+$name);$refused=$false
    try { $null=New-SimpleCertificateKit $invalid (Join-Path $base ($name+'.crt')) '192.168.1.6' } catch { $refused=$true }
    Assert-Kit ($refused -and -not (Test-Path $invalid)) ('Invalid '+$name+' certificate exported')
  }
  $private=Join-Path $base 'private.pem';[IO.File]::WriteAllText($private,'-----BEGIN PRIVATE KEY-----')
  $refused=$false;try { $null=New-SimpleCertificateKit (Join-Path $base 'bad-private') $private '192.168.1.6' } catch { $refused=$true }
  Assert-Kit $refused 'Private key accepted'
  # A normal helper update changes generated script text, not the certificate.
  $definition=(Get-Item Function:Get-SimpleKitCertificate).Definition
  Set-Item Function:Get-SimpleKitCertificate ([scriptblock]::Create($definition+"`n# next helper version"))
  $updated=New-SimpleCertificateKit $base $root '192.168.1.6'
  $updatedAgain=New-SimpleCertificateKit $base $root '192.168.1.6'
  Assert-Kit ($updatedAgain.folder -ceq $updated.folder -and $updatedAgain.files.Count -eq 0) 'Same updated kit not reused'
  Set-Item Function:Get-SimpleKitCertificate ([scriptblock]::Create($definition))
  Assert-Kit ($updated.folder -ne $kit.folder -and $updated.previousKitPreserved -and $updated.files.Count -eq 6) 'Helper update blocked or overwrote existing kit'
  $updatedCert=Get-SimpleKitCertificate (Join-Path $updated.folder 'castlink-local-root.crt')
  try { Assert-Kit ($updatedCert.Thumbprint -ceq $kit.thumbprint) 'Helper update changed CA' } finally { $updatedCert.Dispose() }
  $rotated=New-SimpleCertificateKit $base (Join-Path $base 'new.crt') '192.168.1.6'
  Assert-Kit ($rotated.folder -ne $kit.folder -and $rotated.thumbprint -cne $kit.thumbprint -and $rotated.files.Count -eq 6) 'CA regeneration blocked or reused old CA'
  [IO.File]::WriteAllText((Join-Path $kit.folder 'README.txt'),'unrelated user file')
  [IO.File]::WriteAllText((Join-Path $kit.folder 'notes.txt'),'user notes')
  $preserved=New-SimpleCertificateKit $base $root '192.168.1.6'
  Assert-Kit ($preserved.folder -ne $kit.folder -and $preserved.files.Count -eq 6 -and (Get-Content (Join-Path $kit.folder 'README.txt') -Raw) -ceq 'unrelated user file' -and (Get-Content (Join-Path $kit.folder 'notes.txt') -Raw) -ceq 'user notes') 'User content blocked update or was overwritten'
  foreach($item in @($updated,$rotated,$preserved)) {
    Assert-Kit ($item.files -contains ((Split-Path -Leaf $item.folder)+'/.trust-import.json')) 'New receipt ownership missing'
    $errors=$null;$tokens=$null
    $null=[Management.Automation.Language.Parser]::ParseFile((Join-Path $item.folder 'Trust-Certificate.ps1'),[ref]$tokens,[ref]$errors)
    Assert-Kit ($errors.Count -eq 0) 'Updated kit helper unusable'
  }
  Write-Host 'PASS: public CA kit, ownership, validity, pinned import, idempotence, exact removal, account/machine boundary, USB paths, PS syntax'
} finally { Remove-Item -LiteralPath $base -Recurse -Force }
