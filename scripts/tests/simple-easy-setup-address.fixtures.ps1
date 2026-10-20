param([string]$EntryPath)
$ErrorActionPreference='Stop'
$folder=Join-Path ([IO.Path]::GetTempPath()) ('castlink-address-'+[Guid]::NewGuid().ToString('N'))
. $EntryPath -FunctionsOnly -Action install -Target local -InstallFolder $folder -SetupMode advanced
function Get-SimpleIPv4 { return @('192.168.1.20') }
$script:answers=[Collections.Generic.Queue[string]]::new()
$script:answers.Enqueue('3');$script:answers.Enqueue('1')
function Read-Host([string]$Prompt) {
 if($Prompt -match 'localhost|3 —'){throw 'Removed access mode is still offered'}
 return $script:answers.Dequeue()
}
function Read-SimpleValue([string]$Prompt,[string]$Default) { return $Default }
Read-SimpleLocalAddress
if($script:Address -ne '192.168.1.20' -or $script:answers.Count -ne 0){throw 'LAN selection or removed-mode rejection failed'}
$script:Address='127.0.0.1'
$refused=$false
try{Prepare-SimpleLocalInstall}catch{if($_.Exception.Message -match 'LAN'){ $refused=$true }else{throw}}
if(-not $refused){throw 'New loopback installation was accepted'}
$script:SetupMode='quick'
$script:Address=''
function Read-Host([string]$Prompt) { throw ('Quick setup asked an access-mode question: '+$Prompt) }
Read-SimpleLocalAddress
if($script:Address -ne '192.168.1.20'){throw 'Quick setup lost the LAN default'}
$script:Address=''
function Get-SimpleIPv4 { return @() }
function Read-SimpleValue([string]$Prompt,[string]$Default) {
 if($Default){throw 'Missing LAN address must not fall back to localhost'}
 return '192.168.1.21'
}
Read-SimpleLocalAddress
if($script:Address -ne '192.168.1.21'){throw 'Manual LAN address failed'}
Write-Host 'PASS: LAN/public choices, no loopback fallback, explicit loopback rejected before runtime changes'
