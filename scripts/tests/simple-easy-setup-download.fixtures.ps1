param([string]$HelperPath)
$ErrorActionPreference='Stop'
. $HelperPath
function Assert-Download([bool]$Condition,[string]$Message) { if(-not $Condition){throw $Message} }
$folder=Join-Path ([IO.Path]::GetTempPath()) ('castlink-download-fixture-'+[Guid]::NewGuid())
$null=New-Item -ItemType Directory -Path $folder
$job=$null
try {
  $job=Start-Job -ArgumentList $folder -ScriptBlock {
    param($Folder)
    $ErrorActionPreference='Stop'
    $listener=New-Object Net.Sockets.TcpListener -ArgumentList ([Net.IPAddress]::Loopback),0
    $listener.Start()
    [IO.File]::WriteAllText((Join-Path $Folder 'ready'),[string]$listener.LocalEndpoint.Port)
    try {
      $deadline=[DateTime]::UtcNow.AddSeconds(45)
      while(-not(Test-Path (Join-Path $Folder 'stop')) -and [DateTime]::UtcNow -lt $deadline){
        if(-not $listener.Pending()){Start-Sleep -Milliseconds 20;continue}
        $client=$listener.AcceptTcpClient();$stream=$client.GetStream();$stream.ReadTimeout=5000
        try {
          $request=''
          while(-not $request.EndsWith("`r`n`r`n") -and $request.Length -lt 8192){$b=$stream.ReadByte();if($b -lt 0){break};$request+=[char]$b}
          $path=($request -split ' ')[1].Split('?')[0]
          $ascii=[Text.Encoding]::ASCII
          if($path -eq '/error'){$head=$ascii.GetBytes("HTTP/1.1 404 Not Found`r`nContent-Length: 2`r`nConnection: close`r`n`r`nno");$stream.Write($head,0,$head.Length);continue}
          if($path -eq '/unknown'){$head=$ascii.GetBytes("HTTP/1.1 200 OK`r`nTransfer-Encoding: chunked`r`nConnection: close`r`n`r`n");$stream.Write($head,0,$head.Length);$data=New-Object byte[] 4096;for($i=0;$i -lt 16;$i++){$chunk=$ascii.GetBytes("1000`r`n");$stream.Write($chunk,0,$chunk.Length);$stream.Write($data,0,$data.Length);$stream.WriteByte(13);$stream.WriteByte(10);$stream.Flush();Start-Sleep -Milliseconds 20};$end=$ascii.GetBytes("0`r`n`r`n");$stream.Write($end,0,$end.Length);continue}
          if($path -eq '/headers' -and $request -notmatch 'User-Agent: CastLink-Fixture'){$head=$ascii.GetBytes("HTTP/1.1 400 Bad Request`r`nContent-Length: 0`r`nConnection: close`r`n`r`n");$stream.Write($head,0,$head.Length);continue}
          $length=if($path -eq '/abort'){1024}elseif($path -eq '/stall'){10}else{524288}
          $head=$ascii.GetBytes("HTTP/1.1 200 OK`r`nContent-Length: $length`r`nConnection: close`r`n`r`n");$stream.Write($head,0,$head.Length);$stream.Flush()
          if($path -eq '/stall'){Start-Sleep -Seconds 3;continue}
          if($path -eq '/abort'){$stream.WriteByte(1);$stream.WriteByte(2);$stream.WriteByte(3);continue}
          $data=New-Object byte[] 16384
          for($i=0;$i -lt 32;$i++){$stream.Write($data,0,$data.Length);$stream.Flush();Start-Sleep -Milliseconds 20}
        } catch { } finally {$stream.Dispose();$client.Dispose()}
      }
    } finally {$listener.Stop()}
  }
  $deadline=[DateTime]::UtcNow.AddSeconds(15)
  while(-not(Test-Path (Join-Path $folder 'ready'))){if([DateTime]::UtcNow -gt $deadline){throw 'HTTP fixture did not start'};Start-Sleep -Milliseconds 50}
  $base='http://127.0.0.1:'+([IO.File]::ReadAllText((Join-Path $folder 'ready')))
  $oldTls=[Net.ServicePointManager]::SecurityProtocol
  $destination=Join-Path $folder 'result.bin'
  foreach($endpoint in @('known','unknown','headers')){
    [IO.File]::WriteAllText($destination,'previous output')
    $script:metrics=New-Object Collections.Generic.List[object]
    $callback={param($p)$script:metrics.Add($p)}
    $result=@(Invoke-SimpleDownload -Uri ($base+'/'+$endpoint+'?secret=not-for-telemetry') -OutFile $destination -Label 'Fixture package' -Headers @{'User-Agent'='CastLink-Fixture'} -TimeoutSec 10 -Progress $callback)
    Assert-Download ($result.Count -eq 0) 'Download leaked pipeline response/file objects'
    $size=if($endpoint -eq 'unknown'){65536}else{524288}
    Assert-Download ((Get-Item $destination).Length -eq $size) 'Actual downloaded body differs'
    $last=$script:metrics[$script:metrics.Count-1]
    Assert-Download ($last.completed -and $last.bytes -eq $size -and $last.bytesPerSecond -gt 0) 'Real final bytes/rate missing'
    foreach($p in $script:metrics){Assert-Download ((@($p.PSObject.Properties.Name | Sort-Object) -join ',') -ceq 'bytes,bytesPerSecond,completed,label,totalBytes') 'Telemetry schema contains extra fields';Assert-Download (($p | ConvertTo-Json) -notmatch 'secret=|http:|127.0.0.1') 'Telemetry leaked URL';Assert-Download ($p.bytes -ge 0 -and $p.bytesPerSecond -ge 0) 'Invalid progress values'}
    if($endpoint -eq 'unknown'){Assert-Download ($null -eq $last.totalBytes) 'Chunked response invented total'}else{Assert-Download ($last.totalBytes -eq $size) 'Known content length lost'}
    Assert-Download ([Net.ServicePointManager]::SecurityProtocol -eq $oldTls) 'TLS preference not restored'
  }
  $newFile=Join-Path $folder 'пакет с пробелами.bin'
  $null=Invoke-SimpleDownload -Uri ($base+'/known') -OutFile $newFile -Label 'New package' -TimeoutSec 10 -Progress {param($p)}
  Assert-Download ((Get-Item -LiteralPath $newFile).Length -eq 524288) 'First download commit failed'
  foreach($endpoint in @('abort','error','stall')){
    [IO.File]::WriteAllText($destination,'previous output')
    $script:metrics=New-Object Collections.Generic.List[object]
    $failed=$false;$watch=[Diagnostics.Stopwatch]::StartNew()
    try{Invoke-SimpleDownload -Uri ($base+'/'+$endpoint) -OutFile $destination -Label 'Fixture package' -TimeoutSec 1 -Progress {param($p)$script:metrics.Add($p)}}catch{$failed=$true}
    Assert-Download ($failed -and [IO.File]::ReadAllText($destination) -ceq 'previous output') 'Failure replaced previous output'
    Assert-Download (@($script:metrics | Where-Object {$_.completed}).Count -eq 0) 'Failure claimed completion'
    Assert-Download (@(Get-ChildItem $folder -Force -Filter '.castlink-download-*.tmp').Count -eq 0) 'Partial file remained'
    Assert-Download ([Net.ServicePointManager]::SecurityProtocol -eq $oldTls) 'Failure changed TLS preference'
    Assert-Download ($watch.Elapsed.TotalSeconds -lt 5) 'Bounded timeout failed'
  }
  $script:progressCalls=New-Object Collections.Generic.List[object]
  function Write-Progress {param($Id,$Activity,$Status,$PercentComplete,[switch]$Completed)$script:progressCalls.Add([pscustomobject]@{id=$Id;percent=$PercentComplete;completed=[bool]$Completed;preference=$ProgressPreference})}
  $ProgressPreference='SilentlyContinue'
  Report-SimpleDownloadProgress ([pscustomobject]@{label='Package';bytes=5;totalBytes=10;bytesPerSecond=2;completed=$false})
  Report-SimpleDownloadProgress ([pscustomobject]@{label='Package';bytes=5;totalBytes=$null;bytesPerSecond=2;completed=$false})
  Report-SimpleDownloadProgress ([pscustomobject]@{label='Package';bytes=10;totalBytes=10;bytesPerSecond=2;completed=$true})
  Assert-Download ($script:progressCalls[0].percent -eq 50 -and $script:progressCalls[1].percent -eq -1 -and $script:progressCalls[2].completed) 'Formatter fake/missing progress'
  Assert-Download ($ProgressPreference -eq 'SilentlyContinue' -and $script:progressCalls[0].preference -eq 'Continue') 'Local progress preference changed caller'
  Write-Host 'PASS: actual HTTP known/chunked/header/abort/error/timeout, real bytes/rate, safe telemetry, atomic replacement, TLS restore, local progress preference'
} finally {
  [IO.File]::WriteAllText((Join-Path $folder 'stop'),'stop')
  if($job){$null=Wait-Job $job -Timeout 5;Stop-Job $job;Remove-Job $job}
  Remove-Item -LiteralPath $folder -Recurse -Force
}
