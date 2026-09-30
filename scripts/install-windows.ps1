param(
  [Parameter(Mandatory=$true)][string]$Image,
  [ValidateSet("public","edge")][string]$Mode = "edge",
  [string]$Domain = "",
  [string]$License = "",
  [string]$Root = "$env:ProgramData\CastLink",
  [string]$LicenseService = "https://license.castlink.example"
)

$ErrorActionPreference = "Stop"

if ($Image -match ":latest$") { throw "Mutable :latest image is not allowed." }

docker version | Out-Null
docker compose version | Out-Null

function New-RandomHex([int]$Bytes) {
  $buffer = New-Object byte[] $Bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($buffer)
  return -join ($buffer | ForEach-Object { $_.ToString("x2") })
}

function New-RandomBase64([int]$Bytes) {
  $buffer = New-Object byte[] $Bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($buffer)
  return [Convert]::ToBase64String($buffer)
}

$installationId = [guid]::NewGuid().ToString()
$serverId = "srv-" + (New-RandomHex 16)
$dbPassword = New-RandomHex 24
$sessionSecret = New-RandomBase64 48
$dataKey = New-RandomBase64 48

$prod = Join-Path $Root "infrastructure\production"
$data = Join-Path $Root "data"
$postgres = Join-Path $Root "postgres"
$backups = Join-Path $Root "backups"

New-Item -ItemType Directory -Force -Path $prod,$data,$postgres,$backups | Out-Null

$sourceRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$composeSource = Join-Path $sourceRoot "infrastructure\production\docker-compose.yml"
Copy-Item $composeSource (Join-Path $prod "docker-compose.yml") -Force

@"
POSTGRES_USER=castlink
POSTGRES_DB=castlink
POSTGRES_PASSWORD=$dbPassword
"@ | Set-Content -NoNewline -Encoding UTF8 (Join-Path $prod "postgres.env")

$turnHost = if ($Domain) { "turn.$Domain" } else { "" }

@"
NODE_ENV=production
STUDIOLINK_DATA_DIR=/data
STUDIOLINK_INSTALLATION_ID=$installationId

CASTLINK_STORAGE_BACKEND=json
DATABASE_URL=postgresql://castlink:$dbPassword@postgres:5432/castlink

LIVEKIT_SERVER_URL=http://127.0.0.1:7880
LIVEKIT_API_KEY=CHANGE_ME_AFTER_MEDIA_INSTALL
LIVEKIT_API_SECRET=CHANGE_ME_AFTER_MEDIA_INSTALL

STUDIOLINK_STUDIO_PASSWORD_HASH=CHANGE_ME_AFTER_FIRST_SETUP
CASTLINK_SESSION_SECRET=$sessionSecret
CASTLINK_DATA_ENCRYPTION_KEY=$dataKey

CASTLINK_TURN_HEALTH_HOST=$turnHost
CASTLINK_TURN_TLS_PORT=443
CASTLINK_HEALTH_TIMEOUT_MS=1500
STUDIOLINK_STATS_MAX_BYTES=536870912

CASTLINK_LICENSE_ENFORCE=0
CASTLINK_SERVER_ID=$serverId
CASTLINK_SERVER_LEASE=
CASTLINK_LICENSE_TOKEN=$License
CASTLINK_LICENSE_SERVICE_URL=$LicenseService
"@ | Set-Content -NoNewline -Encoding UTF8 (Join-Path $prod "web.env")

@{
  schemaVersion = 1
  installationId = $installationId
  serverId = $serverId
  mode = $Mode
  domain = $Domain
  image = $Image
  createdAt = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
} | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $Root "install-state.json")

@"
CASTLINK_WEB_IMAGE=$Image
CASTLINK_ROOT=$Root
CASTLINK_DATA_DIR=$data
CASTLINK_POSTGRES_DATA_DIR=$postgres
"@ | Set-Content -NoNewline -Encoding UTF8 (Join-Path $Root ".castlink-release")

Write-Host ""
Write-Host "CastLink bootstrap prepared."
Write-Host "Root: $Root"
Write-Host "Installation ID: $installationId"
Write-Host "Server ID: $serverId"
Write-Host "Mode: $Mode"
Write-Host ""
if ($Mode -eq "edge") {
  Write-Host "Next: register this edge node with CastLink Cloud before accepting external guests."
} else {
  Write-Host "Next: complete LiveKit/TURN credentials and run production preflight."
}
Write-Host "Generated secret values were not printed."
