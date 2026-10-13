function Get-SimpleResumePointerPath {
  $base=[Environment]::GetFolderPath('LocalApplicationData');if(-not $base){$base=$env:LOCALAPPDATA}
  return (Join-Path $base 'CastLink/easy-setup-resume.json')
}
function Read-SimpleSetupCheckpoint([string]$Folder) {
  $path=Join-Path $Folder '.castlink-setup-pending.json'
  if(-not(Test-Path -LiteralPath $path -PathType Leaf)){return $null}
  $saved=Get-Content -LiteralPath $path -Encoding UTF8 -Raw|ConvertFrom-Json
  $allowed=@('schemaVersion','target','action','folder','address','stage','dockerConsent','restartBoot','skipCertificateTrust','skipReserveServers')
  if(@($saved.PSObject.Properties|Where-Object{$_.Name -cnotin $allowed}).Count -or $saved.schemaVersion -ne 1 -or $saved.target -cne 'local' -or $saved.action -cne 'install' -or $saved.folder -cne [IO.Path]::GetFullPath($Folder) -or $saved.stage -cnotin @('runtime','wsl-reboot','docker-reboot','docker-installed','runtime-ready')){throw 'Сохранённый шаг мастера некорректен. Данные установки не изменены.'}
  $ip=$null
  if($saved.address -notmatch '^\d{1,3}(\.\d{1,3}){3}$' -or -not [Net.IPAddress]::TryParse([string]$saved.address,[ref]$ip) -or $ip.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork){throw 'В сохранённом шаге неверный IPv4.'}
  foreach($name in @('dockerConsent','skipCertificateTrust','skipReserveServers')){if($saved.$name -isnot [bool]){throw 'Сохранённый шаг мастера содержит неверный выбор.'}}
  return $saved
}
function Save-SimpleSetupCheckpoint([string]$Folder,[string]$Address,[string]$Stage='runtime') {
  $previous=Read-SimpleSetupCheckpoint $Folder
  $saved=[pscustomobject]@{schemaVersion=1;target='local';action='install';folder=[IO.Path]::GetFullPath($Folder);address=$Address;stage=$Stage;dockerConsent=[bool]($previous -and $previous.dockerConsent);restartBoot='';skipCertificateTrust=[bool]$script:SkipCertificateTrust;skipReserveServers=[bool]$script:SkipReserveServers}
  if($previous){$saved.restartBoot=[string]$previous.restartBoot;$saved.skipCertificateTrust=$previous.skipCertificateTrust;$saved.skipReserveServers=$previous.skipReserveServers}
  Write-SimpleSetupCheckpoint $saved
}
function Write-SimpleSetupCheckpoint([object]$Saved) {
  $path=Join-Path $Saved.folder '.castlink-setup-pending.json'
  $temporary=$path+'.tmp'
  [IO.File]::WriteAllText($temporary,($Saved|ConvertTo-Json),(New-Object Text.UTF8Encoding($true)))
  Move-Item -LiteralPath $temporary -Destination $path -Force
  $pointer=Get-SimpleResumePointerPath
  $null=New-Item -ItemType Directory (Split-Path $pointer -Parent) -Force
  [IO.File]::WriteAllText($pointer,([pscustomobject]@{schemaVersion=1;folder=$Saved.folder}|ConvertTo-Json),(New-Object Text.UTF8Encoding($true)))
}
function Get-SimplePendingSetup([string]$Folder='') {
  try {
    if($Folder){return (Read-SimpleSetupCheckpoint $Folder)}
    $pointer=Get-SimpleResumePointerPath
    if(-not(Test-Path -LiteralPath $pointer -PathType Leaf)){return $null}
    $saved=Get-Content -LiteralPath $pointer -Encoding UTF8 -Raw|ConvertFrom-Json
    if($saved.schemaVersion -ne 1 -or -not $saved.folder){return $null}
    return (Read-SimpleSetupCheckpoint ([string]$saved.folder))
  } catch { Write-Host 'Не удалось прочитать указатель незавершённой установки. Выбери нужное действие и папку; сохранённые данные не изменены.';return $null }
}
function Complete-SimpleSetupCheckpoint([string]$Folder) {
  $path=Join-Path $Folder '.castlink-setup-pending.json'
  if(Test-Path -LiteralPath $path){Remove-Item -LiteralPath $path -Force}
  $pointer=Get-SimpleResumePointerPath
  if(Test-Path -LiteralPath $pointer){try{$saved=Get-Content -LiteralPath $pointer -Raw|ConvertFrom-Json;if($saved.folder -ceq [IO.Path]::GetFullPath($Folder)){Remove-Item -LiteralPath $pointer -Force}}catch{Write-Host 'Установка завершена; повреждённый указатель другого запуска оставлен без изменений.'}}
}
function Get-SimpleBootIdentity {
  return (Get-CimInstance Win32_OperatingSystem -ErrorAction Stop).LastBootUpTime.ToUniversalTime().ToString('o')
}
function Suspend-SimpleRuntimeForRestart([string]$Stage,[string]$Message) {
  $saved=Read-SimpleSetupCheckpoint $script:InstallFolder
  if($saved){$saved.stage=$Stage;$saved.restartBoot=Get-SimpleBootIdentity;Write-SimpleSetupCheckpoint $saved}
  $error=New-Object InvalidOperationException ($Message+' Выбранная папка и адрес сохранены; после перезагрузки снова открой Easy Setup для продолжения.')
  $error.Data['SimpleSetupRestartRequired']=$true
  throw $error
}
function Get-SimpleWslStatusCode([string]$Wsl) {
  # WSL parses its command line itself: quoted "--status" is interpreted as a
  # Linux command, not an option. Do not use the generic argv quoting helper.
  $info=New-Object Diagnostics.ProcessStartInfo
  $info.FileName=$Wsl;$info.Arguments='--status'
  $info.UseShellExecute=$false;$info.CreateNoWindow=$true
  $info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true
  $process=New-Object Diagnostics.Process;$process.StartInfo=$info
  try {
    if(-not $process.Start()){throw 'Не удалось запустить проверку WSL.'}
    $stdout=$process.StandardOutput.ReadToEndAsync();$stderr=$process.StandardError.ReadToEndAsync()
    if(-not $process.WaitForExit(20000)){$process.Kill();$process.WaitForExit();throw 'Проверка WSL не завершилась за 20 секунд. Проверь wsl --status в PowerShell.'}
    $null=$stdout.GetAwaiter().GetResult();$null=$stderr.GetAwaiter().GetResult()
    return $process.ExitCode
  } finally {$process.Dispose()}
}
function Get-SimpleWslState {
  # Feature transition is independent from Docker installation and daemon state.
  $features=@();foreach($name in @('Microsoft-Windows-Subsystem-Linux','VirtualMachinePlatform')){try{$features+=Get-WindowsOptionalFeature -Online -FeatureName $name -ErrorAction Stop}catch{}}
  if(@($features|Where-Object{$_.State -in @('EnablePending','DisablePending')}).Count){return 'reboot-required'}
  $wsl=Join-Path $env:SystemRoot 'System32/wsl.exe'
  if(-not(Test-Path -LiteralPath $wsl -PathType Leaf)){return 'missing'}
  if((Get-SimpleWslStatusCode $wsl) -eq 0){return 'ready'}
  return 'unready'
}

