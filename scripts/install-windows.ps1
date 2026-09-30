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
$nodeSecret = New-RandomHex 32
$setupToken = New-RandomHex 32
$dbPassword = New-RandomHex 24
$livekitApiKey = "lk_" + (New-RandomHex 8)
$livekitApiSecret = New-RandomHex 32
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
STUDIOLINK_DEFAULT_STUDIO_ID=studio-default

CASTLINK_STORAGE_BACKEND=json
DATABASE_URL=postgresql://castlink:$dbPassword@postgres:5432/castlink

LIVEKIT_SERVER_URL=http://host.docker.internal:7880
LIVEKIT_API_KEY=$livekitApiKey
LIVEKIT_API_SECRET=$livekitApiSecret

STUDIOLINK_STUDIO_PASSWORD_HASH=CHANGE_ME_AFTER_FIRST_SETUP
CASTLINK_SESSION_SECRET=$sessionSecret
CASTLINK_DATA_ENCRYPTION_KEY=$dataKey

CASTLINK_TURN_HEALTH_HOST=$turnHost
CASTLINK_TURN_TLS_PORT=443
CASTLINK_HEALTH_TIMEOUT_MS=1500
STUDIOLINK_STATS_MAX_BYTES=536870912

CASTLINK_LICENSE_ENFORCE=0
CASTLINK_SETUP_TOKEN=$setupToken
CASTLINK_SERVER_ID=$serverId
CASTLINK_SERVER_LEASE=
CASTLINK_LICENSE_TOKEN=$License
CASTLINK_LICENSE_SERVICE_URL=$LicenseService

CASTLINK_NODE_ID=$serverId
CASTLINK_NODE_SECRET=$nodeSecret
CASTLINK_NODE_REGION=$Domain
CASTLINK_NODE_TYPE=self-hosted
CASTLINK_CONTROL_PLANE_URL=https://api.castlink.example
CASTLINK_CONTROL_PLANE_TIMEOUT_MS=5000
"@ | Set-Content -NoNewline -Encoding UTF8 (Join-Path $prod "web.env")

@"
port: 7880
log_level: info
rtc:
  tcp_port: 7881
  port_range_start: 61000
  port_range_end: 61100
  use_external_ip: true
keys:
  ${livekitApiKey}: $livekitApiSecret
"@ | Set-Content -NoNewline -Encoding UTF8 (Join-Path $prod "livekit.yaml")

$setupToken | Set-Content -NoNewline -Encoding ASCII (Join-Path $Root "setup-token.txt")

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
Write-Host "Setup token file: $(Join-Path $Root 'setup-token.txt')"
Write-Host ""
if ($Mode -eq "edge") {
  Write-Host "Next: register this edge node with CastLink Cloud before accepting external guests."
} else {
  Write-Host "Next: start the generated LiveKit media service and provision TLS/TURN for your domain."
}
Write-Host "Generated secret values were not printed."
