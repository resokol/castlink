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
    $wsl=Join-Path $env:SystemRoot 'System32\wsl.exe'
    $wslReady=$false
    if (Test-Path $wsl) { $wslStatus=Invoke-SimpleProcess $wsl @('--status') '' 20; $wslReady=($wslStatus.code -eq 0) }
    if (-not $wslReady) {
      Write-Host 'Подготавливаю WSL2. Windows может запросить права администратора и перезагрузку.'
      if (-not (Test-Path $wsl)) {
        $ps=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
        $enable=Start-Process $ps -Verb RunAs -ArgumentList '-NoProfile -Command "Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux,VirtualMachinePlatform -All -NoRestart"' -Wait -PassThru
        throw 'Компоненты WSL подготовлены. Перезагрузи Windows и снова запусти мастер.'
      }
      $wslInstall=Start-Process $wsl -Verb RunAs -ArgumentList '--install --no-distribution' -Wait -PassThru
      if ($wslInstall.ExitCode -ne 0) { throw 'Windows не завершила автоматическую подготовку WSL2. Проверь сообщение окна; требуется Windows10 2004 или новее с обновлениями, либо Windows11.' }
      $check=Invoke-SimpleProcess $wsl @('--status') '' 20
      if ($check.code -ne 0) { throw 'Перезагрузи Windows после установки WSL2 и снова запусти мастер.' }
    }
    $winget = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Microsoft\WindowsApps\winget.exe'
    if (-not (Test-Path -LiteralPath $winget -PathType Leaf)) {
      $installer = Join-Path $script:InstallFolder 'Docker-Desktop-Installer.exe'
      Invoke-WebRequest -UseBasicParsing 'https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe' -OutFile $installer
      $signature = Get-AuthenticodeSignature -LiteralPath $installer
      if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Docker') { throw 'Подпись установщика Docker не подтверждена.' }
      $installProcess = Start-Process -FilePath $installer -ArgumentList 'install --accept-license --backend=wsl-2' -Verb RunAs -Wait -PassThru
      $global:LASTEXITCODE = $installProcess.ExitCode
    } else {
    & $winget install --id Docker.DockerDesktop --exact --source winget --accept-package-agreements --accept-source-agreements
    }
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
