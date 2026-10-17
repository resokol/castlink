# CastLink: control only the explicitly selected, already running PowerPoint slideshow.
# Run with Windows PowerShell: powershell -NoProfile -STA -File .\CastLink-PowerPoint-Windows.ps1
param([switch]$FunctionsOnly)
$ErrorActionPreference='Stop'
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
function Get-CastLinkPresentationEndpoint([string]$Server) {
  $uri=$null
  if(-not [Uri]::TryCreate($Server,[UriKind]::Absolute,[ref]$uri) -or $uri.Scheme -cne 'https' -or $uri.UserInfo -or $uri.Query -or $uri.Fragment){throw 'Enter the HTTPS address of your CastLink server.'}
  return ([Uri]::new($uri,'/api/presentation-control')).AbsoluteUri
}
function Test-CastLinkPresentationCommand($Command,[string]$Connection,[long]$LastSequence,[long]$Now) {
  return ($Command -and $Command.id -cmatch '^[a-f0-9-]{36}$' -and $Command.connectionId -ceq $Connection -and $Command.direction -cin @('next','previous') -and ($Command.seq -is [int] -or $Command.seq -is [long]) -and $Command.seq -gt $LastSequence -and $Command.issuedAt -is [long] -and $Command.expiresAt -is [long] -and $Command.issuedAt -le ($Now+1000) -and $Command.expiresAt -gt $Now -and $Command.expiresAt -le ($Command.issuedAt+3000))
}
function Invoke-CastLinkPresentationRequest([string]$Endpoint,[string]$Token,[hashtable]$Body) {
  return Invoke-RestMethod -Method Post -Uri $Endpoint -Headers @{Authorization=('Bearer '+$Token)} -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes(($Body|ConvertTo-Json -Depth 5 -Compress))) -TimeoutSec 4 -MaximumRedirection 0
}
if($FunctionsOnly){return}
$app=$null;$show=$null;$presentation=$null;$view=$null
try {
  $endpoint=Get-CastLinkPresentationEndpoint (Read-Host 'CastLink HTTPS server address')
  $pairToken=(Read-Host 'One-time presentation pairing code from your caster page').Trim()
  if($pairToken -cnotmatch '^cp_[A-Za-z0-9_-]{43}$'){throw 'Invalid pairing code.'}
  $app=[Runtime.InteropServices.Marshal]::GetActiveObject('PowerPoint.Application')
  $windows=$app.SlideShowWindows
  if($windows.Count -lt 1){throw 'Start the slide show in desktop PowerPoint first.'}
  for($i=1;$i -le $windows.Count;$i++){$candidate=$windows.Item($i);try{Write-Host ($i.ToString()+': '+$candidate.Presentation.Name)}finally{$null=[Runtime.InteropServices.Marshal]::ReleaseComObject($candidate)}}
  $index=0;$choice=Read-Host 'Choose the slide show number'
  if(-not [int]::TryParse($choice,[ref]$index) -or $index -lt 1 -or $index -gt $windows.Count){throw 'Invalid slide show number.'}
  $show=$windows.Item($index);$presentation=$show.Presentation;$title=[string]$presentation.Name;$fullName=[string]$presentation.FullName;$hwnd=[long]$show.HWND;$view=$show.View
  Write-Host ('Allow next/previous navigation only for: '+$title)
  if((Read-Host 'Type YES to allow the caster you selected in CastLink; Ctrl+C stops control') -cne 'YES'){return}
  $connection=[Guid]::NewGuid().ToString();$linked=Invoke-CastLinkPresentationRequest $endpoint $pairToken @{action='connect';connectionId=$connection};$pairToken=$null
  if(-not $linked.sessionToken -or $linked.connectionId -cne $connection){throw 'Server did not confirm this pairing.'}
  $sessionToken=[string]$linked.sessionToken;$lastSequence=[long]0;$result=$null
  Write-Host 'Presentation control connected. Keep this window open; Ctrl+C stops control. The screen is shared separately in CastLink.'
  while($true){
    if([long]$show.HWND -ne $hwnd -or [string]$presentation.FullName -cne $fullName){throw 'The selected slide show changed. Pair again.'}
    $status=@{title=$title.Substring(0,[Math]::Min(160,$title.Length));ready=$true;page=[int]$view.CurrentShowPosition;pages=[int]$presentation.Slides.Count}
    $body=@{action='poll';connectionId=$connection;status=$status};if($result){$body.result=$result}
    $response=Invoke-CastLinkPresentationRequest $endpoint $sessionToken $body;$result=$null
    if($response.command){
      $command=$response.command;$now=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
      if(-not(Test-CastLinkPresentationCommand $command $connection $lastSequence $now)){throw 'Stale or invalid presentation command. Pair again.'}
      # Record before the COM call; a failure or lost ACK cannot repeat Next.
      $lastSequence=[long]$command.seq
      try{if($command.direction -ceq 'next'){$view.Next()}else{$view.Previous()};$result=@{seq=$lastSequence;ok=$true}}
      catch{$result=@{seq=$lastSequence;ok=$false;error='PowerPoint could not navigate the selected slide show.'}}
    }
    Start-Sleep -Milliseconds 500
  }
} catch {Write-Error 'Presentation control stopped. Check PowerPoint and the connection, then create a new pairing code in CastLink.'}
finally {
  $pairToken=$null;$sessionToken=$null
  foreach($value in @($view,$presentation,$show,$windows,$app)){if($value -and [Runtime.InteropServices.Marshal]::IsComObject($value)){$null=[Runtime.InteropServices.Marshal]::ReleaseComObject($value)}}
}
