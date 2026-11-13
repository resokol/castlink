import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const scripts=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

test('native panel stage inventory includes every directly sourced helper and actual icon',async()=>{
  const inventory=JSON.parse(await fs.readFile(path.join(scripts,'server-native-panel-files.json'),'utf8'));
  const files=new Set(inventory.files);
  for(const file of files) assert.ok((await fs.stat(path.join(scripts,file))).isFile(),file);
  for(const file of ['server-native-control.ps1','simple-easy-setup-control.ps1']){
    let source=await fs.readFile(path.join(scripts,file),'utf8');
    // FunctionsOnly loads this helper's language/network dependencies, not its old Docker entry point.
    if(file==='simple-easy-setup-control.ps1') source=source.slice(0,source.indexOf('function Set-SimpleControlTheme'));
    for(const match of source.matchAll(/Join-Path \$PSScriptRoot '([^']+\.(?:ps1|ico))'/g))
      assert.ok(files.has(match[1]),`${file} requires staged ${match[1]}`);
  }
  assert.equal(inventory.host,'CastLinkServer.exe');
  assert.equal(inventory.binding,'server-native-binding.json');
});

test('native launcher has no console and delegates services to the original installer',async()=>{
  const host=await fs.readFile(path.join(scripts,'server-native-panel-host.cs'),'utf8');
  const build=await fs.readFile(path.join(scripts,'build-server-native-panel-host.ps1'),'utf8');
  const control=await fs.readFile(path.join(scripts,'server-native-control.ps1'),'utf8');
  assert.match(build,/\/target:winexe/);
  assert.match(host,/UseShellExecute = false/);assert.match(host,/CreateNoWindow = true/);
  assert.match(host,/process\.WaitForExit\(\);\s*return process\.ExitCode;/);
  assert.match(host,/if \(\$null -eq \$LASTEXITCODE\) \{ exit 0 \}; exit \$LASTEXITCODE \} catch \{ exit 1 \}/);
  assert.match(control,/\$info\.UseShellExecute=\$false;\$info\.CreateNoWindow=\$true/);
  assert.match(control,/Read-CastlinkNativeMonitorBinding -BindingFile/);
  assert.match(control,/\$binding\.sourceScriptPath/);
  assert.match(control,/New-SimpleControlWindow \$language/);
  assert.doesNotMatch(control,/function (?:Start-CastlinkKeepalive|Invoke-CastlinkWsl|Start-Process)\b/);
  assert.doesNotMatch(control,/docker(?:\.exe)?\s|wsl\.exe\s|Stop-Process|--terminate|--shutdown/i);
  assert.ok(control.indexOf('$nativeRequestedStartup=[bool]$Startup')<control.indexOf(". (Join-Path $PSScriptRoot 'simple-easy-setup-control.ps1')"));
  assert.match(control,/-Startup \$nativeRequestedStartup/);
  assert.doesNotMatch(control,/ValidateSet\('Start','Stop','Status','OwnerAccess'\)/);
  assert.match(control,/if\(\$dialog\.ShowDialog\(\$window\)\)\{\$state\.pendingExport=\$dialog\.FileName/);
  assert.match(control,/Get-CastlinkNativePanelScheduledWork'\(\$state\)/);
  assert.match(control,/\$helpers\.'Request-CastlinkNativePanelControl'\(\$state,\$Mode\)/);
  const beginControl=control.slice(control.indexOf('$beginControl={'),control.indexOf("$window.FindName('Start').Add_Click"));
  assert.doesNotMatch(beginControl,/Start-CastlinkNativePanelWork/);
});
