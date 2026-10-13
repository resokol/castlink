$ErrorActionPreference='Stop'
try {
$r=[Console]::In.ReadToEnd()|ConvertFrom-Json
if(($r.PSObject.Properties.Name -join ',') -cne 'action' -or $r.action -cne 'registry-status'){throw 'request'}
$b=[Microsoft.Win32.RegistryKey]::OpenBaseKey('CurrentUser','Registry64')
try{$key=$b.OpenSubKey('Software\CastLink\TargetOperations',$false);try{$value=@{present=($null -ne $key)};[Console]::Write(($value|ConvertTo-Json -Compress))}finally{if($key){$key.Dispose()}}}finally{$b.Dispose()}
} catch {exit 4}
