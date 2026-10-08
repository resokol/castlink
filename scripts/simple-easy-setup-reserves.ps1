$ErrorActionPreference='Stop'
function Show-SimpleReserveMessage([string]$Line) {
  try { $message=$Line | ConvertFrom-Json } catch { throw 'Резервный сервер вернул некорректный ответ.' }
  if($message.progress){
    $labels=@{runtime='Проверка Ubuntu и Docker';download='Загрузка текущего выпуска';images='Загрузка серверных компонентов';start='Запуск CastLink';database='Подготовка базы';ready='Проверка HTTPS';pairing='Подключение серверов'}
    $progress=$message.progress;$stage=[string]$labels[[string]$progress.stage]
    if($stage){
      $status=$stage
      if($null -ne $progress.bytes){$status+=' · '+([Math]::Round([double]$progress.bytes/1MB,1)).ToString()+' МБ';if($progress.bytesPerSecond){$status+=' · '+([Math]::Round([double]$progress.bytesPerSecond/1MB,1)).ToString()+' МБ/с'}}
      $percent=if($progress.total -gt 0){[Math]::Min(100,[int](100*[double]$progress.bytes/[double]$progress.total))}else{-1}
      $ProgressPreference='Continue'
      Write-Progress -Id 3 -Activity 'Подключение резервного CastLink' -Status $status -PercentComplete $percent
    }
  }
  return $message
}
function Read-SimpleReserveStream($Reader,[int]$TimeoutSeconds) {
  $deadline=[DateTime]::UtcNow.AddSeconds($TimeoutSeconds);$result=$null;$bytes=0
  while($true){
    $line=$Reader.ReadLineAsync()
    while(-not $line.Wait(250)){if([DateTime]::UtcNow -ge $deadline){throw 'Подключение резерва не завершилось вовремя; данные VPS сохранены.'}}
    $text=$line.GetAwaiter().GetResult();if($null -eq $text){break}
    $bytes+=$text.Length;if($bytes -gt 2097152){throw 'Ответ подключения слишком большой.'}
    $message=Show-SimpleReserveMessage $text
    if($message.ok){$result=$message}
  }
  if(-not $result -or -not $result.profile){throw 'Подключение резерва не подтверждено. Проверь root SSH, Ubuntu, порты и HTTPS; данные VPS сохранены.'}
  return $result.profile
}
function Invoke-SimpleReserveOperator([string]$InputText) {
  $composeArguments=@('compose','--project-directory',$script:ServerFolder,'-f',($script:ServerFolder+'/compose.json'),'exec','-T','web','node','/app/scripts/server-provisioning-operator.mjs')
  if($script:SshSession){
    $command='docker --host unix:///var/run/docker.sock '+(($composeArguments|ForEach-Object{ConvertTo-SimplePosixLiteral $_}) -join ' ')
    $operation=$script:SshSession.SshClient.CreateCommand($command)
    try{
      $operation.CommandTimeout=[TimeSpan]::FromSeconds(2400);$pending=$operation.BeginExecute()
      $stdin=$operation.CreateInputStream();$bytes=[Text.Encoding]::UTF8.GetBytes($InputText)
      try{$stdin.Write($bytes,0,$bytes.Length)}finally{[Array]::Clear($bytes,0,$bytes.Length);$stdin.Dispose()}
      $reader=New-Object IO.StreamReader($operation.OutputStream,(New-Object Text.UTF8Encoding($false)))
      try{$profile=Read-SimpleReserveStream $reader 2400}finally{$reader.Dispose()}
      $null=$operation.EndExecute($pending)
      if($operation.ExitStatus -ne 0){throw 'Резервный сервер не подключён.'}
      return $profile
    }catch{throw 'Не удалось подключить резерв по SSH. Проверь данные VPS и HTTPS; существующие данные сохранены.'}finally{$operation.Dispose()}
  }
  $info=New-Object Diagnostics.ProcessStartInfo
  $info.FileName=$script:DockerExe;$info.Arguments=((@('--context','desktop-linux')+$composeArguments)|ForEach-Object{Quote-SimpleArgument $_}) -join ' '
  $info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true;$info.RedirectStandardInput=$true
  $info.StandardOutputEncoding=New-Object Text.UTF8Encoding($false)
  $process=New-Object Diagnostics.Process;$process.StartInfo=$info
  try{
    $consoleEncoding=[Console]::InputEncoding
    try{[Console]::InputEncoding=New-Object Text.UTF8Encoding($false);if(-not $process.Start()){throw 'Не удалось запустить подключение резерва.'}}
    finally{[Console]::InputEncoding=$consoleEncoding}
    $stderr=$process.StandardError.ReadToEndAsync();$bytes=(New-Object Text.UTF8Encoding($false)).GetBytes($InputText)
    try{$process.StandardInput.BaseStream.Write($bytes,0,$bytes.Length);$process.StandardInput.BaseStream.Close()}finally{[Array]::Clear($bytes,0,$bytes.Length)}
    $profile=Read-SimpleReserveStream $process.StandardOutput 2400
    if(-not $process.WaitForExit(15000) -or $process.ExitCode -ne 0){throw 'Резервный сервер не подключён.'}
    $null=$stderr.GetAwaiter().GetResult();return $profile
  }finally{try{if(-not $process.HasExited){$process.Kill();$process.WaitForExit()}}catch{};$process.Dispose();$ProgressPreference='Continue';Write-Progress -Id 3 -Activity 'Подключение резервного CastLink' -Completed}
}
function Add-SimpleReserveServers([string]$Folder,[object]$State) {
  while($true){
    $answer=Read-SimpleValue 'Добавить ещё один резервный сервер сейчас? да/нет (можно позже из студии)' 'нет'
    if($answer -notin @('да','д','yes','y')){return}
    do{$mode=Read-Host 'Резерв: 1 — Установить CastLink на пустой VPS; 2 — Подключить установленный CastLink'}while($mode -notin @('1','2'))
    $hostName=Read-SimpleValue 'Публичный IPv4 резервного VPS' '';Assert-SimplePublicIPv4 $hostName
    $portText=Read-SimpleValue 'SSH порт резервного VPS' '22';$port=0
    if(-not [int]::TryParse($portText,[ref]$port) -or $port -lt 1 -or $port -gt 65535){throw 'SSH порт должен быть от 1 до 65535.'}
    $label=Read-SimpleValue 'Название резервного сервера' 'Резервный сервер'
    $probe=@{action='fingerprint';host=$hostName;port=$port}|ConvertTo-Json -Compress
    $observed=(Invoke-DeploymentCompose @('exec','-T','web','node','/app/scripts/server-provisioning-operator.mjs') $probe 30)|ConvertFrom-Json
    if([string]$observed.fingerprint -notmatch '^SHA256:[A-Za-z0-9+/]{43}$'){throw 'Не удалось получить SSH ключ резервного сервера.'}
    $trust=Read-Host ('SSH '+$hostName+':'+$port+' fingerprint '+$observed.fingerprint+'. Сверь ключ с VPS и введи yes, чтобы доверять серверу')
    if($trust -cne 'yes'){Write-Host 'Резерв не подключён. Можно добавить его позже из студии.';continue}
    $password=Read-Host 'Root SSH пароль резервного VPS (не сохраняется)' -AsSecureString
    $pointer=[IntPtr]::Zero;$plain=$null;$request=$null;$connectionInput=$null
    try{
      $pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
      $plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
      $connectionInput=@{host=$hostName;port=$port;label=$label;fingerprint=[string]$observed.fingerprint;password=$plain;mode=$(if($mode -eq '1'){'deploy'}else{'connect'})}
      $request=@{action='provision';input=$connectionInput}|ConvertTo-Json -Depth 4 -Compress
      $profile=Invoke-SimpleReserveOperator $request
      $connectionInput.password=$null
      $profiles=@();if($State.PSObject.Properties['serverProfiles']){$profiles=@($State.serverProfiles)}
      $State|Add-Member -NotePropertyName serverProfiles -NotePropertyValue @($profiles+$profile) -Force
      Save-SimpleState $Folder $State
      Write-Host ('Резерв подключён: '+$profile.label+' · '+$profile.origin)
    }finally{if($pointer -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)};if($connectionInput){$connectionInput.password=$null};$plain=$null;$request=$null;$password.Dispose()}
  }
}
