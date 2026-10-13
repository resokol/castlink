function Report-SimpleDownloadProgress([object]$Progress) {
  # Local preference only: do not change the caller's quiet-mode setting.
  $ProgressPreference='Continue'
  $bytes=[long]$Progress.bytes
  $rate=([double]$Progress.bytesPerSecond/1MB).ToString('0.0')
  $status=($bytes/1MB).ToString('0.0')+' МБ'
  $percent=-1
  if ($null -ne $Progress.totalBytes) {
    $total=[long]$Progress.totalBytes
    $status+=' / '+($total/1MB).ToString('0.0')+' МБ'
    if ($total -gt 0) { $percent=[Math]::Min(100,[int][Math]::Floor(100.0*$bytes/$total)) } elseif ($Progress.completed) { $percent=100 }
  }
  $status+=' · '+$rate+' МБ/с'
  if ($Progress.completed) { Write-Progress -Id 74 -Activity $Progress.label -Completed }
  else { Write-Progress -Id 74 -Activity $Progress.label -Status $status -PercentComplete $percent }
}
function Invoke-SimpleDownload {
  param([Parameter(Mandatory=$true)][string]$Uri,
        [Parameter(Mandatory=$true)][string]$OutFile,
        [Parameter(Mandatory=$true)][string]$Label,
        [ValidateRange(1,2147483)][int]$TimeoutSec=900,
        [hashtable]$Headers=@{},[scriptblock]$Progress)
  $destination=[IO.Path]::GetFullPath($OutFile)
  $parent=Split-Path $destination -Parent
  $null=[IO.Directory]::CreateDirectory($parent)
  $temporary=Join-Path $parent ('.castlink-download-'+[Guid]::NewGuid().ToString('N')+'.tmp')
  $oldTls=[Net.ServicePointManager]::SecurityProtocol
  $request=$null;$response=$null;$stream=$null;$file=$null
  $clock=[Diagnostics.Stopwatch]::StartNew()
  $bytes=[long]0;$total=$null;$sampleBytes=[long]0;$sampleSeconds=0.0;$rate=0.0
  $notify=if($Progress){$Progress}else{ {param($p) Report-SimpleDownloadProgress $p} }
  try {
    [Net.ServicePointManager]::SecurityProtocol=$oldTls -bor [Net.SecurityProtocolType]::Tls12
    $request=[Net.HttpWebRequest]::Create($Uri)
    $request.Method='GET';$request.AllowAutoRedirect=$true
    $request.Timeout=$TimeoutSec*1000;$request.ReadWriteTimeout=$TimeoutSec*1000
    foreach($key in $Headers.Keys) {
      switch ([string]$key) {
        'User-Agent' { $request.UserAgent=[string]$Headers[$key] }
        'Accept' { $request.Accept=[string]$Headers[$key] }
        default { $request.Headers[[string]$key]=[string]$Headers[$key] }
      }
    }
    $response=$request.GetResponse()
    if ($response.ContentLength -ge 0) { $total=[long]$response.ContentLength }
    $stream=$response.GetResponseStream()
    $file=New-Object IO.FileStream -ArgumentList $temporary,([IO.FileMode]::CreateNew),([IO.FileAccess]::Write),([IO.FileShare]::None)
    $buffer=New-Object byte[] 65536
    $null=& $notify ([pscustomobject]@{label=$Label;bytes=$bytes;totalBytes=$total;bytesPerSecond=$rate;completed=$false})
    while($true) {
      $remaining=$TimeoutSec-$clock.Elapsed.TotalSeconds
      if ($remaining -le 0) { throw 'Истёк срок загрузки файла.' }
      if ($stream.CanTimeout) { $stream.ReadTimeout=[Math]::Max(1,[int][Math]::Ceiling($remaining*1000)) }
      $count=$stream.Read($buffer,0,$buffer.Length)
      if ($clock.Elapsed.TotalSeconds -gt $TimeoutSec) { throw 'Истёк срок загрузки файла.' }
      if ($count -eq 0) { break }
      $file.Write($buffer,0,$count);$bytes+=$count
      if ($null -ne $total -and $bytes -gt $total) { throw 'Размер загрузки не совпал с заявленным.' }
      $seconds=$clock.Elapsed.TotalSeconds
      if ($seconds-$sampleSeconds -ge 0.25) {
        $rate=($bytes-$sampleBytes)/($seconds-$sampleSeconds);$sampleBytes=$bytes;$sampleSeconds=$seconds
        $null=& $notify ([pscustomobject]@{label=$Label;bytes=$bytes;totalBytes=$total;bytesPerSecond=$rate;completed=$false})
      }
    }
    if ($null -ne $total -and $bytes -ne $total) { throw 'Файл загружен не полностью.' }
    if ($clock.Elapsed.TotalSeconds-$sampleSeconds -gt 0 -and $bytes -gt $sampleBytes) { $rate=($bytes-$sampleBytes)/($clock.Elapsed.TotalSeconds-$sampleSeconds) }
    $file.Flush($true);$file.Dispose();$file=$null
    if ($clock.Elapsed.TotalSeconds -gt $TimeoutSec) { throw "Истёк срок загрузки файла." }
    if (Test-Path -LiteralPath $destination) { [IO.File]::Replace($temporary,$destination,[Management.Automation.Language.NullString]::Value) }
    else { [IO.File]::Move($temporary,$destination) }
    try { $null=& $notify ([pscustomobject]@{label=$Label;bytes=$bytes;totalBytes=$total;bytesPerSecond=$rate;completed=$true}) } catch { } # A completed display cannot undo the successful file commit.
  } catch {
    # Close the display on failure without claiming a successful callback.
    if (-not $Progress) { try { $ProgressPreference="Continue";Write-Progress -Id 74 -Activity $Label -Completed } catch { } }
    # Never propagate URLs/query strings/headers or arbitrary server error bodies.
    if ($_.Exception -is [Net.WebException] -and $_.Exception.Response) {
      $response=$_.Exception.Response
      throw ('Не удалось загрузить файл: HTTP '+[int]$response.StatusCode+'.')
    }
    throw 'Не удалось полностью загрузить файл. Прежний файл сохранён, если он существовал.'
  } finally {
    try {
      if($file){$file.Dispose()};if($stream){$stream.Dispose()};if($response){$response.Dispose()};if($request){$request.Abort()}
      if(Test-Path -LiteralPath $temporary){Remove-Item -LiteralPath $temporary -Force}
    } finally {
      [Net.ServicePointManager]::SecurityProtocol=$oldTls
      $clock.Stop()
    }
  }
}
