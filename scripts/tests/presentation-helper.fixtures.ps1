param([string]$HelperPath)
$ErrorActionPreference='Stop'
. $HelperPath -FunctionsOnly
if((Get-CastLinkPresentationEndpoint 'https://castlink.example/studio') -cne 'https://castlink.example/api/presentation-control'){throw 'Fixed API endpoint lost'}
foreach($url in @('http://castlink.example','https://user:secret@castlink.example','https://castlink.example?token=secret')){try{$null=Get-CastLinkPresentationEndpoint $url;throw 'Accepted an invalid server URL'}catch{if($_.Exception.Message -ceq 'Accepted an invalid server URL'){throw}}}
$connection=[Guid]::NewGuid().ToString();$now=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
# Use actual ConvertFrom-Json numeric types, including Int32 sequence 1 on PS5.
$command=('{"id":"'+[Guid]::NewGuid().ToString()+'","connectionId":"'+$connection+'","seq":1,"direction":"next","issuedAt":'+$now+',"expiresAt":'+($now+3000)+'}')|ConvertFrom-Json
if(-not(Test-CastLinkPresentationCommand $command $connection 0 $now)){throw 'Fresh command refused'}
if(Test-CastLinkPresentationCommand $command $connection 1 $now){throw 'Replayed sequence accepted'}
if(Test-CastLinkPresentationCommand $command ([Guid]::NewGuid().ToString()) 0 $now){throw 'Different connection accepted'}
if(Test-CastLinkPresentationCommand $command $connection 0 ($now+3000)){throw 'Expired command accepted'}
$command.direction='exec';if(Test-CastLinkPresentationCommand $command $connection 0 $now){throw 'Arbitrary command accepted'}
$command.direction='next';$command.expiresAt=$now+3001;if(Test-CastLinkPresentationCommand $command $connection 0 $now){throw 'Unbounded command accepted'}
Write-Output 'PRESENTATION_HELPER_PROTOCOL_PASS fixed-HTTPS-endpoint next-previous-only actual-JSON-numbers exact-session sequence expiry'
