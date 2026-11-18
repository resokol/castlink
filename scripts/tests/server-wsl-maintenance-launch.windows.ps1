[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$PackageDirectory)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$testRoot=Join-Path $env:TEMP ('castlink-launch-'+[guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory -Path $testRoot
$start=New-Object Diagnostics.ProcessStartInfo
$start.FileName=Join-Path $PSHOME 'powershell.exe'
$start.Arguments='-NoProfile -STA -ExecutionPolicy Bypass -File "'+(Join-Path $PackageDirectory 'maintenance-bootstrap.ps1')+'"'
$start.UseShellExecute=$false;$start.RedirectStandardError=$true;$start.RedirectStandardOutput=$true
# Isolate discovery: never select or change any installed server.
$start.EnvironmentVariables['LOCALAPPDATA']=$testRoot
$process=[Diagnostics.Process]::Start($start);$window=$null;$uiProcess=$null
try {
 $deadline=[datetime]::UtcNow.AddSeconds(30)
 while([datetime]::UtcNow -lt $deadline){
  if($process.HasExited){throw ('Launcher exited before opening: '+$process.StandardError.ReadToEnd())}
  $children=@(Get-CimInstance Win32_Process -Filter ('ParentProcessId='+$process.Id))
  foreach($child in $children){
   $condition=New-Object Windows.Automation.PropertyCondition ([Windows.Automation.AutomationElement]::ProcessIdProperty),([int]$child.ProcessId)
   $window=[Windows.Automation.AutomationElement]::RootElement.FindFirst([Windows.Automation.TreeScope]::Children,$condition)
   if($window){$uiProcess=[int]$child.ProcessId;break}
  }
  if($window){break};Start-Sleep -Milliseconds 100
 }
 if(-not $window){throw 'Maintenance window did not open'}
 function Control([string]$Name){$condition=New-Object Windows.Automation.PropertyCondition ([Windows.Automation.AutomationElement]::AutomationIdProperty),$Name;return $window.FindFirst([Windows.Automation.TreeScope]::Descendants,$condition)}
 if(-not (Control 'Update') -or -not (Control 'Check')){throw 'Maintenance controls missing'}
 $language=Control 'Language';$expand=$language.GetCurrentPattern([Windows.Automation.ExpandCollapsePattern]::Pattern);$expand.Expand()
 $condition=New-Object Windows.Automation.PropertyCondition ([Windows.Automation.AutomationElement]::NameProperty),'English'
 $english=$language.FindFirst([Windows.Automation.TreeScope]::Descendants,$condition)
 $english.GetCurrentPattern([Windows.Automation.SelectionItemPattern]::Pattern).Select()
 if($window.Current.Name -cne 'CastLink maintenance'){throw 'Language callback failed'}
 (Control 'Check').GetCurrentPattern([Windows.Automation.InvokePattern]::Pattern).Invoke()
 $deadline=[datetime]::UtcNow.AddSeconds(5)
 do {$result=(Control 'Result').Current.Name;if($result -eq 'Select an explicit server'){break};Start-Sleep -Milliseconds 100}while([datetime]::UtcNow -lt $deadline)
 if($result -cne 'Select an explicit server'){throw ('Check callback failed: '+$result)}
 $window.GetCurrentPattern([Windows.Automation.WindowPattern]::Pattern).Close();$window=$null
 if(-not $process.WaitForExit(10000)){throw 'Launcher did not exit after window closed'}
 if($process.ExitCode -ne 0){throw $process.StandardError.ReadToEnd()}
 Write-Output 'PASS: packaged UI opens; language and Check callbacks work; clean close; no server selected'
}finally{
 if($window){try{$window.GetCurrentPattern([Windows.Automation.WindowPattern]::Pattern).Close()}catch{}}
 if(-not $process.HasExited){$process.Kill()}
 if($uiProcess){$owned=Get-Process -Id $uiProcess -ErrorAction SilentlyContinue;if($owned){$owned.Kill()}}
 $process.Dispose();Remove-Item -LiteralPath $testRoot -Recurse -Force
}
