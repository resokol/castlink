# Dot-source this generator; it never changes the certificate store.
function Get-SimpleKitCertificate([string]$Path,[bool]$CheckValidity=$true) {
  $bytes=[IO.File]::ReadAllBytes($Path)
  if ([Text.Encoding]::ASCII.GetString($bytes) -match '-----BEGIN .*PRIVATE KEY-----') { throw 'Нельзя переносить приватный ключ.' }
  $cert=New-Object Security.Cryptography.X509Certificates.X509Certificate2 -ArgumentList @(,$bytes)
  try {
    if ($cert.HasPrivateKey) { throw 'Нельзя переносить приватный ключ.' }
    $ca=$cert.Extensions | Where-Object { $_.Oid.Value -eq '2.5.29.19' } | Select-Object -First 1
    if (-not $ca) { throw 'Это не корневой CA-сертификат.' }
    $constraints=New-Object Security.Cryptography.X509Certificates.X509BasicConstraintsExtension -ArgumentList $ca,$ca.Critical
    if (-not $constraints.CertificateAuthority -or [Convert]::ToBase64String($cert.SubjectName.RawData) -cne [Convert]::ToBase64String($cert.IssuerName.RawData)) { throw 'Это не корневой CA-сертификат.' }
    $usage=$cert.Extensions | Where-Object { $_.Oid.Value -eq '2.5.29.15' } | Select-Object -First 1
    if ($usage) {
      $keyUsage=New-Object Security.Cryptography.X509Certificates.X509KeyUsageExtension -ArgumentList $usage,$usage.Critical
      if (-not ($keyUsage.KeyUsages -band [Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyCertSign)) { throw 'CA не разрешает подпись сертификатов.' }
    }
    $now=[DateTime]::UtcNow
    if ($CheckValidity -and ($cert.NotBefore.ToUniversalTime() -gt $now -or $cert.NotAfter.ToUniversalTime() -le $now)) { throw 'Срок действия CA-сертификата ещё не начался или истёк.' }
    return $cert
  } catch { $cert.Dispose();throw }
}
function New-SimpleCertificateKit([string]$Folder,[string]$RootCertificate,[string]$Address) {
  if ($Address -notmatch '^[A-Za-z0-9][A-Za-z0-9.:-]{0,252}$') { throw 'Неверный адрес CastLink.' }
  $cert=Get-SimpleKitCertificate $RootCertificate
  try {
    $public=$cert.Export([Security.Cryptography.X509Certificates.X509ContentType]::Cert)
    $hash=[Security.Cryptography.SHA256]::Create()
    try { $sha256=([BitConverter]::ToString($hash.ComputeHash($public))).Replace('-','').ToLowerInvariant() } finally { $hash.Dispose() }
    $thumbprint=$cert.Thumbprint
    $kit=Join-Path $Folder 'CastLink-Certificate'
    $validation=(Get-Item Function:Get-SimpleKitCertificate).Definition
    $client='param([ValidateSet("Install","Remove")][string]$Action="Install")'+"`r`n"+'$ErrorActionPreference="Stop"'+"`r`n"+'function Get-SimpleKitCertificate {'+$validation+"`r`n}"+"`r`n"+@'
function Start-KitForeground {
  if([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT){return $null}
  if(-not ('CastLink.OwnCertificateDialog' -as [type])){
    Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
namespace CastLink {
 public sealed class OwnCertificateDialog : IDisposable {
  delegate bool WindowCallback(IntPtr window, IntPtr unused);
  [DllImport("user32.dll")] static extern bool EnumWindows(WindowCallback callback, IntPtr unused);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr window);
  readonly HashSet<IntPtr> previous=new HashSet<IntPtr>();
  readonly uint process=(uint)Process.GetCurrentProcess().Id;
  Timer timer;
  public OwnCertificateDialog(){
   EnumWindows((window, unused)=>{uint id;GetWindowThreadProcessId(window,out id);if(id==process)previous.Add(window);return true;},IntPtr.Zero);
   timer=new Timer(Check,null,100,200);
  }
  void Check(object unused){
   EnumWindows((window, ignored)=>{uint id;GetWindowThreadProcessId(window,out id);if(id==process && !previous.Contains(window) && IsWindowVisible(window)){SetForegroundWindow(window);return false;}return true;},IntPtr.Zero);
  }
  public void Dispose(){timer.Dispose();}
 }
}
"@
  }
  return New-Object CastLink.OwnCertificateDialog
}
function Get-KitTrustedCertificate([string]$Thumbprint) { return Get-Item -LiteralPath ('Cert:\CurrentUser\Root\'+$Thumbprint) -ErrorAction SilentlyContinue }
function Add-KitTrustedCertificate([string]$Path) { $null=Import-Certificate -FilePath $Path -CertStoreLocation Cert:\CurrentUser\Root }
function Remove-KitTrustedCertificate([string]$Thumbprint) { Remove-Item -LiteralPath ('Cert:\CurrentUser\Root\'+$Thumbprint) -ErrorAction Stop }
function Get-KitAccount { return [Security.Principal.WindowsIdentity]::GetCurrent().User.Value }
function Invoke-CastLinkCertificate([string]$Action) {
  $path=Join-Path $PSScriptRoot 'castlink-local-root.crt'
  if ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -cne '__SHA256__') { throw 'Сертификат изменён. Получи исходный комплект у владельца сервера.' }
  $cert=Get-SimpleKitCertificate $path ($Action -eq 'Install')
  try {
    if ($cert.Thumbprint -cne '__THUMBPRINT__') { throw 'Не совпадает отпечаток сертификата.' }
    $receiptPath=Join-Path $PSScriptRoot '.trust-import.json'
    $receipt=Get-Content -LiteralPath $receiptPath -Encoding UTF8 -Raw | ConvertFrom-Json
    $account=Get-KitAccount
    $owned=$receipt.schemaVersion -eq 1 -and $receipt.added -eq $true -and $receipt.thumbprint -ceq $cert.Thumbprint -and $receipt.account -ceq $account -and $receipt.computer -ceq [Environment]::MachineName
    $existing=Get-KitTrustedCertificate $cert.Thumbprint
    if ($Action -eq 'Remove') {
      if (-not $owned) { Write-Host 'Этот комплект не добавлял сертификат для текущего пользователя на этом ПК. Доверие не изменено.';return }
      if ($existing) { $dialog=Start-KitForeground;try{Remove-KitTrustedCertificate $cert.Thumbprint}finally{if($dialog){$dialog.Dispose()}} }
      $receipt.added=$false
      [IO.File]::WriteAllText($receiptPath,($receipt | ConvertTo-Json),(New-Object Text.UTF8Encoding($false)))
      Write-Host 'Доверие, добавленное этим комплектом, удалено.';return
    }
    if ($existing) { Write-Host 'Этот сертификат уже доверен текущим пользователем. Повторный импорт не нужен.';return }
    $dialog=Start-KitForeground;try{Add-KitTrustedCertificate $path}finally{if($dialog){$dialog.Dispose()}}
    if (-not (Get-KitTrustedCertificate $cert.Thumbprint)) { throw 'Windows не подтвердила импорт сертификата.' }
    $receipt=[pscustomobject]@{schemaVersion=1;added=$true;thumbprint=$cert.Thumbprint;account=$account;computer=[Environment]::MachineName}
    [IO.File]::WriteAllText($receiptPath,($receipt | ConvertTo-Json),(New-Object Text.UTF8Encoding($false)))
    Write-Host 'Сертификат добавлен для текущего пользователя. Закрой и снова открой браузер.'
  } finally { $cert.Dispose() }
}
if ($MyInvocation.InvocationName -ne '.') {
  try { Invoke-CastLinkCertificate $Action } catch { Write-Host ('Не удалось изменить доверие: '+$_.Exception.Message);exit 1 }
}
'@
    $client=$client.Replace('__SHA256__',$sha256).Replace('__THUMBPRINT__',$thumbprint)
    $cmd='@echo off'+"`r`n"+'"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0Trust-Certificate.ps1" -Action __ACTION__'+"`r`n"+'set "CASTLINK_CERT_EXIT=%ERRORLEVEL%"'+"`r`n"+'pause'+"`r`n"+'exit /b %CASTLINK_CERT_EXIT%'+"`r`n"
    $readme=@"
Переносимый сертификат CastLink для https://$Address

Этот публичный корневой CA экспортирован из выбранной установки CastLink.
Сверь SHA256 с владельцем сервера перед установкой: $sha256
Отпечаток Windows: $thumbprint
Действует до: $($cert.NotAfter.ToUniversalTime().ToString('yyyy-MM-dd HH:mm:ss')) UTC

Скопируй ВСЮ папку этого комплекта на флешку и перенеси на другой Windows ПК.
Запусти Install-Certificate.cmd один раз в КАЖДОЙ учётной записи Windows, которая
будет открывать CastLink. Права администратора не нужны: используется только
хранилище текущего пользователя. Windows может запросить подтверждение доверия.
Затем полностью закрой и снова открой браузер и открой https://$Address.
Повторный запуск с тем же сертификатом ничего не добавляет.

Доверяй комплекту только если доверяешь владельцу сервера: этот CA позволяет
его владельцу подписывать сертификаты HTTPS. Здесь НЕТ приватного ключа Caddy.
Не копируй данные Caddy, root.key, пароли или файлы окружения для этой операции.
После полного удаления данных сервера CA может измениться: получи НОВЫЙ комплект.
Этот комплект не исправляет адрес, сеть или срок действия серверного сертификата.

Firefox может использовать отдельное хранилище согласно своей версии/политике:
если предупреждение осталось, импортируй этот .crt в доверенные центры
сертификации Firefox или обратись к администратору. На телефоне/другой ОС импорт
публичного .crt и подтверждение доверия выполняются средствами самой ОС.
Android: настройки безопасности → установка CA-сертификата (путь зависит от ОС).
iPhone/iPad: установи профиль сертификата, затем включи полное доверие этому CA
в настройках доверия сертификатам. macOS: импортируй .crt в Связку ключей и
выбери «Всегда доверять» только после сверки с владельцем сервера.
Windows-скрипты работают только на Windows. Браузер не может автоматически
установить доверие на другом устройстве; требуется подтверждение его владельца.

Remove-Certificate.cmd удаляет только этот отпечаток и только если ЭТОТ комплект
сохранил факт своего импорта для текущего пользователя на этом же ПК. Ранее
доверенный сертификат он не удаляет. Сохрани .trust-import.json вместе с папкой;
чужой/перенесённый receipt не даёт права удалить ранее настроенное доверие.
"@
    $text=[ordered]@{'Install-Certificate.cmd'=$cmd.Replace('__ACTION__','Install');'Remove-Certificate.cmd'=$cmd.Replace('__ACTION__','Remove');'Trust-Certificate.ps1'=$client;'README.txt'=$readme}
    $expected=@{}
    $expected['castlink-local-root.crt']=$public
    foreach($name in $text.Keys) { $body=$text[$name] -replace "`r?`n","`r`n";$encoding=New-Object Text.UTF8Encoding($name -notlike "*.cmd");$expected[$name]=[byte[]]($encoding.GetPreamble()+$encoding.GetBytes($body)) }
    $receiptName='.trust-import.json'
    $created=New-Object Collections.Generic.List[string]
    # An older/edited kit must not block a server update or be overwritten.
    function Test-SimpleKitContent([string]$Path) {
      if (-not (Test-Path -LiteralPath $Path)) { return $true }
      if (-not (Test-Path -LiteralPath $Path -PathType Container)) { return $false }
      foreach($file in @(Get-ChildItem -LiteralPath $Path -Force)) {
        if ($file.PSIsContainer -or ($file.Name -ne $receiptName -and -not $expected.ContainsKey($file.Name))) { return $false }
        if ($file.Name -ne $receiptName -and [Convert]::ToBase64String([IO.File]::ReadAllBytes($file.FullName)) -cne [Convert]::ToBase64String($expected[$file.Name])) { return $false }
      }
      return $true
    }
    $compatible=Test-SimpleKitContent $kit
    if (-not $compatible) {
      $versionInputs=($expected.Keys | Sort-Object | ForEach-Object { $_+':'+[Convert]::ToBase64String($expected[$_]) }) -join '|'
      $hash=[Security.Cryptography.SHA256]::Create()
      try { $version=([BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($versionInputs)))).Replace('-','').ToLowerInvariant().Substring(0,12) } finally { $hash.Dispose() }
      $kit=Join-Path $Folder ('CastLink-Certificate-'+$sha256.Substring(0,12)+'-'+$version)
      if (-not (Test-SimpleKitContent $kit)) { $kit+='-'+[Guid]::NewGuid().ToString('N').Substring(0,8) }
    }
    if (-not (Test-Path -LiteralPath $kit)) { $null=New-Item -ItemType Directory -Path $kit }
    $kitName=Split-Path -Leaf $kit
    foreach($name in $expected.Keys) {
      $path=Join-Path $kit $name
      if (-not (Test-Path -LiteralPath $path)) { [IO.File]::WriteAllBytes($path,$expected[$name]);$created.Add($kitName+'/'+$name) }
    }
    $receipt=Join-Path $kit $receiptName
    if (-not (Test-Path -LiteralPath $receipt)) { [IO.File]::WriteAllText($receipt,'{"schemaVersion":1,"added":false,"thumbprint":"","account":"","computer":""}',(New-Object Text.UTF8Encoding($false)));$created.Add($kitName+'/'+$receiptName) }
    return [pscustomobject]@{folder=$kit;thumbprint=$thumbprint;sha256=$sha256;files=@($created.ToArray());previousKitPreserved=(-not $compatible)}
  } finally { $cert.Dispose() }
}
