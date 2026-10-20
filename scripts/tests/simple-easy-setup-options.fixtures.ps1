param([string]$EntryPath,[string]$GuiPath)
$ErrorActionPreference='Stop'
. $EntryPath -FunctionsOnly
if(-not(Get-Command Read-SimpleSetupOptions -ErrorAction SilentlyContinue)){throw 'Quick/advanced setup selection is missing'}
$folder=Join-Path $env:TEMP ('castlink-options-'+[Guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory $folder
$script:Answers=New-Object 'Collections.Generic.Queue[string]'
$script:Prompts=New-Object 'Collections.Generic.List[string]'
function Read-Host([string]$Prompt){$script:Prompts.Add($Prompt);if(-not $script:Answers.Count){throw ('Unexpected prompt: '+$Prompt)};return $script:Answers.Dequeue()}
try{
  $quick=Read-SimpleSetupOptions $folder '192.168.1.22' $false '192.168.1.22' 'quick'
  if($quick.setupMode -cne 'quick' -or $quick.network -or $script:Prompts.Count){throw 'Quick setup exposed advanced network questions'}
  $script:Answers.Enqueue('');$selected=Read-SimpleSetupMode 'choose'
  if($selected -cne 'quick' -or $script:Prompts.Count -ne 1){throw 'Quick setup must be the selectable default'}
  $script:Prompts.Clear()
  foreach($answer in @('3','https://meet.example.com','127.0.0.1','8088','172.18.0.0/16','203.0.113.8','17881','17882','13478','31000','31031')){$script:Answers.Enqueue($answer)}
  $advanced=Read-SimpleSetupOptions $folder 'meet.example.com' $true '203.0.113.8' 'advanced'
  if($advanced.setupMode -cne 'advanced' -or $advanced.network.mode -cne 'proxy' -or $advanced.network.publicOrigin -cne 'https://meet.example.com' -or $advanced.network.httpPort -ne 8088 -or $advanced.network.mediaIp -cne '203.0.113.8' -or $advanced.network.iceTcpPort -ne 17881 -or $advanced.network.relayPortEnd -ne 31031){throw 'Advanced answers were not applied to the network configuration'}
  if(@($advanced.network.trustedProxies).Count -ne 1 -or $advanced.network.trustedProxies[0] -cne '172.18.0.0/16' -or $script:Answers.Count){throw 'Proxy trust answers were lost'}
  $saved=[pscustomobject]@{schemaVersion=1;address='meet.example.com';publicHttps=$true;setupMode='advanced';network=$advanced.network;password='fixture-preserved-secret'}
  [IO.File]::WriteAllText((Join-Path $folder '.castlink-install.json'),($saved|ConvertTo-Json -Depth 8),(New-Object Text.UTF8Encoding($false)))
  $script:Prompts.Clear()
  $resumed=Read-SimpleSetupOptions $folder 'meet.example.com' $true '203.0.113.8' 'choose'
  if($script:Prompts.Count -or ($resumed.network|ConvertTo-Json -Compress) -cne ($advanced.network|ConvertTo-Json -Compress)){throw 'Update/resume asked again or reset the saved network'}
  $changed=$advanced.network|ConvertTo-Json -Depth 8|ConvertFrom-Json;$changed.httpPort=8099
  try{$null=Read-SimpleSetupOptions $folder 'meet.example.com' $true '203.0.113.8' 'advanced' $changed;throw 'Existing network was silently replaced'}catch{if($_.Exception.Message -notlike '*сохранённ*'){throw}}
  . $GuiPath -FunctionsOnly
  $finish=Get-SimpleGuiFinishAction ([pscustomobject]@{exitCode=0;cleanupPending=$false;cancelled=$false;controlFolder=''}) @('CastLink установлен: http://192.168.1.22:8080/')
  if($finish.kind -cne 'url' -or $finish.url -cne 'http://192.168.1.22:8080/'){throw 'HTTP completion lost its site link'}
  foreach($locale in @('en','zh-CN')){
    foreach($key in @('Установка: 1 — Быстрая (рекомендуется); 2 — Расширенная','Быстрая (рекомендуется)','Расширенная','Расширенная установка','Сеть: 1 — HTTPS напрямую; 2 — HTTP; 3 — За внешним прокси','HTTPS напрямую','За внешним прокси','Внешний адрес сайта','IPv4 для прослушивания сайта','HTTP порт сайта','Доверенные прокси (IP/CIDR через запятую)','IPv4 для медиаподключений','TCP порт медиаподключений','UDP порт медиаподключений','UDP порт TURN','Начало диапазона TURN','Конец диапазона TURN')){
      if((ConvertTo-SimpleGuiText $key $locale) -match '[\u0400-\u04ff]'){throw ('Missing setup translation: '+$key)}
    }
    $prompt=Get-SimpleGuiPrompt 'Установка: 1 — Быстрая (рекомендуется); 2 — Расширенная [1]' $false
    if($prompt.choices.Count -ne 2 -or $prompt.default -cne '1'){throw 'Native installer lost its mode buttons/default'}
  }
  # Execute the real GUI launch options without creating WPF controls or starting a worker.
  $tokens=$null;$parseErrors=$null
  $guiAst=[Management.Automation.Language.Parser]::ParseFile($GuiPath,[ref]$tokens,[ref]$parseErrors)
  if($parseErrors.Count){throw 'GUI source did not parse'}
  $operation=$guiAst.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq 'Start-SimpleGuiOperation'},$true)
  if(-not $operation){throw 'GUI operation was not found'}
  $launchSource=New-Object 'Collections.Generic.List[string]';$collect=$false
  foreach($statement in $operation.Body.EndBlock.Statements){
    $source=$statement.Extent.Text
    if($source.StartsWith('$entry=')){$collect=$true}
    if($source.StartsWith('$script:gui.worker=')){break}
    if($collect){$launchSource.Add($source)}
  }
  if(-not $launchSource.Count){throw 'GUI launch options were not found'}
  foreach($advancedSelected in @($false,$true)){ & {
    $Action='install';$InstallFolder='';$SmokeResult=''
    $script:gui=[pscustomobject]@{selectedAction='install';selectedTarget='remote'}
    $controls=@{AdvancedSetupBox=[pscustomobject]@{IsChecked=$advancedSelected;IsEnabled=$true}}
    . ([scriptblock]::Create('$PSScriptRoot=$args[0];'+($launchSource -join "`n"))) (Split-Path -Parent $GuiPath)
    . $EntryPath @options -FunctionsOnly
    $script:Prompts.Clear()
    $selected=Read-SimpleSetupMode $SetupMode
    $expected=if($advancedSelected){'advanced'}else{'quick'}
    if($selected -cne $expected -or $script:Prompts.Count -or $script:Answers.Count -or $controls.AdvancedSetupBox.IsEnabled){throw 'Desktop install ignored optional advanced setting or asked an extra mode question'}
  } }
  & {
    . $EntryPath -Action install -FunctionsOnly
    $script:Prompts.Clear()
    $selected=Read-SimpleSetupMode $SetupMode
    if($selected -cne 'quick' -or $script:Prompts.Count){throw 'Direct install lost its unattended quick default'}
  }
  Write-Output 'SIMPLE_SETUP_OPTIONS_PASS quick advanced proxy custom-ports saved-update HTTP-link RU EN zh-CN'
}finally{Remove-Item -LiteralPath $folder -Recurse -Force}
