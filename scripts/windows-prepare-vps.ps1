$ErrorActionPreference = 'Stop'
try {
  $profiles = $env:CASTLINK_PROFILE_ROOT
  if (-not $profiles -or -not (Test-Path -LiteralPath $profiles -PathType Container)) { throw 'Не найден каталог профилей. Запускай Prepare-VPS.cmd из своей папки Easy Setup.' }
  $ssh = Join-Path $env:SystemRoot 'System32\OpenSSH\ssh.exe'
  $keygen = Join-Path $env:SystemRoot 'System32\OpenSSH\ssh-keygen.exe'
  if (-not (Test-Path -LiteralPath $ssh -PathType Leaf) -or -not (Test-Path -LiteralPath $keygen -PathType Leaf)) { throw 'Добавь «Клиент OpenSSH» в дополнительных компонентах Windows и снова запусти Prepare-VPS.cmd.' }
  $server = Read-Host 'IP или имя собственного VPS'
  $login = Read-Host 'SSH пользователь (например, root)'
  $portText = Read-Host 'SSH порт [22]'
  $port = 22
  if ($server -notmatch '^[a-zA-Z0-9][a-zA-Z0-9.:-]{0,252}$' -or $login -notmatch '^[a-z_][a-z0-9_-]{0,31}$') { throw 'Некорректный адрес VPS или SSH пользователь.' }
  if ($portText -and (-not [int]::TryParse($portText,[ref]$port) -or $port -lt 1 -or $port -gt 65535)) { throw 'SSH порт должен быть числом от 1 до 65535.' }
  $directory = Join-Path $profiles 'ssh'
  $null = New-Item -ItemType Directory -Path $directory -Force
  $key = Join-Path $directory 'id_ed25519'
  $knownHosts = Join-Path $directory 'known_hosts'
  if (-not (Test-Path -LiteralPath $key -PathType Leaf)) {
    Write-Host 'Создаю отдельный SSH-ключ CastLink. Пароль ключа необязателен; с паролем для автоматической установки понадобится ssh-agent.'
    & $keygen -t ed25519 -f $key -C CastLink-Easy-Setup
    if ($LASTEXITCODE -ne 0) { throw 'Создание SSH-ключа не завершилось.' }
  }
  if (-not (Test-Path -LiteralPath ($key+'.pub') -PathType Leaf)) { throw 'У существующего SSH-ключа отсутствует публичный файл. Восстанови его; существующий ключ не заменён.' }
  Write-Host 'Добавь этот ПУБЛИЧНЫЙ ключ выбранному SSH пользователю через панель или консоль провайдера VPS:'
  Write-Host ([IO.File]::ReadAllText($key+'.pub'))
  $null = Read-Host 'Нажми Enter, когда публичный ключ добавлен'
  Write-Host 'При первом подключении сравни fingerprint с ключом сервера в панели провайдера. OpenSSH спросит подтверждение.'
  $knownOption = 'UserKnownHostsFile="'+$knownHosts.Replace('\','/')+'"'
  $common = @('-F','none','-o',$knownOption,'-o','GlobalKnownHostsFile=none','-i',$key,'-o','IdentitiesOnly=yes','-o','PasswordAuthentication=no','-o','KbdInteractiveAuthentication=no','-o','ConnectTimeout=10','-p',"$port",'-l',$login)
  & $ssh @common -o StrictHostKeyChecking=ask -- $server true
  if ($LASTEXITCODE -ne 0) { throw 'SSH-подключение не подтверждено. Проверь адрес, пользователя, публичный ключ и fingerprint сервера.' }
  & $ssh @common -o StrictHostKeyChecking=yes -o BatchMode=yes -- $server true
  if ($LASTEXITCODE -ne 0) {
    Write-Host ('Для ключа с паролем добавь его в запущенный ssh-agent: "'+(Join-Path $env:SystemRoot 'System32\OpenSSH\ssh-add.exe')+'" "'+$key+'"')
    throw 'Вход по ключу пока требует ручного ввода. После настройки ssh-agent повтори Prepare-VPS.cmd.'
  }
  if ($login -ne 'root') { throw 'Подготовка Ubuntu в этом выпуске выполняется пользователем root. Повтори Prepare-VPS.cmd с root; существующие данные не изменены.' }
  $bootstrap = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'ubuntu-easy-setup-bootstrap.sh')).Replace("`r`n","`n")
  Write-Host 'Проверяю Ubuntu 22.04/24.04 x86_64, Python3, Docker Engine и Compose на выбранном VPS.'
  $bootstrap | & $ssh @common -o StrictHostKeyChecking=yes -o BatchMode=yes -- $server 'bash -s -- check'
  $checkCode = $LASTEXITCODE
  if ($checkCode -eq 10) {
    Write-Host 'На VPS нужно установить или запустить Docker Engine / обновить Compose. Будет использован официальный apt-репозиторий Docker. Работающий Docker не перезапускается.'
    $consent = Read-Host 'Выполнить подготовку этого VPS? [да/нет]'
    if ($consent -notin @('да','Да','yes','y')) { throw 'Подготовка VPS отложена. Установи Docker самостоятельно и повтори Prepare-VPS.cmd.' }
    $bootstrap | & $ssh @common -o StrictHostKeyChecking=yes -o BatchMode=yes -- $server 'bash -s -- install'
  } elseif ($checkCode -eq 0) {
    $bootstrap | & $ssh @common -o StrictHostKeyChecking=yes -o BatchMode=yes -- $server 'bash -s -- prepare'
  } else { throw 'Проверка VPS не прошла. Подробности приведены выше.' }
  if ($LASTEXITCODE -ne 0) { throw 'Подготовка Docker или каталога /opt/castlink не завершилась. Данные прежней установки сохранены.' }
  Write-Host 'Этот выпуск использует приватный образ GitHub. Для загрузки VPS нужен доступ к пакету resokol/castlink-easy-web.'
  Write-Host 'В следующем SSH-окне введи GitHub username и PAT classic с read:packages и доступом к этому пакету. Docker сохранит вход на VPS; токен не передаётся в аргументах команды.'
  $registry = Read-Host 'Выполнить docker login ghcr.io? [да/уже настроено]'
  if ($registry -in @('да','Да','yes','y')) {
    & $ssh @common -t -o StrictHostKeyChecking=yes -o BatchMode=yes -- $server 'docker login ghcr.io'
    if ($LASTEXITCODE -ne 0) { throw 'Вход в приватный реестр не завершён. Настрой доступ и повтори подготовку.' }
  } elseif ($registry -notin @('уже настроено','Уже настроено')) { throw 'Для приватного выпуска сначала настрой доступ VPS к ghcr.io.' }
  Write-Host 'Подготовка завершена. Запусти EasySetup.cmd и выбери «Свой VPS» с тем же адресом, root и портом. Доступ к образам окончательно проверит установка.'
  exit 0
} catch { Write-Host $_.Exception.Message; exit 3 }
