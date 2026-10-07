param(
  [ValidateSet('choose','local','remote')][string]$Target = 'choose',
  [ValidatePattern('^$|^[a-z][a-z0-9-]{0,31}$')][string]$Profile = '',
  [switch]$PrepareOnly
)
$ErrorActionPreference = 'Stop'

function Find-Desktop {
  $locations = @(
    (Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Programs\DockerDesktop\Docker Desktop.exe'),
    (Join-Path ([Environment]::GetFolderPath('ProgramFiles')) 'Docker\Docker\Docker Desktop.exe')
  )
  foreach ($candidate in $locations) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
      $signature = Get-AuthenticodeSignature -LiteralPath $candidate
      if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Docker') {
        throw 'Не удалось проверить установленный Docker Desktop. Переустанови его из официального источника.'
      }
      return $candidate
    }
  }
  return $null
}

function Test-LinuxEngine([string]$Docker) {
  $info = New-Object System.Diagnostics.ProcessStartInfo
  $info.FileName = $Docker
  $info.Arguments = '--context desktop-linux info --format "{{.OSType}}"'
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  $info.RedirectStandardOutput = $true
  $info.RedirectStandardError = $true
  $info.EnvironmentVariables.Remove('DOCKER_HOST')
  $info.EnvironmentVariables.Remove('DOCKER_CONTEXT')
  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $info
  try {
    if (-not $process.Start()) { return $false }
    $output = $process.StandardOutput.ReadToEndAsync()
    $errors = $process.StandardError.ReadToEndAsync()
    if (-not $process.WaitForExit(8000)) {
      $process.Kill()
      $null = $process.WaitForExit(2000)
      return $false
    }
    return ($process.ExitCode -eq 0 -and $output.GetAwaiter().GetResult().Trim() -eq 'linux' -and $errors.GetAwaiter().GetResult().Length -eq 0)
  } catch { return $false } finally { $process.Dispose() }
}

function Prepare-LocalRuntime {
  # Docker Desktop needs the normal Windows user environment, including the
  # standard data directory even when the launcher inherited a missing variable.
  if (-not $env:ProgramData) { $env:ProgramData = [Environment]::GetFolderPath('CommonApplicationData') }
  if (-not $env:LOCALAPPDATA) { $env:LOCALAPPDATA = [Environment]::GetFolderPath('LocalApplicationData') }
  if (-not $env:APPDATA) { $env:APPDATA = [Environment]::GetFolderPath('ApplicationData') }
  if (-not $env:USERPROFILE) { $env:USERPROFILE = [Environment]::GetFolderPath('UserProfile') }
  $desktop = Find-Desktop
  if (-not $desktop) {
    Write-Host 'Для локального сервера нужен Docker Desktop. Для установки могут понадобиться права администратора и перезагрузка.'
    Write-Host 'Условия Docker Desktop: https://www.docker.com/legal/docker-subscription-service-agreement/'
    $consent = Read-Host 'Установить Docker Desktop и принять условия установки? [да/нет]'
    if ($consent -notin @('да','д','yes','y')) { throw 'Установка Docker отменена. Сервер не изменён.' }
    $winget = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Microsoft\WindowsApps\winget.exe'
    if (-not (Test-Path -LiteralPath $winget -PathType Leaf)) { throw 'Установи «Установщик приложений» (App Installer) из Microsoft Store и снова запусти Easy Setup.' }
    & $winget install --id Docker.DockerDesktop --exact --source winget --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -in @(3010,1641)) { throw 'Docker установлен. Перезагрузи Windows и снова запусти Easy Setup.' }
    if ($LASTEXITCODE -ne 0) { throw 'Установка Docker не завершилась. Проверь сообщение установщика; при запросе перезагрузки перезапусти Windows и повтори Easy Setup.' }
    $desktop = Find-Desktop
    if (-not $desktop) { throw 'Установщик завершился, но Docker Desktop пока не найден. Перезагрузи Windows и повтори Easy Setup.' }
  }
  $docker = Join-Path (Split-Path -Parent $desktop) 'resources\bin\docker.exe'
  if (-not (Test-Path -LiteralPath $docker -PathType Leaf)) { throw 'Не найден Docker CLI внутри установленного Docker Desktop.' }
  if (Test-LinuxEngine $docker) { Write-Host 'Docker с Linux containers уже готов.'; return }
  if (-not (Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue)) {
    Write-Host 'Запускаю Docker Desktop...'
    $null = Start-Process -FilePath $desktop -PassThru
  }
  Write-Host 'Ожидаю готовности Docker. Если появится окно Docker, заверши его первоначальную настройку.'
  $deadline = [DateTime]::UtcNow.AddSeconds(120)
  do {
    Start-Sleep -Seconds 2
    if (Test-LinuxEngine $docker) { Write-Host 'Docker с Linux containers готов. Продолжаю установку CastLink.'; return }
  } while ([DateTime]::UtcNow -lt $deadline)
  throw 'Docker не подготовил Linux engine за 2 минуты. Проверь его окно: может требоваться WSL2, перезагрузка или переключение на Linux containers. Затем снова запусти Easy Setup; данные не сбрасывались.'
}

try {
  if ($Target -eq 'choose') {
    do { $choice = Read-Host 'Где установить сервер? 1 — на этом ПК; 2 — на своём VPS' } while ($choice -notin @('1','2'))
    $Target = if ($choice -eq '1') { 'local' } else { 'remote' }
  }
  if ($Target -eq 'local') { Prepare-LocalRuntime }
  if ($PrepareOnly) { exit 0 }
  $cli = Join-Path $PSScriptRoot 'app\bin\castlink.exe'
  if (-not (Test-Path -LiteralPath $cli -PathType Leaf)) { throw 'Не найден CastLink. Полностью распакуй папку Easy Setup перед запуском.' }
  $arguments = @('setup','--target',$Target,'--easy-setup')
  if ($Profile) { $arguments += @('--profile',$Profile) }
  & $cli @arguments
  exit $LASTEXITCODE
} catch {
  Write-Host $_.Exception.Message
  exit 3
}
