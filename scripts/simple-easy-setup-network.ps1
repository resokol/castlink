# Saved network settings are opt-in. An absent network property retains legacy rendering.
function Assert-SimpleNetworkIpv4([string]$Value,[switch]$AllowAny) {
  $parsed=$null
  if($Value -notmatch '^(?:0|[1-9][0-9]{0,2})(?:\.(?:0|[1-9][0-9]{0,2})){3}$' -or -not [Net.IPAddress]::TryParse($Value,[ref]$parsed) -or $parsed.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork -or (-not $AllowAny -and ($Value -eq '0.0.0.0' -or $Value -eq '255.255.255.255'))){throw 'Укажи корректный IPv4-адрес сети.'}
  return $Value
}
function Get-SimpleNetworkPort([object]$Value) {
  if([string]$Value -notmatch '^[0-9]{1,5}$' -or [int]$Value -lt 1 -or [int]$Value -gt 65535){throw 'Сетевой порт должен быть целым числом от 1 до 65535.'}
  return [int]$Value
}
function Get-SimpleNetworkOrigin([string]$Value) {
  # Check the original spelling before Uri canonicalization removes paths/dot segments.
  if($Value -notmatch '^https?://(?:[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?)(?::[0-9]{1,5})?/?$'){throw 'Укажи полный HTTP/HTTPS-адрес без пути, пароля, параметров и фрагмента.'}
  $uri=$null
  if(-not [Uri]::TryCreate($Value,[UriKind]::Absolute,[ref]$uri) -or $uri.Port -lt 1 -or $uri.Port -gt 65535){throw 'Укажи полный HTTP/HTTPS-адрес без пути, пароля, параметров и фрагмента.'}
  $hostName=$uri.DnsSafeHost
  $ip=$null
  if([Net.IPAddress]::TryParse($hostName,[ref]$ip)){$null=Assert-SimpleNetworkIpv4 $hostName}
  elseif($hostName.Length -gt 253 -or $hostName -notmatch '^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'){throw 'Укажи корректное имя сервера или IPv4-адрес.'}
  return $uri.GetLeftPart([UriPartial]::Authority)
}
function Get-SimpleNetworkTrustedProxy([string]$Value) {
  if($Value -notmatch '^[0-9a-fA-F:.]+(?:/[0-9]{1,3})?$'){throw 'Укажи доверенные адреса или CIDR прокси явно; доверие всей сети запрещено.'}
  $parts=$Value.Split('/');$ip=$null
  if(-not [Net.IPAddress]::TryParse($parts[0],[ref]$ip)){throw 'Укажи доверенные адреса или CIDR прокси явно; доверие всей сети запрещено.'}
  $isV4=$ip.AddressFamily -eq [Net.Sockets.AddressFamily]::InterNetwork
  if($isV4){$null=Assert-SimpleNetworkIpv4 $parts[0] -AllowAny}
  $bits=if($isV4){32}else{128}
  if($parts.Count -eq 2 -and ([int]$parts[1] -lt 1 -or [int]$parts[1] -gt $bits)){throw 'Укажи доверенные адреса или CIDR прокси явно; доверие всей сети запрещено.'}
  if($parts.Count -eq 1 -and ($ip.Equals([Net.IPAddress]::Any) -or $ip.Equals([Net.IPAddress]::IPv6Any))){throw 'Укажи доверенные адреса или CIDR прокси явно; доверие всей сети запрещено.'}
  return $ip.ToString()+$(if($parts.Count -eq 2){'/'+[int]$parts[1]}else{''})
}
function Get-SimpleNetworkConfiguration([object]$State,[string]$MediaIp='') {
  $saved=if($State -and $State.PSObject.Properties['network']){$State.network}else{$null}
  $mode=if($saved -and $saved.PSObject.Properties['mode']){[string]$saved.mode}else{'https'}
  if($mode -cnotin @('https','http','proxy')){throw 'Выбери сетевой режим HTTPS, HTTP или внешний прокси.'}
  $defaultMedia=if($MediaIp){$MediaIp}elseif($State -and $State.address -match '^\d+\.\d+\.\d+\.\d+$'){[string]$State.address}else{'127.0.0.1'}
  $origin=if($mode -eq 'http'){'http://'+$State.address}else{'https://'+$State.address}
  $defaults=[ordered]@{mode=$mode;publicOrigin=$origin;bindAddress=$(if($mode -eq 'proxy' -or $State.address -eq '127.0.0.1'){'127.0.0.1'}else{'0.0.0.0'});httpPort=$(if($mode -eq 'proxy'){8080}else{80});httpsPort=443;mediaIp=$defaultMedia;iceTcpPort=7881;iceUdpPort=7882;turnUdpPort=3478;relayPortStart=30000;relayPortEnd=30031;trustedProxies=@()}
  foreach($key in @($defaults.Keys)){if($saved -and $saved.PSObject.Properties[$key]){$defaults[$key]=$saved.$key}}
  if(-not $saved){return [pscustomobject]$defaults}
  $defaults.publicOrigin=Get-SimpleNetworkOrigin ([string]$defaults.publicOrigin)
  $uri=[Uri]$defaults.publicOrigin
  if(($mode -eq 'http' -and $uri.Scheme -ne 'http') -or ($mode -in @('https','proxy') -and $uri.Scheme -ne 'https')){throw 'Публичный адрес не соответствует выбранному сетевому режиму.'}
  $defaults.bindAddress=Assert-SimpleNetworkIpv4 ([string]$defaults.bindAddress) -AllowAny
  $defaults.mediaIp=Assert-SimpleNetworkIpv4 ([string]$defaults.mediaIp)
  foreach($key in @('httpPort','httpsPort','iceTcpPort','iceUdpPort','turnUdpPort','relayPortStart','relayPortEnd')){$defaults[$key]=Get-SimpleNetworkPort $defaults[$key]}
  if(($mode -eq 'http' -and $uri.Port -ne $defaults.httpPort) -or ($mode -eq 'https' -and $uri.Port -ne $defaults.httpsPort)){throw 'Порт публичного адреса должен совпадать с портом HTTP или HTTPS.'}
  if($defaults.relayPortStart -gt $defaults.relayPortEnd -or ($defaults.relayPortEnd-$defaults.relayPortStart) -ge 1024){throw 'Диапазон TURN должен содержать от 1 до 1024 портов по возрастанию.'}
  $tcp=@($defaults.iceTcpPort)
  if($mode -eq 'https'){$tcp+=$defaults.httpsPort;if($State.publicHttps){$tcp+=$defaults.httpPort}}else{$tcp+=$defaults.httpPort}
  $udp=@($defaults.iceUdpPort,$defaults.turnUdpPort)+@($defaults.relayPortStart..$defaults.relayPortEnd)
  if(@($tcp|Select-Object -Unique).Count -ne $tcp.Count -or @($udp|Select-Object -Unique).Count -ne $udp.Count){throw 'Сетевые порты одного протокола пересекаются. Выбери разные порты.'}
  $trusted=@(foreach($source in @($defaults.trustedProxies)){Get-SimpleNetworkTrustedProxy ([string]$source)})
  if($mode -eq 'proxy' -and -not $trusted.Count){throw 'Для внешнего прокси укажи хотя бы один доверенный IP-адрес или CIDR.'}
  $defaults.trustedProxies=@($trusted|Select-Object -Unique)
  if($State.PSObject.Properties['turnDomain'] -and $State.turnDomain -and ($mode -ne 'https' -or -not $State.publicHttps -or $defaults.httpPort -ne 80 -or $defaults.httpsPort -ne 443 -or $defaults.bindAddress -ne '0.0.0.0' -or $uri.DnsSafeHost -cne $State.address)){throw 'TURN/TLS 443 совместим только с прямым публичным HTTPS, портами 80/443 и привязкой 0.0.0.0.'}
  return [pscustomobject]$defaults
}
function Set-SimpleNetworkConfiguration([string]$Folder,[object]$State,[object]$Configuration,[string]$SetupMode='advanced') {
  if($SetupMode -cnotin @('quick','advanced')){throw 'Выбери быструю или расширенную установку.'}
  if(-not $Configuration){throw 'Выбери сетевой режим HTTPS, HTTP или внешний прокси.'}
  $candidate=[pscustomobject]@{address=$State.address;publicHttps=$State.publicHttps;network=$Configuration}
  if($State.PSObject.Properties['turnDomain']){$candidate|Add-Member -NotePropertyName turnDomain -NotePropertyValue $State.turnDomain}
  $network=Get-SimpleNetworkConfiguration $candidate
  if($State.PSObject.Properties['network'] -and $State.network){
    $current=Get-SimpleNetworkConfiguration $State
    if(($current|ConvertTo-Json -Depth 4 -Compress) -ceq ($network|ConvertTo-Json -Depth 4 -Compress)){return}
  }
  if($State.PSObject.Properties['completed'] -and $State.completed){throw 'Сохранённая сеть завершённой установки не совпала. Используй прежние настройки или новую папку.'}
  $State|Add-Member -NotePropertyName network -NotePropertyValue $network -Force
  $State|Add-Member -NotePropertyName setupMode -NotePropertyValue $SetupMode -Force
  Save-SimpleState $Folder $State
}
function Get-SimpleHomeUrl([object]$State) {
  if($State.PSObject.Properties['network'] -and $State.network){return (Get-SimpleNetworkConfiguration $State).publicOrigin+'/'}
  return 'https://'+$State.address+'/'
}
function Get-SimpleAdvancedCaddyConfiguration([object]$State) {
  $network=Get-SimpleNetworkConfiguration $State
  $origin=[Uri]$network.publicOrigin;$hostName=$origin.DnsSafeHost
  $global="{`n admin off`n auto_https disable_redirects"
  $headers='';$sanitize=''
  if($network.mode -eq 'proxy'){
    $sources=$network.trustedProxies -join ' '
    $global+="`n servers {`n  trusted_proxies static $sources`n  trusted_proxies_strict`n  client_ip_headers X-Forwarded-For`n }"
    $sanitize=@"
  @untrusted not remote_ip $sources
  request_header @untrusted -X-Forwarded-Proto
  request_header @untrusted -X-Forwarded-Host
  request_header @untrusted -X-Forwarded-For
  request_header @untrusted -X-Real-IP
  request_header @untrusted -Forwarded
  vars proxy_proto {scheme}
  vars proxy_host {http.request.hostport}
  @forwardedProto header X-Forwarded-Proto https
  vars @forwardedProto proxy_proto https
  @forwardedHost header X-Forwarded-Host *
  vars @forwardedHost proxy_host {http.request.header.X-Forwarded-Host}
"@
    $headers="`n    header_up X-Forwarded-Proto {http.vars.proxy_proto}`n    header_up X-Forwarded-Host {http.vars.proxy_host}`n    header_up X-Forwarded-For {client_ip}"
  }
  $tls='';$redirect='';$site='http://:80'
  if($network.mode -eq 'https'){
    $site='https://'+$hostName
    if(-not $State.publicHttps){$global+="`n skip_install_trust`n default_sni $hostName";$tls='tls internal'}
    else{
      $ip=$null
      if([Net.IPAddress]::TryParse($hostName,[ref]$ip)){$global+="`n default_sni $hostName";$tls="tls {`n  issuer acme {`n   dir https://acme-v02.api.letsencrypt.org/directory`n   profile shortlived`n  }`n }"}
      $redirect="`nhttp://:80 {`n redir $($network.publicOrigin){uri} permanent`n}`n"
    }
  }
  $global+="`n}"
  return @"
$global
$site {
 $tls
 route {
$sanitize
  @rtc path /rtc /rtc/*
  route @rtc {
   forward_auth web:3000 {
    uri /api/media-admission
    header_up -Upgrade
    header_up -Connection$headers
   }
   reverse_proxy livekit:7880 {$headers
   }
  }
  reverse_proxy web:3000 {$headers
  }
 }
}
$redirect
"@
}