function Find-Desktop {
  $locations = @(
    (Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Programs\DockerDesktop\Docker Desktop.exe'),
    (Join-Path ([Environment]::GetFolderPath('ProgramFiles')) 'Docker\Docker\Docker Desktop.exe')
    (Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Docker\Docker Desktop.exe')
  )
  foreach($key in @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Docker Desktop','HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Docker Desktop')) {
    $installed=Get-ItemProperty -LiteralPath $key -ErrorAction SilentlyContinue
    if($installed -and $installed.InstallLocation){$locations+=Join-Path $installed.InstallLocation 'Docker Desktop.exe'}
  }
  foreach ($candidate in ($locations|Select-Object -Unique)) {
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
  $saved=Read-SimpleSetupCheckpoint $script:InstallFolder
  $desktop=Find-Desktop
  if($saved -and $saved.stage -in @('wsl-reboot','docker-reboot') -and $saved.restartBoot -ceq (Get-SimpleBootIdentity)) {
    # Recheck WSL: older wizards saved false reboot checkpoints on this boot.
    # Docker's explicit installer reboot remains authoritative.
    if($saved.stage -eq 'docker-reboot' -or (Get-SimpleWslState) -ne 'ready'){
      Suspend-SimpleRuntimeForRestart $saved.stage 'Перезагрузи Windows для завершения уже выполненной подготовки Docker/WSL.'
    }
  }
  # An installer success is durable evidence; failure to locate Desktop is not
  # permission to run its installer again on every launch.
  if(-not $desktop -and $saved -and $saved.stage -in @('docker-reboot','docker-installed')) {
    throw 'Docker уже установлен, но его приложение пока не найдено. Открой Docker Desktop из меню Пуск и проверь завершение установки. Повторная установка не запускается; выбранная папка и адрес сохранены.'
  }
  if(-not $desktop -and -not($saved -and $saved.dockerConsent)) {
    Write-Host 'Для локального сервера нужен Docker Desktop. Для установки могут понадобиться права администратора и перезагрузка.'
    Write-Host 'Условия Docker Desktop: https://www.docker.com/legal/docker-subscription-service-agreement/'
    $consent=Read-Host 'Установить Docker Desktop и принять условия установки? [да/нет]'
    if($consent -notin @('да','д','yes','y')){throw 'Установка Docker отменена. Сервер не изменён.'}
    if($saved){$saved.dockerConsent=$true;Write-SimpleSetupCheckpoint $saved}
  }
  # A ready engine proves WSL need not be prepared again (other backends exist).
  if($desktop){$existingDocker=Join-Path (Split-Path -Parent $desktop) 'resources/bin/docker.exe';if((Test-Path -LiteralPath $existingDocker -PathType Leaf) -and (Test-LinuxEngine $existingDocker)){Write-Host 'Docker с Linux containers уже готов.';return}}
  $wslState=Get-SimpleWslState
  if($wslState -eq 'reboot-required'){Suspend-SimpleRuntimeForRestart 'wsl-reboot' 'Компоненты WSL/виртуализации ожидают перезагрузку. Перезагрузи Windows.'}
  if($wslState -ne 'ready') {
    if(Get-Command Register-SimpleSharedComponent -ErrorAction SilentlyContinue){Register-SimpleSharedComponent 'WSL' 'preparation-requested'}
    Write-Host 'Подготавливаю WSL2. Windows может запросить права администратора и перезагрузку.'
    $wsl=Join-Path $env:SystemRoot 'System32/wsl.exe'
    if($wslState -eq 'missing') {
      $ps=Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
      $enable=Start-Process $ps -Verb RunAs -ArgumentList '-NoProfile -Command "try { $r=Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux,VirtualMachinePlatform -All -NoRestart -ErrorAction Stop; if($r.RestartNeeded){exit 3010};exit 0 } catch { exit 1 }"' -Wait -PassThru
      if($enable.ExitCode -notin @(0,3010,1641)){throw 'Windows не завершила подготовку компонентов WSL2. Проверь сообщение окна; повторная установка Docker не запускалась.'}
      Suspend-SimpleRuntimeForRestart 'wsl-reboot' 'Компоненты WSL подготовлены. Перезагрузи Windows.'
    }
    $wslInstall=Start-Process $wsl -Verb RunAs -ArgumentList '--install --no-distribution' -Wait -PassThru
    if($wslInstall.ExitCode -in @(3010,1641)){Suspend-SimpleRuntimeForRestart 'wsl-reboot' 'WSL2 подготовлен. Перезагрузи Windows.'}
    if($wslInstall.ExitCode -ne 0){throw 'Windows не завершила автоматическую подготовку WSL2. Проверь сообщение окна; требуется Windows10 2004 или новее с обновлениями, либо Windows11.'}
    $preparedState=Get-SimpleWslState
    if($preparedState -eq 'reboot-required'){Suspend-SimpleRuntimeForRestart 'wsl-reboot' 'Компоненты WSL2 ожидают перезагрузку Windows.'}
    if($preparedState -ne 'ready'){throw 'WSL2 пока не готова, но Windows не подтвердила необходимость перезагрузки. Проверь wsl --status, wsl --version и компонент VirtualMachinePlatform в PowerShell от администратора. Повторная перезагрузка автоматически не запрашивается; выбранная папка и адрес сохранены.'}
  }
  if(-not $desktop) {
    if(-not(Get-Command Invoke-SimpleDownload -ErrorAction SilentlyContinue)){. (Join-Path $PSScriptRoot 'simple-easy-setup-download.ps1')}
    $installer=Join-Path $script:InstallFolder 'Docker-Desktop-Installer.exe'
    # Reuse only an official, currently signed installer after a WSL reboot.
    $signature=$null
    if(Test-Path -LiteralPath $installer -PathType Leaf){$signature=Get-AuthenticodeSignature -LiteralPath $installer}
    if(-not $signature -or $signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Docker'){
      Invoke-SimpleDownload -Uri 'https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe' -OutFile $installer -Label 'Docker Desktop' -TimeoutSec 900
      $signature=Get-AuthenticodeSignature -LiteralPath $installer
    }
    if($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Docker'){throw 'Подпись установщика Docker не подтверждена.'}
    $installProcess=Start-Process -FilePath $installer -ArgumentList 'install --accept-license --backend=wsl-2' -Verb RunAs -Wait -PassThru
    if($installProcess.ExitCode -in @(3010,1641)){Suspend-SimpleRuntimeForRestart 'docker-reboot' 'Docker установлен. Перезагрузи Windows.'}
    if($installProcess.ExitCode -ne 0){throw 'Установка Docker не завершилась. Проверь сообщение установщика; при запросе перезагрузки перезапусти Windows и повтори Easy Setup.'}
    if($saved){$saved=Read-SimpleSetupCheckpoint $script:InstallFolder;$saved.stage='docker-installed';Write-SimpleSetupCheckpoint $saved}
    $desktop=Find-Desktop
    if(-not $desktop){throw 'Установщик завершился, но Docker Desktop пока не найден. Открой Docker из меню Пуск. Выбранная папка и адрес сохранены; повторная установка не запускается.'}
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
