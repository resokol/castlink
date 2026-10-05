import { mkdir, chmod, open, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
const execute=promisify(execFile);

export async function protectPath(file: string, directory: boolean, platform: string = process.platform): Promise<void> {
  if (platform==='win32') {
    // Construct an exact DACL; icacls /grant:r would retain unrelated explicit ACEs.
    const script = `
$ErrorActionPreference = 'Stop'
$acl = [System.Security.AccessControl.FileSecurity]::new()
if ($env:CASTLINK_PRIVATE_DIRECTORY -eq '1') { $acl = [System.Security.AccessControl.DirectorySecurity]::new() }
$acl.SetAccessRuleProtection($true, $false)
$owner = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
$inheritance = [System.Security.AccessControl.InheritanceFlags]::None
if ($env:CASTLINK_PRIVATE_DIRECTORY -eq '1') { $inheritance = [System.Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit' }
foreach ($sid in @($owner, [System.Security.Principal.SecurityIdentifier]::new('S-1-5-18'))) {
  $rule = [System.Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', $inheritance, 'None', 'Allow')
  $acl.AddAccessRule($rule)
}
$item = Get-Item -Force -LiteralPath $env:CASTLINK_PRIVATE_PATH
$item.SetAccessControl($acl)
`;
    await execute('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{
      windowsHide:true,env:{...process.env,CASTLINK_PRIVATE_PATH:file,CASTLINK_PRIVATE_DIRECTORY:directory?'1':'0'},
    });
  } else await chmod(file,directory?0o700:0o600);
}
export async function ensurePrivateDirectory(directory: string): Promise<void> {
  await mkdir(directory,{recursive:true,mode:0o700});
  await protectPath(directory,true);
}
export async function writeSecretFile(file: string, contents: string, platform: string = process.platform): Promise<void> {
  await mkdir(path.dirname(file),{recursive:true,mode:0o700});
  await protectPath(path.dirname(file),true,platform);
  const handle=await open(file,'wx',0o600);
  try {await protectPath(file,false,platform);await handle.writeFile(contents,'utf8');await handle.sync();}
  catch(error){await handle.close();await rm(file,{force:true});throw error;}
  await handle.close();
}
