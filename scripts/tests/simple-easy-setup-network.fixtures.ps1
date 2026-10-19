param([string]$HelperPath,[switch]$DockerSmoke,[string]$CaddyImage='')
$ErrorActionPreference='Stop'
. $HelperPath
function Test-SimpleNetworkProxyRuntime([string]$CaddyImage) {
$prefix='castlink-net-smoke-'+[Guid]::NewGuid().ToString('N').Substring(0,10)
$folder=Join-Path ([IO.Path]::GetTempPath()) $prefix
$null=New-Item -ItemType Directory $folder
$containers=New-Object Collections.Generic.List[string]
function Docker([string[]]$Arguments){$r=Invoke-SimpleProcess 'docker' (@('--context','desktop-linux')+$Arguments) '' 45;if($r.code -ne 0){throw $r.stderr};return $r.stdout.Trim()}
$backend=@'
const http=require("http");let admissions=[];function handler(req,res){if(req.url.split("?")[0]==="/api/media-admission"){admissions.push(req.headers);res.statusCode=(req.headers["x-forwarded-uri"]||"").includes("deny=1")?403:204;res.end();return}res.setHeader("content-type","application/json");res.end(JSON.stringify({headers:req.headers,port:req.socket.localPort,admissions}))};http.createServer(handler).listen(3000,"0.0.0.0");http.createServer(handler).listen(7880,"0.0.0.0");
'@
$client=@'
const http=require("http");const trusted=process.argv[1]==="trusted";const expectedProto=trusted?"https":"http";const expectedIp=trusted?"198.51.100.23":Object.values(require("os").networkInterfaces()).flat().find(x=>!x.internal&&x.family==="IPv4").address;const expectedHost=trusted?"cast.example.com:8443":"edge.test:777";function request(path){return new Promise((resolve,reject)=>{const q=http.get({hostname:"edge",port:80,path,headers:{host:"edge.test:777","x-forwarded-proto":"https","x-forwarded-host":"cast.example.com:8443","x-forwarded-for":"198.51.100.23",forwarded:"host=cast.example.com;proto=https"}},r=>{let b="";r.on("data",d=>b+=d);r.on("end",()=>resolve({status:r.statusCode,body:b?JSON.parse(b):null}))});q.on("error",reject)})};(async()=>{let first;for(let i=0;i<30;i++){try{first=await request("/hello");break}catch{await new Promise(r=>setTimeout(r,100))}}if(!first)throw Error("Caddy not ready");function check(r,label){if(r.status!==200||r.body.headers["x-forwarded-proto"]!==expectedProto||r.body.headers["x-forwarded-host"]!==expectedHost||r.body.headers["x-forwarded-for"]!==expectedIp)throw Error(label+" headers "+JSON.stringify(r))}check(first,"WEB");const rtc=await request("/rtc");check(rtc,"RTC");if(rtc.body.port!==7880)throw Error("RTC destination wrong");if(!rtc.body.admissions.length)throw Error("No media admission");const a=rtc.body.admissions.at(-1);if(a["x-forwarded-proto"]!==expectedProto||a["x-forwarded-host"]!==expectedHost||a["x-forwarded-for"]!==expectedIp)throw Error("Admission original origin wrong "+JSON.stringify(a));const denied=await request("/rtc?deny=1");if(denied.status!==403)throw Error("Admission denial bypassed "+JSON.stringify(denied));console.log((trusted?"TRUSTED":"UNTRUSTED")+"_WEB_RTC_ADMISSION_PASS")})().catch(e=>{console.error(e.message);process.exitCode=1})
'@
try{
 $null=Docker @('network','create','--internal',$prefix)
 $subnet=Docker @('network','inspect',$prefix,'--format','{{(index .IPAM.Config 0).Subnet}}')
 $backendName=$prefix+'-backend';$containers.Add($backendName)
 $null=Docker @('run','--rm','-d','--network',$prefix,'--name',$backendName,'--network-alias','web','--network-alias','livekit','node:22-bookworm-slim','node','-e',$backend)
 foreach($trust in @('untrusted','trusted')){
  $state=[pscustomobject]@{address='cast.example.com';publicHttps=$true;network=[pscustomobject]@{mode='proxy';publicOrigin='https://cast.example.com:8443';mediaIp='203.0.113.2';trustedProxies=@($(if($trust -eq 'trusted'){$subnet}else{'127.0.0.1'}))}}
  $configPath=Join-Path $folder ($trust+'.Caddyfile')
  Write-SimpleText $configPath (Get-SimpleCaddyConfiguration $state)
  $caddyName=$prefix+'-'+$trust;$containers.Add($caddyName)
  $null=Docker @('run','--rm','-d','--network',$prefix,'--name',$caddyName,'--network-alias','edge','--mount',('type=bind,source='+$configPath+',target=/etc/caddy/Caddyfile,readonly'),$CaddyImage,'caddy','run','--config','/etc/caddy/Caddyfile','--adapter','caddyfile')
  Write-Output (Docker @('run','--rm','--network',$prefix,'node:22-bookworm-slim','node','-e',$client,$trust))
  $null=Docker @('stop',$caddyName)
 }
}finally{foreach($name in $containers){$null=Invoke-SimpleProcess 'docker' @('--context','desktop-linux','rm','-f',$name) '' 15};$null=Invoke-SimpleProcess 'docker' @('--context','desktop-linux','network','rm',$prefix) '' 15;Remove-Item -LiteralPath $folder -Recurse -Force}

}
$folder=Join-Path ([IO.Path]::GetTempPath()) ('castlink-network-fixture-'+[Guid]::NewGuid())
$null=New-Item -ItemType Directory -Path $folder
function Assert-Rejected([scriptblock]$Action,[string]$Reason) {
  $rejected=$false;try { & $Action } catch { $rejected=$true }
  if(-not $rejected){throw ('Network validation accepted '+$Reason)}
}
try {
  $release=[pscustomobject]@{images=[pscustomobject]@{web='web:test';postgres='postgres:test';livekit='livekit:test';caddy='caddy:test';turntls='turn:test'}}
  $state=New-SimpleConfiguration $folder '192.168.1.22' $false $release
  if(-not(Get-Command Get-SimpleNetworkConfiguration -ErrorAction SilentlyContinue)){throw 'Advanced network configuration support is missing'}
  $legacy=Get-SimpleNetworkConfiguration $state '192.168.1.22'
  if($legacy.mode -ne 'https' -or $legacy.httpsPort -ne 443 -or (Get-SimpleHomeUrl $state) -ne 'https://192.168.1.22/'){throw 'Legacy defaults changed'}
  Write-SimpleConfiguration $folder $state $release '192.168.1.22'
  $legacyCompose=[IO.File]::ReadAllText((Join-Path $folder 'compose.json'))
  $secrets=@($state.installationId,$state.password,$state.session,$state.livekitSecret)
  $http=[pscustomobject]@{mode='http';publicOrigin='http://192.168.1.22:8088';bindAddress='192.168.1.22';httpPort=8088;httpsPort=4443;mediaIp='192.168.1.23';iceTcpPort=17881;iceUdpPort=17882;turnUdpPort=13478;relayPortStart=31000;relayPortEnd=31007;trustedProxies=@()}
  Set-SimpleNetworkConfiguration $folder $state $http
  Write-SimpleConfiguration $folder $state $release '192.168.1.99'
  $compose=Get-Content (Join-Path $folder 'compose.json') -Raw|ConvertFrom-Json
  $lk=Get-Content (Join-Path $folder 'livekit.json') -Raw|ConvertFrom-Json
  $caddy=Get-Content (Join-Path $folder 'Caddyfile') -Raw
  $envText=Get-Content (Join-Path $folder 'web.env') -Raw
  if((Get-SimpleHomeUrl $state) -ne 'http://192.168.1.22:8088/' -or $state.setupMode -ne 'advanced'){throw 'HTTP origin/setup mode not saved'}
  if(($compose.services.caddy.ports -join ',') -cne '192.168.1.22:8088:80'){throw 'HTTP listener mapping mismatch'}
  if(($compose.services.livekit.ports -join ',') -cne '17881:17881/tcp,17882:17882/udp,13478:13478/udp,31000-31007:31000-31007/udp'){throw 'Custom media mappings mismatch'}
  if($lk.rtc.node_ip -ne '192.168.1.23' -or $lk.rtc.tcp_port -ne 17881 -or $lk.rtc.udp_port -ne 17882 -or $lk.turn.udp_port -ne 13478 -or $lk.turn.allow_restricted_peer_cidrs[0] -ne '192.168.1.23/32' -or $lk.turn.relay_range_start -ne 31000 -or $lk.turn.relay_range_end -ne 31007){throw 'Media configuration differs from published ports'}
  if($compose.services.web.PSObject.Properties['ports'] -or $compose.services.postgres.PSObject.Properties['ports']){throw 'Backend/database exposed'}
  if($caddy -notmatch 'http://:80' -or $caddy -notmatch 'forward_auth web:3000' -or $caddy -notmatch 'uri /api/media-admission' -or $caddy -match 'tls internal|trusted_proxies'){throw 'HTTP Caddy mode or admission mismatch'}
  if($envText -notmatch 'STUDIOLINK_TRANSFER_ORIGIN=http://192.168.1.22:8088'){throw 'Transfer origin ignored HTTP configuration'}
  $required=@(Get-SimpleRequiredPorts $false $state)
  if($required.Count -ne 12 -or -not @($required|Where-Object{$_.port -eq 8088 -and $_.address -eq '192.168.1.22'}).Count -or @($required|Where-Object{$_.port -in @(443,7881,7882,3478)}).Count){throw 'Configured preflight ports mismatch'}
  $saved=Get-Content (Join-Path $folder '.castlink-install.json') -Raw|ConvertFrom-Json
  $resumed=New-SimpleConfiguration $folder $state.address $state.publicHttps $release
  Write-SimpleConfiguration $folder $resumed $release '192.168.1.99'
  if(($secrets -join ',') -cne (@($resumed.installationId,$resumed.password,$resumed.session,$resumed.livekitSecret) -join ',') -or ($saved.network|ConvertTo-Json -Compress) -cne ($resumed.network|ConvertTo-Json -Compress)){throw 'Resume overwrote saved network or secrets'}
  $resumed.completed=$true
  $changed=$http.PSObject.Copy();$changed.httpPort=8089;$changed.publicOrigin='http://192.168.1.22:8089'
  Assert-Rejected {Set-SimpleNetworkConfiguration $folder $resumed $changed} 'changed completed configuration'
  Set-SimpleNetworkConfiguration $folder $resumed $http
  foreach($origin in @('https://example.com/path','https://user:pass@example.com','https://example.com?x=1','https://example.com#x',"https://example.com`nrespond evil",'https://example.com/../','https://example.com:0','https://example.com:65536','https://example.com\evil')){
    $candidate=$http.PSObject.Copy();$candidate.publicOrigin=$origin
    Assert-Rejected {Set-SimpleNetworkConfiguration $folder $state $candidate} 'malformed origin'
  }
  foreach($value in @('0.0.0.0','999.1.1.1','127.1','example.com',"1.2.3.4`nfoo")){
    $candidate=$http.PSObject.Copy();$candidate.mediaIp=$value
    Assert-Rejected {Set-SimpleNetworkConfiguration $folder $state $candidate} 'invalid media address'
  }
  foreach($value in @('1.2.3.4:80',"0.0.0.0`nfoo",'127.1')){
    $candidate=$http.PSObject.Copy();$candidate.bindAddress=$value
    Assert-Rejected {Set-SimpleNetworkConfiguration $folder $state $candidate} 'invalid bind address'
  }
  foreach($value in @(-1,0,65536,'8088x',8088.5)){
    $candidate=$http.PSObject.Copy();$candidate.httpPort=$value
    Assert-Rejected {Set-SimpleNetworkConfiguration $folder $state $candidate} 'invalid port'
  }
  $candidate=$http.PSObject.Copy();$candidate.iceTcpPort=8088
  Assert-Rejected {Set-SimpleNetworkConfiguration $folder $state $candidate} 'TCP collision'
  $candidate=$http.PSObject.Copy();$candidate.turnUdpPort=17882
  Assert-Rejected {Set-SimpleNetworkConfiguration $folder $state $candidate} 'UDP collision'
  $candidate=$http.PSObject.Copy();$candidate.iceUdpPort=31005
  Assert-Rejected {Set-SimpleNetworkConfiguration $folder $state $candidate} 'UDP range collision'
  $candidate=$http.PSObject.Copy();$candidate.relayPortEnd=30999
  Assert-Rejected {Set-SimpleNetworkConfiguration $folder $state $candidate} 'inverted relay range'
  $candidate=$http.PSObject.Copy();$candidate.relayPortEnd=40000
  Assert-Rejected {Set-SimpleNetworkConfiguration $folder $state $candidate} 'oversized relay range'
  # Port namespaces are separate: one number may be used once in TCP and UDP.
  $candidate=$http.PSObject.Copy();$candidate.iceUdpPort=$candidate.iceTcpPort
  Set-SimpleNetworkConfiguration $folder $state $candidate
  $proxy=[pscustomobject]@{mode='proxy';publicOrigin='https://cast.example.com';mediaIp='203.0.113.2';trustedProxies=@('172.18.0.1/32','10.2.0.0/16','::1/128')}
  Set-SimpleNetworkConfiguration $folder $state $proxy
  Write-SimpleConfiguration $folder $state $release '192.168.1.99'
  $compose=Get-Content (Join-Path $folder 'compose.json') -Raw|ConvertFrom-Json
  $caddy=Get-Content (Join-Path $folder 'Caddyfile') -Raw
  if(($compose.services.caddy.ports -join ',') -cne '127.0.0.1:8080:80' -or $compose.services.livekit.ports[0] -cne '7881:7881/tcp'){throw 'Proxy listener/media defaults mismatch'}
  if($caddy -notmatch 'trusted_proxies static 172.18.0.1/32 10.2.0.0/16 ::1/128' -or $caddy -notmatch 'trusted_proxies_strict' -or $caddy -notmatch 'client_ip_headers X-Forwarded-For' -or $caddy -notmatch '@untrusted not remote_ip 172.18.0.1/32 10.2.0.0/16 ::1/128' -or $caddy -notmatch 'request_header @untrusted -X-Forwarded-Proto' -or $caddy -notmatch 'request_header @untrusted -X-Forwarded-Host' -or ([regex]::Matches($caddy,'header_up X-Forwarded-Proto')).Count -ne 3 -or ([regex]::Matches($caddy,'header_up X-Forwarded-Host')).Count -ne 3){throw 'Proxy trust/sanitization/original origin is missing for WEB/admission/RTC'}
  if($caddy -notmatch 'forward_auth web:3000' -or $caddy -notmatch 'uri /api/media-admission'){throw 'Proxy bypassed media admission'}
  $candidate=$proxy.PSObject.Copy();$candidate.trustedProxies=@()
  Assert-Rejected {Set-SimpleNetworkConfiguration $folder $state $candidate} 'empty proxy trust'
  $candidate=$proxy.PSObject.Copy();$candidate.publicOrigin='http://cast.example.com'
  Assert-Rejected {Set-SimpleNetworkConfiguration $folder $state $candidate} 'non-HTTPS proxy public origin'
  foreach($cidr in @('private_ranges','0.0.0.0/0','::/0',"10.0.0.0/8`nfoo",'10.0.0.0/33','1.2.3.4/x')){
    $candidate=$proxy.PSObject.Copy();$candidate.trustedProxies=@($cidr)
    Assert-Rejected {Set-SimpleNetworkConfiguration $folder $state $candidate} 'unsafe proxy trust'
  }
  $https=[pscustomobject]@{mode='https';publicOrigin='https://192.168.1.22:4443';bindAddress='0.0.0.0';httpPort=8080;httpsPort=4443;mediaIp='127.0.0.1'}
  Set-SimpleNetworkConfiguration $folder $state $https
  Write-SimpleConfiguration $folder $state $release '192.168.1.99'
  $compose=Get-Content (Join-Path $folder 'compose.json') -Raw|ConvertFrom-Json
  $caddy=Get-Content (Join-Path $folder 'Caddyfile') -Raw
  if(($compose.services.caddy.ports -join ',') -cne '4443:443' -or $compose.services.livekit.ports[0] -cne '127.0.0.1:7881:7881/tcp' -or $caddy -notmatch 'tls internal' -or $caddy -notmatch 'https://192.168.1.22' -or $caddy -match 'https://192.168.1.22:4443'){throw 'Local HTTPS port mapping/TLS/media mismatch'}
  $state.publicHttps=$true
  Write-SimpleConfiguration $folder $state $release '127.0.0.1'
  $compose=Get-Content (Join-Path $folder 'compose.json') -Raw|ConvertFrom-Json
  $caddy=Get-Content (Join-Path $folder 'Caddyfile') -Raw
  if(($compose.services.caddy.ports -join ',') -cne '4443:443,8080:80' -or $caddy -notmatch 'https://192.168.1.22:4443\{uri\}'){throw 'Public HTTPS redirect loses external port'}
  $state.address='cast.example.com';$state|Add-Member -NotePropertyName turnDomain -NotePropertyValue 'turn.example.com'
  Assert-Rejected {Write-SimpleConfiguration $folder $state $release '127.0.0.1'} 'incompatible TURN/TLS mapping'
  if((Get-SimpleRemovalProject $state $compose) -ne ('castlink-easy-'+$state.installationId.Replace('-',''))){throw 'Advanced configuration cannot be removed safely'}
  # New advanced installs have no installation UUID during early port preflight.
  $preflight=[pscustomobject]@{address='192.168.1.22';publicHttps=$false;network=$http}
  $script:checkedPorts=@()
  function Get-SimpleDockerContainers {return @()}
  function Assert-SimpleSocketPorts([string]$Address,[object[]]$Ports){$script:checkedPorts=$Ports}
  Assert-SimplePortAvailability $preflight $preflight.address $false
  if($script:checkedPorts.Count -ne 12 -or @($script:checkedPorts|Where-Object{$_.port -eq 8088})[0].address -ne '192.168.1.22' -or @($script:checkedPorts|Where-Object{$_.port -eq 17881})[0].address -ne '0.0.0.0'){throw 'Early advanced preflight requires saved identity or loses listener binding'}
  if($DockerSmoke){if(-not $CaddyImage){throw 'DockerSmoke requires the packaged Caddy image tag or digest'};Test-SimpleNetworkProxyRuntime $CaddyImage}
  Write-Output 'SIMPLE_NETWORK_FIXTURES_PASS legacy http https proxy persistence validation ports admission isolation'
} finally {Remove-Item -LiteralPath $folder -Recurse -Force}
