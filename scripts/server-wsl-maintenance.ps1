# CastLink WSL lifecycle schema 1. Dot-source with -FunctionsOnly for embedding/tests.
[CmdletBinding()]
param([ValidateSet('List','Check','Update','Remove','Restore','Recover')][string]$Action='List', [string]$InstallRoot, [string]$TargetDirectory, [string]$ExpectedManifestSha256, [string]$Confirmation, [string]$BundleDirectory, [switch]$EraseData, [switch]$FunctionsOnly)
$script:CLMLegacyTag='server-wsl-v1.0.5-rc.1-085b087a2458'
$script:CLMLegacyInstaller='768a217a0544fb66bf5aca3786a7c0b88308d7c360345be5bd8923c9f77ce361'
$script:CLMLegacyManifest='60454ddf54f01815e6446a2199b30b2bdec2df97c0615b6b319cf36b98912e7c'
$script:CLMLegacyRootfs='917a8d0eee9311eeedbae7eaaf479c9500ac47bbf22e36603ece727b8738acd1'
function Assert-CLMPath([string]$Path) {
 $p=[IO.Path]::GetFullPath($Path);$a=$p
 while($a){if((Test-Path -LiteralPath $a) -and ((Get-Item -LiteralPath $a -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Lifecycle paths cannot contain reparse points'};$a=[IO.Path]::GetDirectoryName($a)}
 return $p
}
function Assert-CLMAssetName([string]$Name){if($Name -cnotmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$' -or $Name.Contains('..')){throw 'Invalid lifecycle asset name'}}
function Get-CLMHash([string]$Path){return (Get-FileHash -LiteralPath (Assert-CLMPath $Path) -Algorithm SHA256).Hash.ToLowerInvariant()}
function Read-CLMJson([string]$Path,[long]$Limit=1048576){$p=Assert-CLMPath $Path;if((Get-Item -LiteralPath $p).Length -gt $Limit){throw 'Lifecycle JSON exceeds size limit'};return [IO.File]::ReadAllText($p,[Text.Encoding]::UTF8)|ConvertFrom-Json}
function Protect-CLMDirectory([string]$Path){
 [void][IO.Directory]::CreateDirectory((Assert-CLMPath $Path))
 $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User
 $acl=Get-Acl -LiteralPath $Path;$acl.SetAccessRuleProtection($true,$false);foreach($rule in @($acl.Access)){$null=$acl.RemoveAccessRuleSpecific($rule)}
 foreach($id in @($sid,[Security.Principal.SecurityIdentifier]::new('S-1-5-18'),[Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))){$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($id,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))}
 ([IO.DirectoryInfo]::new($Path)).SetAccessControl($acl)
}
function Write-CLMJson([string]$Path,$Value){
 $p=Assert-CLMPath $Path;$temporary=$p+'.'+[guid]::NewGuid().ToString('N')+'.new';$bytes=[Text.Encoding]::UTF8.GetBytes(($Value|ConvertTo-Json -Depth 32))
 $s=[IO.File]::Open($temporary,'CreateNew','Write','None');try{$s.Write($bytes,0,$bytes.Length);$s.Flush($true)}finally{$s.Dispose()}
 if(Test-Path -LiteralPath $p){[IO.File]::Replace($temporary,$p,[NullString]::Value)}else{[IO.File]::Move($temporary,$p)}
}
function Copy-CLMObject($Value){return ($Value|ConvertTo-Json -Depth 32|ConvertFrom-Json)}
function Assert-CLMFile([string]$Directory,$Entry){Assert-CLMAssetName $Entry.file;$p=Assert-CLMPath (Join-Path $Directory $Entry.file);if($Entry.sha256 -cnotmatch '^[a-f0-9]{64}$' -or $Entry.size -le 0 -or -not (Test-Path -LiteralPath $p -PathType Leaf) -or (Get-Item -LiteralPath $p).Length -ne $Entry.size -or (Get-CLMHash $p) -cne $Entry.sha256){throw 'Lifecycle asset checksum or size mismatch'};return $p}
function Get-CLMStorageRoot([string]$Root){$base=Assert-CLMPath (Join-Path $env:LOCALAPPDATA 'CastLinkServer');if($Root -ieq $base -or $Root.StartsWith($base+'\',[StringComparison]::OrdinalIgnoreCase)){return $base};return Split-Path $Root -Parent}
function Get-CLMRoot([string]$Root){
 $rootPath=Assert-CLMPath $Root;$pointer=Join-Path $rootPath 'active-generation.json'
 if(Test-Path -LiteralPath $pointer){$v=Read-CLMJson $pointer;if($v.schemaVersion -ne 1 -or $v.selectedRoot -cne $rootPath -or $v.installationId -cnotmatch '^[a-f0-9]{32}$'){throw 'Active generation identity mismatch'};$rootPath=Assert-CLMPath $v.activeRoot;$s=Read-CLMJson (Join-Path $rootPath 'installation.json');if($s.installationId -cne $v.installationId){throw 'Active generation receipt mismatch'}}
 return $rootPath
}
function Read-CLMReceipt([string]$Root,[switch]$AllowRemoved){
 $r=Assert-CLMPath $Root;$s=Read-CLMJson (Join-Path $r 'installation.json')
 if($s.schemaVersion -ne 1 -or $s.installationId -cnotmatch '^[a-f0-9]{32}$' -or $s.distroName -cne ('CastLink-Server-'+$s.installationId.Substring(0,12)) -or $s.rootPath -cne $r -or $s.repository -cne 'resokol/castlink' -or $s.releaseTag -cnotmatch '^server-wsl-v[0-9][A-Za-z0-9.+-]*$' -or $s.rootfsSha256 -cnotmatch '^[a-f0-9]{64}$' -or $s.phase -cnotin (@('imported','ready','maintenance')+$(if($AllowRemoved){@('removed')}else{@()}))){throw 'Installation ownership receipt mismatch'}
 return $s
}
function Get-CastlinkMaintenanceInstallations([string]$Base=(Join-Path $env:LOCALAPPDATA 'CastLinkServer')){
 # Host receipts only: never launch a distribution while populating the picker.
 if(-not (Test-Path -LiteralPath $Base)){return @()};$pending=New-Object Collections.Generic.Queue[string];$pending.Enqueue((Assert-CLMPath $Base));$seen=@{}
 while($pending.Count){$r=$pending.Dequeue();if(Test-Path -LiteralPath (Join-Path $r 'installation.json')){try{$actual=Get-CLMRoot $r;$s=Read-CLMReceipt $actual;if(-not $seen.ContainsKey($s.installationId)){$seen[$s.installationId]=$true;$domain='?';if($s.nativePanel -and (Test-Path -LiteralPath $s.nativePanel.bindingPath)){if((Get-CLMHash $s.nativePanel.bindingPath) -ceq $s.nativePanel.bindingSha256){$domain=(Read-CLMJson $s.nativePanel.bindingPath).origin}};[pscustomobject]@{root=$r;activeRoot=$actual;domain=$domain;version=$s.releaseTag;state=$s.phase;distroName=$s.distroName}}}catch{}}
  foreach($d in Get-ChildItem -LiteralPath $r -Directory -Force){if($d.Name -in @('distribution','release','native-panel','lifecycle-transactions','lifecycle-cache','lifecycle-packages') -or ($d.Attributes -band [IO.FileAttributes]::ReparsePoint)){continue};$pending.Enqueue($d.FullName)}
 }
}
function Initialize-CLMTransport {
 if('CastLinkLifecycle.Transport' -as [type]){return}
 Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Text;
using System.Diagnostics;
using System.Threading.Tasks;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
namespace CastLinkLifecycle {
 public static class Transport {
  [StructLayout(LayoutKind.Sequential)] struct SecurityAttributes {public int Length;public IntPtr Descriptor;[MarshalAs(UnmanagedType.Bool)]public bool Inherit;}
  [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct StartupInfo {public int cb;public string reserved;public string desktop;public string title;public int x,y,width,height,xchars,ychars,fill,flags;public short show,reservedSize;public IntPtr reservedBytes,stdin,stdout,stderr;}
  [StructLayout(LayoutKind.Sequential)] struct StartupInfoEx {public StartupInfo info;public IntPtr attributes;}
  [StructLayout(LayoutKind.Sequential)] struct ProcessInformation {public IntPtr process,thread;public int processId,threadId;}
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool CreatePipe(out SafeFileHandle read,out SafeFileHandle write,ref SecurityAttributes attributes,int size);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetHandleInformation(SafeFileHandle handle,int mask,int flags);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool InitializeProcThreadAttributeList(IntPtr list,int count,int flags,ref IntPtr size);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool UpdateProcThreadAttribute(IntPtr list,int flags,IntPtr attribute,IntPtr value,IntPtr size,IntPtr previous,IntPtr returned);
  [DllImport("kernel32.dll")] static extern void DeleteProcThreadAttributeList(IntPtr list);
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateProcess(string application,StringBuilder command,IntPtr processAttributes,IntPtr threadAttributes,bool inherit,int flags,IntPtr environment,string directory,ref StartupInfoEx startup,out ProcessInformation process);
  [DllImport("kernel32.dll",SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle,int milliseconds);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr process,out int exitCode);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateProcess(IntPtr process,int exitCode);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
  static async Task<long> Copy(Stream input,Stream output,long limit){byte[] bytes=new byte[65536];long total=0;int count;while((count=await input.ReadAsync(bytes,0,bytes.Length))>0){total+=count;if(total>limit)throw new IOException("Process stream size limit");await output.WriteAsync(bytes,0,count);}return total;}
  public static string Run(string exe,string args,string input,string output,long limit,int seconds){
   // Framework Process.Start constructs an AutoFlush StreamWriter for stdin and
   // can prepend the console encoding BOM even when its BaseStream is used.
   // These three anonymous pipes contain bytes only; the handle-list attribute
   // prevents unrelated concurrent process/secret handles from being inherited.
   SafeFileHandle childIn=null,parentIn=null,parentOut=null,childOut=null,parentError=null,childError=null;
   Stream source=null,sink=null,stdin=null,stdout=null,stderr=null;MemoryStream text=null;
   IntPtr attributeList=IntPtr.Zero,handleList=IntPtr.Zero;bool attributeReady=false;
   ProcessInformation process=new ProcessInformation();
   try{
    var security=new SecurityAttributes{Length=Marshal.SizeOf(typeof(SecurityAttributes)),Inherit=true};
    if(!CreatePipe(out childIn,out parentIn,ref security,0)||!CreatePipe(out parentOut,out childOut,ref security,0)||!CreatePipe(out parentError,out childError,ref security,0))throw new IOException("Cannot create binary process pipes");
    if(!SetHandleInformation(parentIn,1,0)||!SetHandleInformation(parentOut,1,0)||!SetHandleInformation(parentError,1,0))throw new IOException("Cannot scope process pipe inheritance");
    IntPtr attributeSize=IntPtr.Zero;InitializeProcThreadAttributeList(IntPtr.Zero,1,0,ref attributeSize);
    if(attributeSize.ToInt64()<=0||attributeSize.ToInt64()>65536)throw new IOException("Invalid process attribute size");
    attributeList=Marshal.AllocHGlobal(attributeSize);if(!InitializeProcThreadAttributeList(attributeList,1,0,ref attributeSize))throw new IOException("Cannot initialize process attributes");attributeReady=true;
    handleList=Marshal.AllocHGlobal(IntPtr.Size*3);Marshal.WriteIntPtr(handleList,0,childIn.DangerousGetHandle());Marshal.WriteIntPtr(handleList,IntPtr.Size,childOut.DangerousGetHandle());Marshal.WriteIntPtr(handleList,IntPtr.Size*2,childError.DangerousGetHandle());
    if(!UpdateProcThreadAttribute(attributeList,0,new IntPtr(0x20002),handleList,new IntPtr(IntPtr.Size*3),IntPtr.Zero,IntPtr.Zero))throw new IOException("Cannot bind process pipe handles");
    var startup=new StartupInfoEx{info=new StartupInfo{cb=Marshal.SizeOf(typeof(StartupInfoEx)),flags=0x100,stdin=childIn.DangerousGetHandle(),stdout=childOut.DangerousGetHandle(),stderr=childError.DangerousGetHandle()},attributes=attributeList};
    if(exe.IndexOf('"')>=0||!CreateProcess(exe,new StringBuilder("\""+exe+"\" "+args),IntPtr.Zero,IntPtr.Zero,true,0x08080000,IntPtr.Zero,null,ref startup,out process))throw new IOException("Binary lifecycle child did not start");
    childIn.Dispose();childOut.Dispose();childError.Dispose();
    source=String.IsNullOrEmpty(input)?(Stream)new MemoryStream():File.OpenRead(input);
    sink=String.IsNullOrEmpty(output)?(Stream)(text=new MemoryStream()):new FileStream(output,FileMode.CreateNew,FileAccess.Write,FileShare.None);
    stdin=new FileStream(parentIn,FileAccess.Write,65536,false);stdout=new FileStream(parentOut,FileAccess.Read,65536,false);stderr=new FileStream(parentError,FileAccess.Read,65536,false);
    var write=Copy(source,stdin,1099511627776L).ContinueWith(task=>{stdin.Dispose();if(task.IsFaulted)throw task.Exception;});
    var read=Copy(stdout,sink,limit);var error=Copy(stderr,Stream.Null,65536);var all=Task.WhenAll(write,read,error);var clock=Stopwatch.StartNew();
    while(!all.IsCompleted||WaitForSingleObject(process.process,0)!=0){if(write.IsFaulted||read.IsFaulted||error.IsFaulted||clock.Elapsed.TotalSeconds>seconds)throw new IOException("Process timeout or bounded transport failure; inspect journal");System.Threading.Thread.Sleep(20);}
    all.GetAwaiter().GetResult();int exitCode;if(!GetExitCodeProcess(process.process,out exitCode)||exitCode!=0)throw new IOException("Lifecycle child failed (exit "+exitCode+")");
    if(sink is FileStream)((FileStream)sink).Flush(true);else sink.Flush();
    return text==null?null:(Array.IndexOf(text.ToArray(),(byte)0)>=0?Encoding.Unicode.GetString(text.ToArray()):Encoding.UTF8.GetString(text.ToArray()));
   }catch{if(process.process!=IntPtr.Zero&&WaitForSingleObject(process.process,0)!=0){TerminateProcess(process.process,1);WaitForSingleObject(process.process,5000);}throw;}
   finally{
    if(source!=null)source.Dispose();if(sink!=null)sink.Dispose();if(stdin!=null)stdin.Dispose();if(stdout!=null)stdout.Dispose();if(stderr!=null)stderr.Dispose();
    foreach(var handle in new[]{childIn,parentIn,parentOut,childOut,parentError,childError})if(handle!=null)handle.Dispose();
    if(process.thread!=IntPtr.Zero)CloseHandle(process.thread);if(process.process!=IntPtr.Zero)CloseHandle(process.process);
    if(attributeReady)DeleteProcThreadAttributeList(attributeList);if(attributeList!=IntPtr.Zero)Marshal.FreeHGlobal(attributeList);if(handleList!=IntPtr.Zero)Marshal.FreeHGlobal(handleList);
   }
  }
 }
}
'@
}
# WSL parses option tokens before its command payload; leave simple tokens bare.
function ConvertTo-CLMArg([string]$Value){if($Value.Contains([char]0)){throw 'Unsafe process argument'};if($Value.Length -gt 0 -and $Value -notmatch '[\s"]'){return $Value};return '"'+([regex]::Replace([regex]::Replace($Value,'(\\*)"','$1$1\"'),'(\\+)$','$1$1'))+'"'}
function Invoke-CLMProcess([string]$Exe,[string[]]$Arguments,[string]$InputFile,[string]$OutputFile,[long]$Limit=1048576,[int]$Timeout=600){Initialize-CLMTransport;$argsText=(@($Arguments|ForEach-Object {ConvertTo-CLMArg $_}) -join ' ');return [CastLinkLifecycle.Transport]::Run($Exe,$argsText,$(if($InputFile){$InputFile}else{$null}),$(if($OutputFile){$OutputFile}else{$null}),$Limit,$Timeout)}
function Invoke-CLMWsl($State,[string[]]$Arguments,[string]$InputFile,[string]$OutputFile,[long]$Limit=1048576,[int]$Timeout=600){return Invoke-CLMProcess (Join-Path $env:WINDIR 'System32\wsl.exe') (@('--distribution',$State.distroName,'--user','root','--exec')+$Arguments) $InputFile $OutputFile $Limit $Timeout}
function Invoke-CLMInstaller($Module,[scriptblock]$Code,$Data){return & $Module $Code $Data}
function Import-CLMInstaller([string]$Path){return New-Module -ArgumentList $Path -ScriptBlock {param($p);. $p;$script:WslExe=Join-Path $env:WINDIR 'System32/wsl.exe';Export-ModuleMember -Function *}}
function Receive-CLMAsset([string]$Url,[string]$Path,[long]$Limit){
 if($Limit -le 0 -or $Limit -gt 1099511627776L){throw 'Invalid download size bound'}
 $p=Assert-CLMPath $Path;if(Test-Path -LiteralPath $p){throw 'Download destination already exists'}
 [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;$request=[Net.HttpWebRequest]::Create($Url);$request.UserAgent='CastLink-Maintenance/1';$request.Timeout=60000;$request.ReadWriteTimeout=60000;$response=$null;$inputStream=$null;$outputStream=$null
 try{$response=$request.GetResponse();if($response.ResponseUri.Scheme -cne 'https' -or $response.ContentLength -gt $Limit){throw 'Download size or HTTPS validation failed'};$inputStream=$response.GetResponseStream();$outputStream=[IO.File]::Open($p,'CreateNew','Write','None');$buffer=New-Object byte[] 1048576;$total=0L;$clock=[Diagnostics.Stopwatch]::StartNew();while(($n=$inputStream.Read($buffer,0,$buffer.Length)) -gt 0){$total+=$n;if($total -gt $Limit -or $clock.Elapsed.TotalMinutes -gt 60){throw 'Download size/time limit'};$outputStream.Write($buffer,0,$n)};$outputStream.Flush($true)}finally{if($outputStream){$outputStream.Dispose()};if($inputStream){$inputStream.Dispose()};if($response){$response.Dispose()}}
}
function Receive-CLMTarget($Ctx){
 $dir=Assert-CLMPath $Ctx.targetDirectory;$manifestPath=Join-Path $dir 'manifest.json'
 if($Ctx.manifestSha256 -cnotmatch '^[a-f0-9]{64}$' -or (Get-CLMHash $manifestPath) -cne $Ctx.manifestSha256){throw 'Explicit target manifest checksum required'}
 $m=Read-CLMJson $manifestPath
 if($m.repository -cne 'resokol/castlink' -or $m.channel -cne 'server-wsl' -or $m.releaseTag -cnotmatch '^server-wsl-v[0-9][A-Za-z0-9.+-]*$' -or $m.lifecycle.runtimeContract -cne 'castlink-wsl-pg16-v1' -or $Ctx.source.releaseTag -cnotin @($m.lifecycle.supportedSources)){throw 'Incompatible target before download'}
 $url='https://github.com/resokol/castlink/releases/download/'+$m.releaseTag+'/'
 foreach($e in @($m.rootfs,$m.sources,$m.upstreamSources,$m.inventory)+@($m.nativePanel.files)+@($m.lifecycle.helpers)){
  Assert-CLMAssetName $e.file;$p=Join-Path $dir $e.file
  if(-not (Test-Path -LiteralPath $p)) {Receive-CLMAsset ($url+$e.file) $p ([long]$e.size)}
 }
}
function Assert-CLMGuestMarker($State){
 $code='import os,stat,sys; p="/var/lib/castlink-server-wsl-installation-id"; s=os.lstat(p); assert stat.S_ISREG(s.st_mode) and s.st_uid==0 and s.st_nlink==1 and not (s.st_mode & 0o022); assert open(p).read().strip()==sys.argv[1]'
 $null=Invoke-CLMWsl $State @('python3','-c',$code,$State.installationId)
}
function Stop-CLMServices($State){
 $null=Invoke-CLMWsl $State @('systemctl','disable','castlink-server.target')
 $null=Invoke-CLMWsl $State @('systemctl','stop','castlink-server.target','castlink-private-ports','castlink-postgres','castlink-bootstrap','castlink-converter','castlink-livekit','castlink-web','castlink-caddy','castlink-turn-tls') '' '' 1048576 240
}
function Assert-CLMStopped($State){
 $code=@'
from pathlib import Path
import subprocess,stat,types
CGROUP_ROOT=Path('/sys/fs/cgroup')
CGROUP_MOUNTINFO=Path('/proc/self/mountinfo')
runtime=types.SimpleNamespace(SERVICES=['castlink-private-ports','castlink-postgres','castlink-bootstrap','castlink-converter','castlink-livekit','castlink-web','castlink-caddy','castlink-turn-tls'])
def bounded_text(path,limit=65536):
    with open(path,'rb') as source:data=source.read(limit+1)
    if len(data)>limit:raise ValueError('Metadata exceeds bound')
    return data.decode('utf-8')

def cgroup_v2_available():
    try:
        if CGROUP_ROOT.is_symlink() or not CGROUP_ROOT.is_dir(): return False
        controllers=CGROUP_ROOT/'cgroup.controllers'
        if controllers.is_symlink(): return False
        bounded_text(controllers,4096)
        for line in bounded_text(CGROUP_MOUNTINFO,1024*1024).splitlines():
            fields=line.split()
            if len(fields)>6 and fields[3]=='/' and fields[4]==str(CGROUP_ROOT):
                separator=fields.index('-')
                return fields[separator+1]=='cgroup2'
    except (OSError,ValueError,IndexError,UnicodeError):
        return False
    return False


def unit_cgroup_empty(unit,control_group):
    expected='/system.slice/'+unit
    if control_group not in ('',expected): return False
    parent=CGROUP_ROOT/'system.slice'
    group=parent/unit
    try:
        if parent.is_symlink() or not parent.is_dir(): return False
        try: info=group.lstat()
        except FileNotFoundError:
            # systemd clears ControlGroup after removing an empty unit cgroup.
            # Check its exact default path too, rather than trusting an empty field.
            return True
        if not stat.S_ISDIR(info.st_mode): return False
        events=group/'cgroup.events';processes=group/'cgroup.procs'
        if events.is_symlink() or processes.is_symlink(): return False
        def unpopulated():
            values={}
            for line in bounded_text(events,4096).splitlines():
                key,value=line.split()
                if key in values: return False
                values[key]=value
            # cgroup v2 populated covers this cgroup AND every descendant.
            return values.get('populated')=='0'
        return unpopulated() and not bounded_text(processes,65536).strip() and unpopulated()
    except (OSError,ValueError,UnicodeError):
        return False


def stopped_services():
    if not cgroup_v2_available(): return False
    properties=('Id','LoadState','ActiveState','MainPID','ControlPID','ControlGroup','Slice')
    for service in runtime.SERVICES:
        unit=service+'.service'
        result = subprocess.run(['/usr/bin/systemctl', 'show', unit, '--property='+','.join(properties)],
                                text=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=10)
        if result.returncode or len(result.stdout)>16384: return False
        values={}
        for line in result.stdout.splitlines():
            key,separator,value=line.partition('=')
            if not separator or key in values: return False
            values[key]=value
        if set(values)!=set(properties): return False
        # Preserve failed diagnostics, but require exact unit binding and zero
        # process IDs plus recursive kernel cgroup evidence for every owned unit.
        if values['Id']!=unit or values['LoadState']!='loaded' or values['Slice']!='system.slice': return False
        if values['ActiveState'] not in ('inactive','failed') or values['MainPID']!='0' or values['ControlPID']!='0': return False
        if not unit_cgroup_empty(unit,values['ControlGroup']): return False
    # A dead service receipt does not prove there are no surviving processes.
    for process in Path('/proc').glob('[0-9]*/comm'):
        try: name = process.read_text().strip()
        except FileNotFoundError: continue
        if name in ('postgres', 'livekit-server', 'haproxy', 'caddy'): return False
    result = subprocess.run(['/usr/bin/ss', '-H', '-lntu'], text=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=10)
    if result.returncode: return False
    ports = {80,443,3000,5432,5348,5349,7880,7881,7882,8443,3478,*range(30000,30032)}
    for line in result.stdout.splitlines():
        fields = line.split()
        if len(fields) < 6: return False
        try: port = int(fields[4].rsplit(':',1)[1])
        except (IndexError,ValueError): return False
        if port in ports: return False
    return True

assert stopped_services()
assert not Path('/var/lib/castlink-server/postgres/postmaster.pid').exists()
'@
 $null=Invoke-CLMWsl $State @('python3','-c',$code)
}
function Assert-CLMTarget([string]$Directory,[string]$Pin,[string]$SourceTag){
 if($Pin -cnotmatch '^[a-f0-9]{64}$' -or (Get-CLMHash (Join-Path $Directory 'manifest.json')) -cne $Pin){throw 'Explicit target manifest checksum required'}
 $m=Read-CLMJson (Join-Path $Directory 'manifest.json');$l=$m.lifecycle
 if($m.schemaVersion -ne 1 -or $m.channel -cne 'server-wsl' -or $m.repository -cne 'resokol/castlink' -or $m.architecture -cne 'amd64' -or $m.sourceCommit -cnotmatch '^[a-f0-9]{40}$' -or $m.version -cnotmatch '^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z][0-9A-Za-z.-]*)?(?:\+[0-9A-Za-z.-]+)?$' -or $m.releaseTag -cnotmatch '^server-wsl-v[0-9][A-Za-z0-9.+-]*$' -or $m.releaseTag -cne ('server-wsl-v'+$m.version+'-'+$m.sourceCommit.Substring(0,12)) -or $l.schemaVersion -ne 1 -or $l.runtimeContract -cne 'castlink-wsl-pg16-v1' -or $l.postgresMajor -ne 16 -or $SourceTag -cnotin @($l.supportedSources) -or $m.rootfs.expandedBytes -le 0){throw 'Target release lifecycle compatibility or expanded disk inventory is invalid'}
 $entries=@($m.rootfs,$m.sources,$m.upstreamSources,$m.inventory)+@($m.nativePanel.files)+@($l.helpers);$seen=@{}
 foreach($entry in $entries){if($seen.ContainsKey($entry.file)){if($seen[$entry.file] -cne $entry.sha256){throw 'Conflicting target inventory'};continue};$seen[$entry.file]=$entry.sha256;$null=Assert-CLMFile $Directory $entry}
 foreach($n in @('server-wsl-maintenance.ps1','server-wsl-maintenance-ui.ps1','server-wsl-maintenance.py','server-wsl-runtime.py','install-server-windows.template.ps1')){if(-not $seen.ContainsKey($n)){throw 'Missing lifecycle helper inventory'}}
 return $m
}
function Stage-CLMInstaller([string]$Directory,$Manifest,[string]$Pin){
 $template=Join-Path $Directory 'install-server-windows.template.ps1';$text=[IO.File]::ReadAllText($template,[Text.Encoding]::UTF8).TrimStart([char]0xfeff)
 foreach($p in @(@('RELEASE_TAG',$Manifest.releaseTag),@('ROOTFS_SHA256',$Manifest.rootfs.sha256),@('MANIFEST_SHA256',$Pin),@('REPOSITORY',$Manifest.repository))){$text=$text.Replace(('@CASTLINK_WSL_'+$p[0]+'@'),$p[1])}
 if($text -match '@CASTLINK_'){throw 'Unresolved target installer pin'}
 $bytes=([Text.UTF8Encoding]::new($true)).GetPreamble()+[Text.Encoding]::UTF8.GetBytes(($text -replace '\r?\n',"`r`n"));$p=Join-Path $Directory 'install-server-windows.ps1'
 if(Test-Path -LiteralPath $p){if((Get-CLMHash $p) -cne ([BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($bytes)).Replace('-','').ToLowerInvariant())){throw 'Target installer differs from inventoried template'}}else{[IO.File]::WriteAllBytes($p,$bytes)}
 return $p
}
function Stage-CLMGuest($Ctx){
 $stageId=if($Ctx.stagingId){$Ctx.stagingId}else{$Ctx.id};if($stageId -cnotmatch '^[a-f0-9]{32}$'){throw 'Private guest staging identity missing'};$dir='/var/lib/castlink-maintenance-'+$stageId
 $mkdir='import os,stat,sys; p=sys.argv[1]; os.mkdir(p,0o700) if not os.path.lexists(p) else None; s=os.lstat(p); assert stat.S_ISDIR(s.st_mode) and s.st_uid==0 and s.st_mode & 0o777==0o700'
 $null=Invoke-CLMWsl $Ctx.source @('python3','-c',$mkdir,$dir)
 foreach($name in @('server-wsl-maintenance.py','server-wsl-runtime.py')){
  $entry=@($Ctx.target.lifecycle.helpers|Where-Object {$_.file -ceq $name});if($entry.Count -ne 1){throw 'Missing verified target guest helper'};$p=Assert-CLMFile $Ctx.targetDirectory $entry[0]
  $code=@'
import sys,os,hashlib,stat
p,h=sys.argv[1:];b=sys.stdin.buffer.read(4194305)
assert len(b)<=4194304 and hashlib.sha256(b).hexdigest()==h
if os.path.lexists(p):
 s=os.lstat(p);assert stat.S_ISREG(s.st_mode) and s.st_uid==0 and s.st_nlink==1 and s.st_mode & 0o777==0o600
 with open(p,'rb') as f: assert hashlib.sha256(f.read(4194305)).hexdigest()==h
else:
 fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'wb') as f:f.write(b);f.flush();os.fsync(f.fileno())
'@
  $null=Invoke-CLMWsl $Ctx.source @('python3','-c',$code,($dir+'/'+$name),$entry[0].sha256) $p
 }
 return $dir+'/server-wsl-maintenance.py'
}
function Invoke-CLMGuest($Ctx,$State,[string]$Command,[string]$InputFile,[string]$OutputFile,[string[]]$Extra=@()){
 $argsList=@('/usr/local/bin/castlink-server-maintenance',$Command,'--installation-id',$State.installationId)+$Extra
 if($State.installationId -ceq $Ctx.source.installationId -and $Ctx.target){$helper=Stage-CLMGuest $Ctx;$argsList=@('python3',$helper,$Command,'--installation-id',$State.installationId)+$Extra}
 return Invoke-CLMWsl $State $argsList $InputFile $OutputFile $(if($OutputFile){1099511627776L}else{65536}) 1800
}
function Read-CLMBundle([string]$Directory){
 $b=Read-CLMJson (Join-Path $Directory 'bundle.json');if($b.schemaVersion -ne 1 -or $b.kind -cne 'castlink-wsl-full-export' -or $b.source.installationId -cnotmatch '^[a-f0-9]{32}$' -or $b.source.schemaVersion -ne 1 -or $b.source.repository -cne 'resokol/castlink' -or $b.source.phase -cnotin @('ready','imported') -or $b.source.distroName -cne ('CastLink-Server-'+$b.source.installationId.Substring(0,12))){throw 'Unsupported removal bundle'}
 $seen=@{};foreach($e in @($b.files|Where-Object {$_})){if($seen.ContainsKey($e.file)){throw 'Duplicate bundle inventory'};$seen[$e.file]=$true;$null=Assert-CLMFile $Directory $e};if(@($b.files|Where-Object {$_.file -ceq 'distribution.tar'}).Count -ne 1){throw 'Bundle export is missing'}
 return $b
}
function Get-CastlinkWslReleaseChoices {
 # Explicit releases channel only. GitHub's immutable asset digest pins downloaded manifest bytes.
 $request=[Net.HttpWebRequest]::Create('https://api.github.com/repos/resokol/castlink/releases?per_page=100');$request.UserAgent='CastLink-Maintenance/1';$request.Timeout=30000;$response=$null;$reader=$null
 try{$response=$request.GetResponse();if($response.ResponseUri.Scheme -cne 'https' -or $response.ContentLength -gt 4194304){throw 'Release catalogue size or HTTPS failure'};$reader=New-Object IO.StreamReader($response.GetResponseStream(),[Text.Encoding]::UTF8);$buffer=New-Object char[] 4194305;$n=$reader.ReadBlock($buffer,0,$buffer.Length);if($n -gt 4194304){throw 'Release catalogue exceeds bound'};$values=(-join $buffer[0..($n-1)])|ConvertFrom-Json
  foreach($r in @($values)){if($r.draft -or $r.tag_name -cnotmatch '^server-wsl-v[0-9][A-Za-z0-9.+-]*$'){continue};$a=@($r.assets|Where-Object {$_.name -ceq 'manifest.json'});if($a.Count -ne 1 -or $a[0].digest -cnotmatch '^sha256:[a-f0-9]{64}$' -or $a[0].size -le 0 -or $a[0].size -gt 1048576){continue};[pscustomobject]@{releaseTag=$r.tag_name;prerelease=[bool]$r.prerelease;manifestSha256=$a[0].digest.Substring(7);manifestSize=[long]$a[0].size;label=($r.tag_name+$(if($r.prerelease){' (prerelease)'}else{''}))}}
 }finally{if($reader){$reader.Dispose()};if($response){$response.Dispose()}}
}
function Receive-CastlinkWslReleaseManifest($Choice){
 if($Choice.releaseTag -cnotmatch '^server-wsl-v[0-9][A-Za-z0-9.+-]*$' -or $Choice.manifestSha256 -cnotmatch '^[a-f0-9]{64}$'){throw 'Invalid explicit release selection'}
 $cache=Join-Path $env:LOCALAPPDATA ('CastLinkServer\lifecycle-packages\'+$Choice.releaseTag+'-'+$Choice.manifestSha256.Substring(0,12));Protect-CLMDirectory $cache;$p=Join-Path $cache 'manifest.json'
 if(-not (Test-Path -LiteralPath $p)){Receive-CLMAsset ('https://github.com/resokol/castlink/releases/download/'+$Choice.releaseTag+'/manifest.json') $p $Choice.manifestSize}
 if((Get-CLMHash $p) -cne $Choice.manifestSha256){throw 'Selected release manifest checksum mismatch'}
 return [pscustomobject]@{directory=$cache;manifestSha256=$Choice.manifestSha256;releaseTag=$Choice.releaseTag}
}
function Copy-CLMTaskForValidation($Task){
 # Keep CIM trigger metadata intact; normalize only enabled state for validating an owned disabled task.
 return [pscustomobject]@{TaskName=$Task.TaskName;TaskPath=$Task.TaskPath;Description=$Task.Description;Principal=$Task.Principal;Actions=@($Task.Actions);Triggers=@($Task.Triggers);Settings=[pscustomobject]@{Enabled=$true;ExecutionTimeLimit=$Task.Settings.ExecutionTimeLimit;MultipleInstances=$Task.Settings.MultipleInstances}}
}
function Assert-CLMSourceManifest($Manifest,$State){
 # Installed provenance does not require redistributing rootfs/corresponding sources.
 $m=$Manifest;$l=$m.lifecycle
 if($m.schemaVersion -ne 1 -or $m.channel -cne 'server-wsl' -or $m.repository -cne $State.repository -or $m.architecture -cne 'amd64' -or $m.sourceCommit -cnotmatch '^[a-f0-9]{40}$' -or $m.releaseTag -cne $State.releaseTag -or $m.releaseTag -cne ('server-wsl-v'+$m.version+'-'+$m.sourceCommit.Substring(0,12)) -or $m.rootfs.sha256 -cne $State.rootfsSha256 -or $l.schemaVersion -ne 1 -or $l.runtimeContract -cne 'castlink-wsl-pg16-v1' -or $l.postgresMajor -ne 16){throw 'Installed source lifecycle provenance mismatch'}
 $required=@('server-wsl-maintenance.ps1','server-wsl-maintenance-ui.ps1','server-wsl-maintenance.py','server-wsl-runtime.py','install-server-windows.template.ps1');$seen=@{}
 foreach($e in @($l.helpers)){Assert-CLMAssetName $e.file;if($e.file -cnotin $required -or $seen.ContainsKey($e.file) -or $e.sha256 -cnotmatch '^[a-f0-9]{64}$' -or $e.size -le 0 -or $e.size -gt 4194304){throw 'Installed source helper inventory mismatch'};$seen[$e.file]=$true}
 if($seen.Count -ne $required.Count){throw 'Installed source helper inventory incomplete'}
}
function Get-CLMProvenancePath([string]$Base,$State){
 $hash=[Security.Cryptography.SHA256]::Create();try{$key=[BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($State.rootPath.ToLowerInvariant()))).Replace('-','').ToLowerInvariant().Substring(0,16)}finally{$hash.Dispose()}
 return Join-Path $Base ('source-'+$State.installationId+'-'+$key+'.json')
}
function Assert-CLMProvenance($Record,$State){
 if($Record.schemaVersion -ne 1 -or $Record.installationId -cne $State.installationId -or $Record.rootPath -cne $State.rootPath -or $Record.releaseTag -cne $State.releaseTag -or $Record.rootfsSha256 -cne $State.rootfsSha256 -or $Record.manifestSha256 -cnotmatch '^[a-f0-9]{64}$' -or $Record.installerSha256 -cnotmatch '^[a-f0-9]{64}$'){throw 'Independent source provenance identity mismatch'}
}
function Receive-CLMSourceMetadata([string]$Source,[string]$Cache,$Entry,[string]$Tag){
 $dest=Join-Path $Cache $Entry.file
 if(Test-Path -LiteralPath $Source){$null=Assert-CLMFile (Split-Path $Source -Parent) $Entry;if(-not (Test-Path -LiteralPath $dest)){[IO.File]::Copy($Source,$dest,$false)}}
 if(-not (Test-Path -LiteralPath $dest)){Receive-CLMAsset ('https://github.com/resokol/castlink/releases/download/'+$Tag+'/'+$Entry.file) $dest $Entry.size}
 return Assert-CLMFile $Cache $Entry
}
function Get-CLMSourcePackage($Ctx,$State){
 $cache=Join-Path (Get-CLMStorageRoot $Ctx.sourceRoot) ('lifecycle-cache\'+$State.releaseTag);$baseCache=$cache;Protect-CLMDirectory $baseCache;$provenancePath=Get-CLMProvenancePath $baseCache $State;$provenance=$null
 if(Test-Path -LiteralPath $provenancePath){$acl=([IO.FileInfo]::new($provenancePath)).GetAccessControl([Security.AccessControl.AccessControlSections]'Access, Owner');$allowed=@([Security.Principal.WindowsIdentity]::GetCurrent().User.Value,'S-1-5-18','S-1-5-32-544');if($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -notin $allowed -or @($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])|Where-Object {$_.AccessControlType -eq 'Allow' -and $_.IdentityReference.Value -notin $allowed}).Count){throw 'Independent source provenance is not private; preserved for inspection'};$provenance=Read-CLMJson $provenancePath;Assert-CLMProvenance $provenance $State}
 if($State.releaseTag -ceq $script:CLMLegacyTag){
  if($State.rootfsSha256 -cne $script:CLMLegacyRootfs){throw 'Legacy rootfs published pin mismatch'}
  $pins=@{'manifest.json'=$script:CLMLegacyManifest;'install-server-windows.ps1'=$script:CLMLegacyInstaller}
  foreach($name in @('manifest.json','install-server-windows.ps1')){
   $source=if($name -ceq 'manifest.json'){Join-Path $Ctx.sourceRoot 'release\manifest.json'}else{Join-Path $Ctx.sourceRoot $name}
   if(Test-Path -LiteralPath $source){if((Get-CLMHash $source) -cne $pins[$name]){throw 'Legacy staged source checksum mismatch'}}else{
    Protect-CLMDirectory $cache;$source=Join-Path $cache $name
    if(-not (Test-Path -LiteralPath $source)){Receive-CLMAsset ('https://github.com/resokol/castlink/releases/download/'+$script:CLMLegacyTag+'/'+$name) $source 1048576}
    if((Get-CLMHash $source) -cne $pins[$name]){throw 'Legacy downloaded source checksum mismatch'}
   }
   if($name -ceq 'manifest.json'){$Ctx.sourceManifest=$source}else{$Ctx.sourceInstaller=$source}
  }
 }else{
  $pin=if($State.releaseManifestSha256){$State.releaseManifestSha256}elseif($State.nativePanel){$State.nativePanel.manifestSha256}elseif($provenance){$provenance.manifestSha256}else{''}
  if(-not $pin -and $Ctx.targetDirectory -and $Ctx.manifestSha256){
   $supplied=Join-Path $Ctx.targetDirectory 'manifest.json'
   if((Test-Path -LiteralPath $supplied) -and (Get-CLMHash $supplied) -ceq $Ctx.manifestSha256){$value=Read-CLMJson $supplied;if($value.releaseTag -ceq $State.releaseTag){Assert-CLMSourceManifest $value $State;$pin=$Ctx.manifestSha256}}
  }
  if(-not $pin){$choice=@(Get-CastlinkWslReleaseChoices|Where-Object {$_.releaseTag -ceq $State.releaseTag});if($choice.Count -ne 1){throw 'Exact installed release manifest digest unavailable; supply its verified package'};$pin=$choice[0].manifestSha256}
  if($pin -cnotmatch '^[a-f0-9]{64}$' -or ($provenance -and $provenance.manifestSha256 -cne $pin)){throw 'Installed source manifest pin mismatch'}
  $cache=Join-Path $baseCache $pin;Protect-CLMDirectory $cache;$cachedManifest=Join-Path $cache 'manifest.json';$installedManifest=Join-Path $Ctx.sourceRoot 'release\manifest.json'
  if(Test-Path -LiteralPath $installedManifest){if((Get-CLMHash $installedManifest) -cne $pin){throw 'Installed source manifest checksum mismatch'};if(-not (Test-Path -LiteralPath $cachedManifest)){[IO.File]::Copy($installedManifest,$cachedManifest,$false)}}
  if(-not (Test-Path -LiteralPath $cachedManifest)){Receive-CLMAsset ('https://github.com/resokol/castlink/releases/download/'+$State.releaseTag+'/manifest.json') $cachedManifest 1048576}
  if((Get-CLMHash $cachedManifest) -cne $pin){throw 'Cached installed source manifest checksum mismatch'}
  $sm=Read-CLMJson $cachedManifest;Assert-CLMSourceManifest $sm $State
  $entry=@($sm.lifecycle.helpers|Where-Object {$_.file -ceq 'install-server-windows.template.ps1'})[0]
  $null=Receive-CLMSourceMetadata (Join-Path $Ctx.sourceRoot ('release\'+$entry.file)) $cache $entry $State.releaseTag
  $cachedInstaller=Stage-CLMInstaller $cache $sm $pin;$installedInstaller=Join-Path $Ctx.sourceRoot 'install-server-windows.ps1'
  if((Test-Path -LiteralPath $installedInstaller) -and (Get-CLMHash $installedInstaller) -cne (Get-CLMHash $cachedInstaller)){throw 'Installed source installer checksum mismatch'}
  $Ctx.sourceManifest=if(Test-Path -LiteralPath $installedManifest){$installedManifest}else{$cachedManifest};$Ctx.sourceInstaller=if(Test-Path -LiteralPath $installedInstaller){$installedInstaller}else{$cachedInstaller}
 }

 $m=Read-CLMJson $Ctx.sourceManifest
 if($m.schemaVersion -ne 1 -or $m.channel -cne 'server-wsl' -or $m.releaseTag -cne $State.releaseTag -or $m.repository -cne $State.repository -or $m.rootfs.sha256 -cne $State.rootfsSha256){throw 'Source manifest and receipt mismatch'}
 Protect-CLMDirectory $cache
 foreach($pair in @(@($Ctx.sourceManifest,'manifest.json'),@($Ctx.sourceInstaller,'install-server-windows.ps1'))){$dest=Join-Path $cache $pair[1];if(-not (Test-Path -LiteralPath $dest)){[IO.File]::Copy($pair[0],$dest,$false)};if((Get-CLMHash $dest) -cne (Get-CLMHash $pair[0])){throw 'Cached source provenance payload checksum mismatch'}}
 $record=[pscustomobject]@{schemaVersion=1;installationId=$State.installationId;rootPath=$State.rootPath;releaseTag=$State.releaseTag;rootfsSha256=$State.rootfsSha256;manifestSha256=(Get-CLMHash $Ctx.sourceManifest);installerSha256=(Get-CLMHash $Ctx.sourceInstaller);cache=$cache}
 if($provenance){if($record.manifestSha256 -cne $provenance.manifestSha256 -or $record.installerSha256 -cne $provenance.installerSha256){throw 'Independent source provenance payload changed'}}else{Write-CLMJson $provenancePath $record}
 $State|Add-Member NoteProperty releaseManifestSha256 $record.manifestSha256 -Force
 $Ctx.sourceCache=$cache;$Ctx.sourceProvenance=$provenancePath;$Ctx.sourceProvenanceSha256=Get-CLMHash $provenancePath
}
function Sync-CLMKeepaliveReceipt([string]$Root,$State,$Module){
 $current=Read-CLMReceipt $Root
 foreach($name in @('installationId','distroName','rootPath','repository','releaseTag','rootfsSha256')){if($current.$name -cne $State.$name){throw 'Current keepalive installation identity differs; replay refused'}}
 $keeper=$null
 if($current.keepalive){
  if(-not $Module){throw 'Verified installer required to reconcile current keepalive identity'}
  $process=Invoke-CLMInstaller $Module {param($s);Get-CastlinkKeepaliveProcess $s} $current
  if($process){try{$keeper=Copy-CLMObject $current.keepalive}finally{$process.Dispose()}}
  elseif(Invoke-CLMInstaller $Module {param($s);Get-CastlinkProcessEvidence ([int]$s.keepalive.processId)} $current){throw 'Current keepalive process identity is not owned; replay refused'}
 }
 # Never replay an obsolete journal PID over a newer persisted keeper (or a recorded stop).
 $State|Add-Member NoteProperty keepalive $keeper -Force
 return $State
}
function Invoke-CLMDefaultAdapter([string]$Name,$Ctx,$Data){
 switch($Name){
  'VerifySource' {
   $s=Read-CLMReceipt $Ctx.sourceRoot -AllowRemoved:$Ctx.recovery;Get-CLMSourcePackage $Ctx $s;$Ctx.sourceModule=Import-CLMInstaller $Ctx.sourceInstaller
   if(-not $Ctx.recovery){Assert-CLMGuestMarker $s}
   return $s
  }
  'VerifyTarget' {Receive-CLMTarget $Ctx;return Assert-CLMTarget $Ctx.targetDirectory $Ctx.manifestSha256 $Ctx.source.releaseTag}
  'InspectSource' {
   if($Ctx.target){return (Invoke-CLMGuest $Ctx $Ctx.source 'inspect'|ConvertFrom-Json)}
   # Removal supports an imported legacy tree without application initialization.
   return [pscustomobject]@{initialized=($Ctx.source.phase -ceq 'ready');complete=($Ctx.source.phase -ceq 'ready');dataBytes=0;postgresMajor=16;stopped=$false}
  }
  'FreeBytes' {return ([IO.DriveInfo]::new([IO.Path]::GetPathRoot($Ctx.sourceRoot))).AvailableFreeSpace}
  'SourceTask' {
   $spec=if($Ctx.task -and $Ctx.task.spec){$Ctx.task.spec}else{Invoke-CLMInstaller $Ctx.sourceModule {param($d);Get-CastlinkLogonTaskSpec $d.root $d.s $d.installer} @{root=$Ctx.sourceRoot;s=$Ctx.source;installer=$Ctx.sourceInstaller}}
   $t=Get-ScheduledTask -TaskName $spec.taskName -TaskPath $spec.taskPath -ErrorAction SilentlyContinue
   if($t){$copy=Copy-CLMTaskForValidation $t;Invoke-CLMInstaller $Ctx.sourceModule {param($d);Assert-CastlinkLogonTask $d.task $d.spec} @{task=$copy;spec=$spec}}
   return [pscustomobject]@{exists=[bool]$t;enabled=([bool]$t -and [bool]$t.Settings.Enabled);spec=$spec}
  }
  'DisableSourceTask' {if($Ctx.task.exists){$null=Invoke-CLMDefaultAdapter 'SourceTask' $Ctx $null;Disable-ScheduledTask -TaskName $Ctx.task.spec.taskName -TaskPath $Ctx.task.spec.taskPath|Out-Null}}
  'RestoreSourceTask' {if($Ctx.task.exists){$null=Invoke-CLMDefaultAdapter 'SourceTask' $Ctx $null;if($Ctx.task.enabled){Enable-ScheduledTask -TaskName $Ctx.task.spec.taskName -TaskPath $Ctx.task.spec.taskPath|Out-Null}}}
  'StopSource' {Stop-CLMServices $Ctx.source;$maintenance=Copy-CLMObject $Ctx.source;$maintenance.phase='maintenance';$maintenance|Add-Member NoteProperty maintenanceTransaction $Ctx.id -Force;Invoke-CLMInstaller $Ctx.sourceModule {param($d);Stop-CastlinkKeepalive $d.root $d.s} @{root=$Ctx.sourceRoot;s=$maintenance}}
  'AssertSourceStopped' {if($Ctx.target){$i=Invoke-CLMGuest $Ctx $Ctx.source 'inspect'|ConvertFrom-Json;if(-not $i.stopped){throw 'Source stopped proof failed'}}else{Assert-CLMStopped $Ctx.source}}
  'ExportTransfer' {$null=Invoke-CLMGuest $Ctx $Ctx.source 'export' '' $Ctx.transfer}
  'ImportCandidate' {if(Test-Path -LiteralPath $Ctx.candidateRoot){throw 'Candidate directory already exists without verified marker; inspect manually'};Protect-CLMDirectory $Ctx.candidateRoot;Write-CLMJson (Join-Path $Ctx.candidateRoot 'installation.json') $Ctx.candidate;$null=Invoke-CLMProcess (Join-Path $env:WINDIR 'System32\wsl.exe') @('--import',$Ctx.candidate.distroName,(Join-Path $Ctx.candidateRoot 'distribution'),(Join-Path $Ctx.targetDirectory $Ctx.target.rootfs.file),'--version','2') '' '' 1048576 1800}
  'MarkCandidate' {$p=Join-Path $Ctx.directory 'marker.stdin';[IO.File]::WriteAllText($p,$Ctx.candidate.installationId,[Text.Encoding]::ASCII);$code='import os,sys; p="/var/lib/castlink-server-wsl-installation-id"; b=sys.stdin.buffer.read(33); assert len(b)==32; fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600); f=os.fdopen(fd,"wb"); f.write(b); f.flush(); os.fsync(f.fileno()); f.close()';$null=Invoke-CLMWsl $Ctx.candidate @('python3','-c',$code) $p;Remove-Item -LiteralPath $p}
  'CandidateRegistered' {$names=Invoke-CLMProcess (Join-Path $env:WINDIR 'System32\wsl.exe') @('--list','--quiet');return (($names -replace "`0",'').Split("`n").Trim() -ccontains $Ctx.candidate.distroName)}
  'CandidateOwned' {
   $names=Invoke-CLMProcess (Join-Path $env:WINDIR 'System32\wsl.exe') @('--list','--quiet');if(($names -replace "`0",'').Split("`n").Trim() -cnotcontains $Ctx.candidate.distroName){return $false}
   $code='import os,stat,sys; p="/var/lib/castlink-server-wsl-installation-id"; s=os.lstat(p); assert stat.S_ISREG(s.st_mode) and s.st_uid==0 and s.st_nlink==1; assert open(p).read().strip()==sys.argv[1]'
   try{$null=Invoke-CLMWsl $Ctx.candidate @('python3','-c',$code,$Ctx.candidate.installationId)}catch{throw 'Unmarked or ambiguous candidate import requires manual inspection; source remains stopped'};return $true
  }
  'GateClose' {$null=Invoke-CLMGuest $Ctx $Ctx.candidate 'gate-close' '' '' @('--transaction-id',$Ctx.id)}
  'ImportTransfer' {$null=Invoke-CLMGuest $Ctx $Ctx.candidate 'import' $Ctx.transfer}
  'StartCandidate' {
   $installer=Stage-CLMInstaller $Ctx.targetDirectory $Ctx.target $Ctx.manifestSha256;$m=Import-CLMInstaller $installer
   Invoke-CLMInstaller $m {param($d);$null=Stage-CastlinkPinnedInstaller $d.root $d.installer;Start-CastlinkKeepalive $d.root $d.s} @{root=$Ctx.candidateRoot;s=$Ctx.candidate;installer=$installer}
   $null=Invoke-CLMWsl $Ctx.candidate @('/usr/local/bin/castlink-server','start') '' '' 1048576 1200}
  'CandidateReady' {$v=Invoke-CLMWsl $Ctx.candidate @('/usr/local/bin/castlink-server','status')|ConvertFrom-Json;if(-not $v.ready -or $v.buildId -cne ($Ctx.target.releaseTag -replace '^server-wsl-v','')){throw 'Candidate readiness or exact build mismatch'};return $v}
  'PrepareBindings' {
   $cache=Join-Path $Ctx.candidateRoot 'release';Protect-CLMDirectory $cache
   # Full archives remain in the verified target package; installed controls need only metadata and helpers.
   foreach($e in @($Ctx.target.inventory)+@($Ctx.target.nativePanel.files)+@($Ctx.target.lifecycle.helpers)){if(-not (Test-Path -LiteralPath (Join-Path $cache $e.file))){[IO.File]::Copy((Assert-CLMFile $Ctx.targetDirectory $e),(Join-Path $cache $e.file),$false)}}
   if(Test-Path -LiteralPath (Join-Path $cache 'manifest.json')){if((Get-CLMHash (Join-Path $cache 'manifest.json')) -cne $Ctx.manifestSha256){throw 'Candidate manifest collision'}}else{[IO.File]::Copy((Join-Path $Ctx.targetDirectory 'manifest.json'),(Join-Path $cache 'manifest.json'),$false)}
   $installer=Stage-CLMInstaller $cache $Ctx.target $Ctx.manifestSha256;$module=Import-CLMInstaller $installer;$Ctx.candidate.phase='ready'
   $Ctx.candidate=Set-CLMNativeBindings $Ctx $Ctx.candidate $Ctx.ready $cache $installer $Ctx.manifestSha256 $module
   Write-CLMJson (Join-Path $Ctx.candidateRoot 'installation.json') $Ctx.candidate
   return $Ctx.candidate
  }
  'PublishCandidateTask' {
   if($Ctx.task.exists){
    $s=Read-CLMReceipt $Ctx.candidateRoot;$p=Join-Path $Ctx.candidateRoot 'install-server-windows.ps1';$m=Import-CLMInstaller $p
    $spec=Invoke-CLMInstaller $m {param($d);Get-CastlinkLogonTaskSpec $d.root $d.s $d.installer} @{root=$Ctx.candidateRoot;s=$s;installer=$p}
    $t=Get-ScheduledTask -TaskName $spec.taskName -TaskPath $spec.taskPath -ErrorAction SilentlyContinue
    if($t){$copy=Copy-CLMTaskForValidation $t;Invoke-CLMInstaller $m {param($d);Assert-CastlinkLogonTask $d.task $d.spec} @{task=$copy;spec=$spec}}
    else{Invoke-CLMInstaller $m {param($d);Register-CastlinkLogonTask $d.root $d.s $d.installer} @{root=$Ctx.candidateRoot;s=$s;installer=$p}}
    if($Ctx.task.enabled){Enable-ScheduledTask -TaskName $spec.taskName -TaskPath $spec.taskPath|Out-Null}else{Disable-ScheduledTask -TaskName $spec.taskName -TaskPath $spec.taskPath|Out-Null}
   }
  }
  'GateOpen' {Assert-CLMGuestMarker $Ctx.candidate;$null=Invoke-CLMGuest $Ctx $Ctx.candidate 'gate-open' '' '' @('--committed-transaction',$Ctx.id);$s=Read-CLMReceipt $Ctx.candidateRoot;$m=Import-CLMInstaller (Join-Path $Ctx.candidateRoot 'install-server-windows.ps1');if($Ctx.source.desiredRunning){Invoke-CLMInstaller $m {param($d);Start-CastlinkKeepalive $d.root $d.s} @{root=$Ctx.candidateRoot;s=$s}}}
  'StopCandidate' {
   Stop-CLMServices $Ctx.candidate
   $p=Join-Path $Ctx.candidateRoot 'install-server-windows.ps1'
   if(Test-Path -LiteralPath $p){$expected=Stage-CLMInstaller $Ctx.targetDirectory $Ctx.target $Ctx.manifestSha256;if((Get-CLMHash $p) -cne (Get-CLMHash $expected)){throw 'Candidate installer ownership mismatch'};$m=Import-CLMInstaller $p;$s=Read-CLMReceipt $Ctx.candidateRoot;Invoke-CLMInstaller $m {param($d);Stop-CastlinkKeepalive $d.root $d.s} @{root=$Ctx.candidateRoot;s=$s}}
   $i=Invoke-CLMGuest $Ctx $Ctx.candidate 'inspect'|ConvertFrom-Json;if(-not $i.stopped){throw 'Candidate strict stopped proof failed'}}
  'ReleaseStoppedFirewall' {$null=Invoke-CLMGuest $Ctx $Ctx.candidate 'gate-close' '' '' @('--transaction-id',$Ctx.id,'--release-stopped-firewall')}
  'DiscardCandidate' {$null=Invoke-CLMProcess (Join-Path $env:WINDIR 'System32\wsl.exe') @('--unregister',$Ctx.candidate.distroName)}
  'TerminateCandidate' {$null=Invoke-CLMProcess (Join-Path $env:WINDIR 'System32\wsl.exe') @('--terminate',$Ctx.candidate.distroName);$names=Invoke-CLMProcess (Join-Path $env:WINDIR 'System32\wsl.exe') @('--list','--running','--quiet');if(($names -replace "`0",'').Split("`n").Trim() -ccontains $Ctx.candidate.distroName){throw 'Candidate termination not confirmed'}}
  'ResumeSource' {Invoke-CLMInstaller $Ctx.sourceModule {param($d);Start-CastlinkKeepalive $d.root $d.s} @{root=$Ctx.sourceRoot;s=$Ctx.source};$null=Invoke-CLMWsl $Ctx.source @('/usr/local/bin/castlink-server','start')}
  'CleanupSource' {Invoke-CLMDefaultAdapter 'UnregisterSource' $Ctx $null;Remove-CLMOwnedFiles $Ctx}
  'PreflightEntryPoint' {Get-CLMOwnedFiles $Ctx;Assert-CLMEntryPoint $Ctx}
  'PrepareEntryPoint' {Prepare-CLMEntryPoint $Ctx}
  'PublishEntryPoint' {Publish-CLMEntryPoint $Ctx}
  'RemoveOwnedFiles' {Remove-CLMOwnedFiles $Ctx}
  'CloseSourcePanel' {Close-CLMSourcePanel $Ctx}
  'UnregisterSource' {
   # Reverify complete task evidence immediately before deletion, ownership before unregister.
   $all=Invoke-CLMProcess (Join-Path $env:WINDIR 'System32\wsl.exe') @('--list','--quiet');$exists=($all -replace "`0",'').Split("`n").Trim() -ccontains $Ctx.source.distroName
   if($exists){Assert-CLMGuestMarker $Ctx.source}
   if($Ctx.task.exists){$null=Invoke-CLMDefaultAdapter 'SourceTask' $Ctx $null;if(Get-ScheduledTask -TaskName $Ctx.task.spec.taskName -TaskPath $Ctx.task.spec.taskPath -ErrorAction SilentlyContinue){Unregister-ScheduledTask -TaskName $Ctx.task.spec.taskName -TaskPath $Ctx.task.spec.taskPath -Confirm:$false}}
   if($exists){$null=Invoke-CLMProcess (Join-Path $env:WINDIR 'System32\wsl.exe') @('--terminate',$Ctx.source.distroName);$null=Invoke-CLMProcess (Join-Path $env:WINDIR 'System32\wsl.exe') @('--unregister',$Ctx.source.distroName)}
  }
  'ExportBundle' {Save-CLMBundleHelpers $Ctx $Data;$exportPath=Join-Path $Data 'distribution.tar';if(Test-Path -LiteralPath $exportPath){Remove-Item -LiteralPath (Assert-CLMPath $exportPath) -Force};$null=Invoke-CLMProcess (Join-Path $env:WINDIR 'System32\wsl.exe') @('--terminate',$Ctx.source.distroName);$null=Invoke-CLMProcess (Join-Path $env:WINDIR 'System32\wsl.exe') @('--export',$Ctx.source.distroName,(Join-Path $Data 'distribution.tar')) '' '' 1048576 1800}
  'CheckIdentityConflict' {
   $all=Invoke-CLMProcess (Join-Path $env:WINDIR 'System32\wsl.exe') @('--list','--quiet')
   if(($all -replace "`0",'').Split("`n").Trim() -ccontains $Ctx.source.distroName){throw 'Restore distribution identity is already registered'}
   if(Get-ScheduledTask -TaskName ('CastLink-Server-'+$Ctx.source.installationId+'-Start') -TaskPath '\' -ErrorAction SilentlyContinue){throw 'Restore scheduled task identity is already registered'}
   if($Ctx.source.desiredRunning){foreach($ep in [Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()){if($ep.Port -in @(80,443,7881)){throw 'Restore server ports are in use; stop only the conflicting server explicitly'}}}
   foreach($i in Get-CastlinkMaintenanceInstallations){$s=Read-CLMReceipt $i.activeRoot;if(($s.installationId -ceq $Ctx.source.installationId -or ($s.logicalInstallationId -and $s.logicalInstallationId -ceq $Ctx.source.logicalInstallationId)) -and $s.phase -cne 'maintenance'){throw 'Restore identity already installed'}}}
  'RestoreImport' {$null=Invoke-CLMProcess (Join-Path $env:WINDIR 'System32\wsl.exe') @('--import',$Ctx.source.distroName,(Join-Path $Ctx.sourceRoot 'distribution'),(Join-Path $Ctx.bundleDirectory 'distribution.tar'),'--version','2') '' '' 1048576 1800}
  'VerifyRestoreBundle' {Assert-CLMRestoreHelpers $Ctx}
  'RestoreOwned' {return Invoke-CLMDefaultAdapter 'CandidateOwned' $Ctx $null}
  'RestoreBindings' {
   $cache=Join-Path $Ctx.sourceRoot 'release';$m=Import-CLMInstaller (Join-Path $cache 'install-server-windows.ps1');$Ctx.sourceModule=$m
   $s=Sync-CLMKeepaliveReceipt $Ctx.sourceRoot $Ctx.source $m;$Ctx.source=$s
   $null=Invoke-CLMInstaller $m {param($d);Stage-CastlinkPinnedInstaller $d.root $d.installer} @{root=$Ctx.sourceRoot;installer=(Join-Path $cache 'install-server-windows.ps1')}
   if($Ctx.originalSource.phase -ceq 'ready'){
    # Private readiness behind no newly configured public target: this is the identical saved generation.
    Invoke-CLMInstaller $m {param($d);Start-CastlinkKeepalive $d.root $d.s} @{root=$Ctx.sourceRoot;s=$s}
    $null=Invoke-CLMWsl $s @('/usr/local/bin/castlink-server','start') '' '' 1048576 1200
    $status=Invoke-CLMWsl $s @('/usr/local/bin/castlink-server','status')|ConvertFrom-Json
    if(-not $status.ready -or $status.buildId -cne ($s.releaseTag -replace '^server-wsl-v','')){throw 'Restored same-release readiness mismatch'}
    $pin=if($Ctx.originalSource.releaseTag -ceq $script:CLMLegacyTag){$script:CLMLegacyManifest}else{$Ctx.originalSource.nativePanel.manifestSha256};$s=Set-CLMNativeBindings $Ctx $s $status $cache (Join-Path $cache 'install-server-windows.ps1') $pin $m
    $s.phase='ready'
    if(-not $s.desiredRunning){Stop-CLMServices $s;Invoke-CLMInstaller $m {param($d);Stop-CastlinkKeepalive $d.root $d.s} @{root=$Ctx.sourceRoot;s=$s}}else{Invoke-CLMInstaller $m {param($d);Start-CastlinkKeepalive $d.root $d.s} @{root=$Ctx.sourceRoot;s=$s}}
    Invoke-CLMDefaultAdapter 'PublishCandidateTask' $Ctx $null
   }
   Write-CLMJson (Join-Path $Ctx.sourceRoot 'installation.json') $s
  }
  default {throw ('Unknown lifecycle adapter operation '+$Name)}
 }
}
function Set-CLMNativeBindings($Ctx,$State,$Status,[string]$Cache,[string]$Installer,[string]$Pin,$Module){
 $manifest=Read-CLMJson (Join-Path $Cache 'manifest.json');$bundle=$manifest.nativePanel
 if(-not $bundle){return $State}
 if($bundle.schemaVersion -ne 1 -or $bundle.host -cne 'CastLinkServer.exe' -or $bundle.binding -cne 'server-native-binding.json' -or -not $Status.ready -or $Status.buildId -cne ($State.releaseTag -replace '^server-wsl-v','')){throw 'Native panel package/readiness contract mismatch'}
 $root=$State.rootPath;$panelRoot=Join-Path $root 'native-panel';Protect-CLMDirectory $panelRoot
 $null=Invoke-CLMInstaller $Module {param($d);Stage-CastlinkPinnedInstaller $d.root $d.installer} @{root=$root;installer=$Installer}
 foreach($e in @($bundle.files)){$source=Assert-CLMFile $Cache $e;$dest=Join-Path $panelRoot $e.file;if(Test-Path -LiteralPath $dest){if((Get-CLMHash $dest) -cne $e.sha256){throw 'Native panel helper collision; preserved'}}else{[IO.File]::Copy($source,$dest,$false)}}
 $saved=Read-CLMReceipt $root
 if($saved.nativePanel){$null=Invoke-CLMInstaller $Module {param($d);Assert-CastlinkNativePanelReceipt $d.root $d.s} @{root=$root;s=$saved};$State|Add-Member NoteProperty nativePanel $saved.nativePanel -Force;return $State}
 if(-not $Ctx.nativeHostStage){
  # Compile to a fresh private path. A crash before recording its digest never publishes that unrecorded output.
  $stage=Join-Path $Ctx.directory ('panel-'+[guid]::NewGuid().ToString('N')+'.exe')
  Invoke-CLMInstaller $Module {param($d);Build-CastlinkNativePanelHost $d.dir $d.output} @{dir=$panelRoot;output=$stage}
  $Ctx.nativeHostStage=$stage;$Ctx.nativeHostHash=Get-CLMHash $stage;Save-CLMJournal $Ctx 'prepare-native-host'
 }
 if((Get-CLMHash $Ctx.nativeHostStage) -cne $Ctx.nativeHostHash){throw 'Compiled native panel stage checksum mismatch'}
 $hostPath=Join-Path $panelRoot $bundle.host;if(Test-Path -LiteralPath $hostPath){if((Get-CLMHash $hostPath) -cne $Ctx.nativeHostHash){throw 'Unrecorded native panel host differs; preserved'}}else{[IO.File]::Copy($Ctx.nativeHostStage,$hostPath,$false)}
 $stagedInstaller=Join-Path $root 'install-server-windows.ps1';$binding=[pscustomobject][ordered]@{installationId=$State.installationId;installRoot=$root;origin=$Status.origin;expectedBuildId=$Status.buildId;sourceScriptPath=$stagedInstaller;expectedInstallerSha256=(Get-CLMHash $stagedInstaller)}
 $bindingPath=Join-Path $panelRoot $bundle.binding
 if(Test-Path -LiteralPath $bindingPath){$existing=Read-CLMJson $bindingPath;if(@($existing.PSObject.Properties).Count -ne 6){throw 'Unrecorded binding collision'};foreach($p in $binding.PSObject.Properties){if($existing.($p.Name) -cne $p.Value){throw 'Unrecorded binding differs; preserved'}}}else{Write-CLMJson $bindingPath $binding}
 $receipt=[pscustomobject]@{schemaVersion=1;hostPath=$hostPath;bindingPath=$bindingPath;hostSha256=$Ctx.nativeHostHash;bindingSha256=(Get-CLMHash $bindingPath);manifestSha256=$Pin};$State|Add-Member NoteProperty nativePanel $receipt -Force;Write-CLMJson (Join-Path $root 'installation.json') $State
 return $State
}
function Get-CLMOwnedFiles($Ctx){
 $known=@{};$m=Read-CLMJson $Ctx.sourceManifest
 # These release payloads are installed copies, never shared caches or retained export bundles.
 $release=Join-Path $Ctx.sourceRoot 'release'
 foreach($e in @($m.rootfs,$m.sources,$m.upstreamSources,$m.inventory)){
  if(-not $e){continue};$p=Join-Path $release $e.file
  if(Test-Path -LiteralPath $p){
   $entry=$e
   # The independently pinned RC1 manifest published packages.tsv with a digest but no size.
   if($Ctx.source.releaseTag -ceq $script:CLMLegacyTag -and $m.releaseTag -ceq $script:CLMLegacyTag -and $e.file -ceq 'packages.tsv' -and -not $e.PSObject.Properties['size']){
    $entry=Copy-CLMObject $e;$size=(Get-Item -LiteralPath (Assert-CLMPath $p)).Length;if($size -le 0 -or $size -gt 4194304){throw 'Legacy installed inventory exceeds cleanup bound'};$entry|Add-Member NoteProperty size $size
   }
   $null=Assert-CLMFile $release $entry;$known[$p]=$e.sha256
  }
 }
 foreach($e in @($m.nativePanel.files)+@($m.lifecycle.helpers)){
  if(-not $e){continue};foreach($dir in @((Join-Path $Ctx.sourceRoot 'release'),(Join-Path $Ctx.sourceRoot 'native-panel'))){$p=Join-Path $dir $e.file;if(Test-Path -LiteralPath $p){$null=Assert-CLMFile $dir $e;$known[$p]=$e.sha256}}
 }
 foreach($p in @($Ctx.sourceInstaller,$Ctx.sourceManifest)){if($p.StartsWith($Ctx.sourceRoot+'\',[StringComparison]::OrdinalIgnoreCase)){$known[$p]=Get-CLMHash $p}}
 if($Ctx.source.nativePanel){foreach($pair in @(@($Ctx.source.nativePanel.hostPath,$Ctx.source.nativePanel.hostSha256),@($Ctx.source.nativePanel.bindingPath,$Ctx.source.nativePanel.bindingSha256))){$p=Assert-CLMPath $pair[0];if(-not $p.StartsWith((Join-Path $Ctx.sourceRoot 'native-panel')+'\',[StringComparison]::OrdinalIgnoreCase) -or (Get-CLMHash $p) -cne $pair[1]){throw 'Source panel ownership mismatch'};$known[$p]=$pair[1]}}
 $Ctx.ownedFiles=@($known.GetEnumerator()|ForEach-Object {[pscustomobject]@{path=$_.Key;sha256=$_.Value}})
}
function Remove-CLMOwnedFiles($Ctx){foreach($e in @($Ctx.ownedFiles)){if(Test-Path -LiteralPath $e.path){if((Get-CLMHash $e.path) -cne $e.sha256){throw 'Owned cleanup file changed; preserved for inspection'};Remove-Item -LiteralPath $e.path -Force}}}
function Assert-CLMEntryPoint($Ctx){
 $p=Join-Path $Ctx.selectedRoot 'CastLinkServer.lnk';$Ctx.entryPointBeforeHash=$null
 if(Test-Path -LiteralPath $p){$v=Read-CLMJson (Join-Path $Ctx.selectedRoot 'active-generation.json');if(-not $v.entryPointHash -or (Get-CLMHash $p) -cne $v.entryPointHash){throw 'Unknown server shortcut exists; it was preserved'};$Ctx.entryPointBeforeHash=$v.entryPointHash}
}
function Prepare-CLMEntryPoint($Ctx){
 $s=Read-CLMReceipt $Ctx.candidateRoot;$p=Join-Path $Ctx.directory 'active-panel.lnk';$shell=New-Object -ComObject WScript.Shell
 try{$shortcut=$shell.CreateShortcut($p);$shortcut.TargetPath=$s.nativePanel.hostPath;$shortcut.Arguments='--binding "'+$s.nativePanel.bindingPath+'"';$shortcut.WorkingDirectory=Split-Path $s.nativePanel.hostPath -Parent;$shortcut.Description='CastLink Server '+$s.installationId;$shortcut.Save()}finally{if($shortcut){[void][Runtime.InteropServices.Marshal]::ReleaseComObject($shortcut)};[void][Runtime.InteropServices.Marshal]::ReleaseComObject($shell)}
 $Ctx.entryPointHash=Get-CLMHash $p
}
function Publish-CLMEntryPoint($Ctx){
 $p=Join-Path $Ctx.selectedRoot 'CastLinkServer.lnk';if(Test-Path -LiteralPath $p){$current=Get-CLMHash $p;if($current -ceq $Ctx.entryPointHash){return};if($current -cne $Ctx.entryPointBeforeHash){throw 'Selected server shortcut changed; gate remains closed'}}
 $source=Join-Path $Ctx.directory 'active-panel.lnk';if((Get-CLMHash $source) -cne $Ctx.entryPointHash){throw 'Prepared shortcut checksum mismatch'};$tmp=Join-Path $Ctx.selectedRoot ($Ctx.id+'.new.lnk');if(Test-Path -LiteralPath $tmp){if((Get-CLMHash $tmp) -cne $Ctx.entryPointHash){throw 'Shortcut staging collision'}}else{[IO.File]::Copy($source,$tmp,$false)}
 if(Test-Path -LiteralPath $p){[IO.File]::Replace($tmp,$p,[NullString]::Value)}else{[IO.File]::Move($tmp,$p)}
}
function Stop-CLMPanelProcess($Process,[string]$Description,[int]$GraceMilliseconds=0){
 # Callers retain the handle and prove executable/argv/creation identity before arriving here.
 if($GraceMilliseconds -gt 0 -and $Process.WaitForExit($GraceMilliseconds)){return}
 if($Process.HasExited){return}
 try{$Process.Kill()}catch{
  # Kill can race the launcher's natural exit after its child stops. Accept only this same handle's exit.
  if(-not $Process.WaitForExit(10000) -or -not $Process.HasExited){throw}
 }
 if(-not $Process.WaitForExit(10000) -or -not $Process.HasExited){throw ($Description+' did not close')}
}
function Close-CLMSourcePanel($Ctx){
 if(-not $Ctx.source.nativePanel){return};$p=$Ctx.source.nativePanel
 if((Get-CLMHash $p.hostPath) -cne $p.hostSha256 -or (Get-CLMHash $p.bindingPath) -cne $p.bindingSha256){throw 'Source panel checksum mismatch'}
 foreach($cim in Get-CimInstance Win32_Process -Filter "Name='CastLinkServer.exe'"){
  if($cim.ExecutablePath -ine $p.hostPath){continue};$args='--binding "'+$p.bindingPath+'"';$quoted='"'+$p.hostPath+'" ';$unquoted=$p.hostPath+' '
  if(([string]$cim.CommandLine).TrimEnd([char]32) -cnotin @(($quoted+$args),($unquoted+$args),($quoted+$args+' --startup'),($unquoted+$args+' --startup'))){continue}
  # Retain the exact parent handle and validate its creation time before closing its child.
  $process=$null;try{$process=[Diagnostics.Process]::GetProcessById([int]$cim.ProcessId)}catch [ArgumentException]{continue}
  try{
   [void]$process.Handle
   if($process.StartTime.ToUniversalTime().ToString('yyyyMMddHHmmssffffff') -cne $cim.CreationDate.ToUniversalTime().ToString('yyyyMMddHHmmssffffff')){throw 'Panel process identity changed'}
   $childExe=Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
   $control=Join-Path (Split-Path $p.hostPath -Parent) 'server-native-control.ps1';$quote={param($v) $v.Replace("'","''")}
   $baseCommand="`$ErrorActionPreference='Stop'; try { & '"+(& $quote $control)+"' -BindingFile '"+(& $quote $p.bindingPath)+"'"
   $suffix='; if ($null -eq $LASTEXITCODE) { exit 0 }; exit $LASTEXITCODE } catch { exit 1 }'
   $expectedCommands=@(($baseCommand+$suffix),($baseCommand+' -Startup -StartServer'+$suffix))
   foreach($child in Get-CimInstance Win32_Process -Filter ('ParentProcessId='+$cim.ProcessId)){
    if($child.ExecutablePath -ine $childExe -or $child.CommandLine -notmatch ' -EncodedCommand ([A-Za-z0-9+/=]+)$'){continue}
    $decoded=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String($Matches[1]));if($decoded -cnotin $expectedCommands){continue}
    $handle=[Diagnostics.Process]::GetProcessById([int]$child.ProcessId)
    try{[void]$handle.Handle;if($handle.StartTime.ToUniversalTime().ToString('yyyyMMddHHmmssffffff') -cne $child.CreationDate.ToUniversalTime().ToString('yyyyMMddHHmmssffffff')){throw 'Panel child process identity changed'};Stop-CLMPanelProcess $handle 'Owned panel child'}finally{$handle.Dispose()}
   }
   Stop-CLMPanelProcess $process 'Owned panel' 1000
  }finally{$process.Dispose()}
 }
}
function Open-CastlinkActivePanel([string]$SelectedRoot){
 $root=Get-CLMRoot $SelectedRoot;$s=Read-CLMReceipt $root;$p=$s.nativePanel
 if(-not $p -or (Get-CLMHash $p.hostPath) -cne $p.hostSha256 -or (Get-CLMHash $p.bindingPath) -cne $p.bindingSha256){throw 'Active server panel ownership mismatch'}
 $b=Read-CLMJson $p.bindingPath;if($b.installRoot -cne $root -or $b.installationId -cne $s.installationId){throw 'Active server panel binding mismatch'}
 Start-Process -FilePath $p.hostPath -ArgumentList ('--binding "'+$p.bindingPath+'"')|Out-Null
}
function Save-CLMBundleHelpers($Ctx,[string]$Directory){
 $manifest=Read-CLMJson $Ctx.sourceManifest;$entries=@();$seen=@{};$copied=@{}
 foreach($entry in @($manifest.nativePanel.files)+@($manifest.lifecycle.helpers)){if(-not $entry){continue};if($seen.ContainsKey($entry.file)){if($seen[$entry.file].sha256 -cne $entry.sha256 -or $seen[$entry.file].size -ne $entry.size){throw 'Conflicting same-release restore helper inventory'};continue};$seen[$entry.file]=$entry;$entries+=@($entry)}
 $names=@('manifest.json','install-server-windows.ps1')+@($entries|ForEach-Object {$_.file})
 foreach($name in $names){Assert-CLMAssetName $name;if($copied.ContainsKey($name)){continue};$source=Join-Path $Ctx.sourceRoot ('release\'+$name);if($name -ceq 'install-server-windows.ps1'){$source=$Ctx.sourceInstaller};if($name -ceq 'manifest.json'){$source=$Ctx.sourceManifest}
  if(-not (Test-Path -LiteralPath $source) -and $name -ne 'manifest.json'){$source=Join-Path $Ctx.sourceRoot ('native-panel\'+$name)}
  if(-not (Test-Path -LiteralPath $source -PathType Leaf)){
   $entry=@($entries|Where-Object {$_.file -ceq $name});if($entry.Count -ne 1){throw 'Same-release restore helper is missing; removal cancelled'}
   Protect-CLMDirectory $Ctx.sourceCache;$source=Join-Path $Ctx.sourceCache $name
   if(-not (Test-Path -LiteralPath $source)){Receive-CLMAsset ('https://github.com/resokol/castlink/releases/download/'+$Ctx.source.releaseTag+'/'+$name) $source $entry[0].size}
  }
  $entry=@($entries|Where-Object {$_.file -ceq $name});if($entry.Count){$null=Assert-CLMFile (Split-Path $source -Parent) $entry[0]}
  $dest=Join-Path $Directory $name;$null=Assert-CLMPath $source
  if(Test-Path -LiteralPath $dest){if((Get-CLMHash $dest) -cne (Get-CLMHash $source)){throw 'Bundle helper collision'}}else{[IO.File]::Copy($source,$dest,$false)}
  $copied[$name]=[ordered]@{file=$name;size=(Get-Item -LiteralPath $dest).Length;sha256=(Get-CLMHash $dest)}
 }
 $Ctx.bundleHelpers=@($copied.Values)
}
function Assert-CLMRestoreHelpers($Ctx){
 $b=$Ctx.bundleDirectory;$s=$Ctx.originalSource;$manifest=Read-CLMJson (Join-Path $b 'manifest.json');$installer=Join-Path $b 'install-server-windows.ps1'
 if($s.releaseTag -ceq $script:CLMLegacyTag){if((Get-CLMHash $installer) -cne $script:CLMLegacyInstaller -or (Get-CLMHash (Join-Path $b 'manifest.json')) -cne $script:CLMLegacyManifest -or $s.rootfsSha256 -cne $script:CLMLegacyRootfs){throw 'Restore legacy release pins mismatch'}}else{
  $sourcePin=if($s.releaseManifestSha256){$s.releaseManifestSha256}elseif($s.nativePanel){$s.nativePanel.manifestSha256}else{''}
  if($sourcePin -cnotmatch '^[a-f0-9]{64}$' -or (Get-CLMHash (Join-Path $b 'manifest.json')) -cne $sourcePin){throw 'Restore manifest release pin mismatch'}
  foreach($e in @($manifest.lifecycle.helpers)){$null=Assert-CLMFile $b $e};$null=Stage-CLMInstaller $b $manifest $sourcePin
 }
 if($manifest.releaseTag -cne $s.releaseTag -or $manifest.channel -cne 'server-wsl' -or $manifest.rootfs.sha256 -cne $s.rootfsSha256){throw 'Restore same-release identity mismatch'}
 foreach($e in @($manifest.nativePanel.files)){$null=Assert-CLMFile $b $e}
 $base=Assert-CLMPath (Join-Path $env:LOCALAPPDATA 'CastLinkServer');if(-not $Ctx.sourceRoot.StartsWith($base+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Restore destination must be a new directory under LocalAppData\CastLinkServer'}
 $free=([IO.DriveInfo]::new([IO.Path]::GetPathRoot($Ctx.sourceRoot))).AvailableFreeSpace;$archive=(Get-Item -LiteralPath (Join-Path $b 'distribution.tar')).Length;if($free -lt ($archive*2+2147483648L)){throw 'Insufficient restore disk space'}
}
function Complete-CLMRestore($Ctx){
 if($Ctx.phase -eq 'restored'){return $Ctx}
 # The saved journal inventory is immutable across replay; a mutable sidecar cannot repin server data.
 $exports=@($Ctx.bundle.files|Where-Object {$_.file -ceq 'distribution.tar'});if($exports.Count -ne 1){throw 'Saved restore export inventory is missing or ambiguous'}
 $null=Assert-CLMFile $Ctx.bundleDirectory $exports[0]
 Invoke-CLMAdapter $Ctx 'VerifyRestoreBundle'|Out-Null
 if($Ctx.phase -eq 'restore-import'){
  # An interrupted WSL import is safe to continue only if the exported marker proves it.
  if(-not (Invoke-CLMAdapter $Ctx 'RestoreOwned')){throw 'Unmarked or missing interrupted restore; manual inspection required'}
 }elseif($Ctx.phase -eq 'restore-prepared'){
  Save-CLMJournal $Ctx 'restore-import';Invoke-CLMAdapter $Ctx 'RestoreImport'|Out-Null
 }
 if(-not (Invoke-CLMAdapter $Ctx 'RestoreOwned')){throw 'Restored distribution marker could not be verified'}
 $cache=Join-Path $Ctx.sourceRoot 'release';if(-not (Test-Path -LiteralPath $cache)){if($Ctx.adapter){[void][IO.Directory]::CreateDirectory($cache)}else{Protect-CLMDirectory $cache}}
 foreach($entry in @($Ctx.bundle.files)){if($entry.file -eq 'distribution.tar'){continue};$p=Assert-CLMFile $Ctx.bundleDirectory $entry;$dest=Join-Path $cache $entry.file;if(Test-Path -LiteralPath $dest){if((Get-CLMHash $dest) -cne $entry.sha256){throw 'Restore helper collision'}}else{[IO.File]::Copy($p,$dest,$false)}}
 Save-CLMJournal $Ctx 'restore-bindings';Invoke-CLMAdapter $Ctx 'RestoreBindings'|Out-Null;Save-CLMJournal $Ctx 'restored';return $Ctx
}
function Start-CLMRestore([string]$Root,[string]$BundleDirectory,[scriptblock]$Adapter,[scriptblock]$Progress){
 $bundle=Read-CLMBundle $BundleDirectory
 if(Test-Path -LiteralPath $Root){throw 'Restore destination must be new and empty'}
 $source=Copy-CLMObject $bundle.source;$source.rootPath=$Root;$source.phase='imported';$source|Add-Member NoteProperty releaseManifestSha256 $(if($bundle.source.releaseManifestSha256){$bundle.source.releaseManifestSha256}elseif($bundle.source.nativePanel){$bundle.source.nativePanel.manifestSha256}elseif($bundle.source.releaseTag -ceq $script:CLMLegacyTag){$script:CLMLegacyManifest}else{Get-CLMHash (Join-Path $BundleDirectory 'manifest.json')}) -Force;$source.PSObject.Properties.Remove('nativePanel');$source.PSObject.Properties.Remove('keepalive');if(-not $source.logicalInstallationId){$source|Add-Member NoteProperty logicalInstallationId $source.installationId}
 $ctx=@{schemaVersion=1;kind='restore';id=[guid]::NewGuid().ToString('N');selectedRoot=$Root;sourceRoot=$Root;source=$source;originalSource=$bundle.source;candidate=$source;candidateRoot=$Root;task=$bundle.task;bundle=$bundle;bundleDirectory=(Assert-CLMPath $BundleDirectory);adapter=$Adapter;progress=$Progress;sourceModule=$null}
 Invoke-CLMAdapter $ctx 'VerifyRestoreBundle'|Out-Null;Invoke-CLMAdapter $ctx 'CheckIdentityConflict'|Out-Null
 if($Adapter){[void][IO.Directory]::CreateDirectory($Root)}else{Protect-CLMDirectory $Root}
 $ctx.directory=Join-Path (Get-CLMStorageRoot $Root) ('lifecycle-transactions\'+$ctx.id);if($Adapter){[void][IO.Directory]::CreateDirectory($ctx.directory)}else{Protect-CLMDirectory $ctx.directory};$ctx.journal=Join-Path $ctx.directory 'journal.json'
 $lease=[IO.File]::Open((Join-Path $Root 'operation.lock'),'OpenOrCreate','ReadWrite','None')
 try{Write-CLMJson (Join-Path $Root 'installation.json') $source;Save-CLMJournal $ctx 'restore-prepared';Write-CLMJson (Join-Path $Root 'maintenance-transaction.json') ([ordered]@{schemaVersion=1;selectedRoot=$Root;id=$ctx.id;journal=$ctx.journal});return Complete-CLMRestore $ctx}finally{$lease.Dispose()}
}
function Invoke-CLMAdapter($Ctx,[string]$Name,$Data=$null){if($Ctx.adapter){return & $Ctx.adapter $Name $Ctx $Data};return Invoke-CLMDefaultAdapter $Name $Ctx $Data}
function Save-CLMJournal($Ctx,[string]$Phase){$Ctx.phase=$Phase;$saved=@{};foreach($k in $Ctx.Keys){if($k -notin @('adapter','progress','sourceModule')){$saved[$k]=$Ctx[$k]}};Write-CLMJson $Ctx.journal $saved; if($Ctx.progress){& $Ctx.progress $Phase|Out-Null}}
function Get-CLMJournal([string]$Root){$Root=Assert-CLMPath $Root;$p=Join-Path $Root 'maintenance-transaction.json';if(-not (Test-Path -LiteralPath $p)){throw 'No maintenance journal for selected server'};$v=Read-CLMJson $p;if($v.schemaVersion -ne 1 -or $v.selectedRoot -cne $Root){throw 'Invalid maintenance journal pointer'};$j=Read-CLMJson $v.journal;if($j.schemaVersion -ne 1 -or $j.selectedRoot -cne $Root -or $j.id -cne $v.id -or $j.journal -cne $v.journal){throw 'Maintenance journal identity mismatch'};return $j}
function Complete-CLMUpdate($Ctx){
 # Commit intent is durable BEFORE any entry point/task or gate can expose candidate.
 Save-CLMJournal $Ctx 'commit-decided'
 Write-CLMJson (Join-Path $Ctx.selectedRoot 'active-generation.json') ([ordered]@{schemaVersion=1;selectedRoot=$Ctx.selectedRoot;activeRoot=$Ctx.candidateRoot;installationId=$Ctx.candidate.installationId;transactionId=$Ctx.id;entryPointHash=$Ctx.entryPointHash})
 Invoke-CLMAdapter $Ctx 'PublishEntryPoint'|Out-Null
 Invoke-CLMAdapter $Ctx 'PublishCandidateTask'|Out-Null
 Save-CLMJournal $Ctx 'gate-open-attempted';Invoke-CLMAdapter $Ctx 'GateOpen'|Out-Null
 Save-CLMJournal $Ctx 'committed';Invoke-CLMAdapter $Ctx 'CleanupSource'|Out-Null
 # Only positively owned transfer/marker payloads; directories and unknown files remain.
 foreach($p in @($Ctx.transfer,$Ctx.nativeHostStage,(Join-Path $Ctx.directory 'marker.stdin'))|Where-Object {$_}){if(Test-Path -LiteralPath $p){Remove-Item -LiteralPath (Assert-CLMPath $p) -Force}}
 Save-CLMJournal $Ctx 'completed';return $Ctx
}
function Read-CLMCandidateHostReceipt($Ctx){
 $root=Assert-CLMPath $Ctx.candidateRoot;$s=Read-CLMReceipt $root -AllowRemoved
 if($s.installationId -cne $Ctx.candidate.installationId -or $s.installationId -ceq $Ctx.source.installationId -or $s.distroName -cne $Ctx.candidate.distroName -or $s.releaseTag -cne $Ctx.candidate.releaseTag -or $s.rootfsSha256 -cne $Ctx.candidate.rootfsSha256 -or $Ctx.candidate.rootPath -cne $root){throw 'Candidate host identity differs; operation lease refused'}
 return $s
}
function Get-CLMCandidateLease($Ctx){
 if($Ctx.kind -cne 'update'){return $null}
 $root=Assert-CLMPath $Ctx.candidateRoot
 if(-not (Test-Path -LiteralPath $root)){
  if(Invoke-CLMAdapter $Ctx 'CandidateRegistered'){throw 'Registered candidate has no owned host root; manual inspection required'}
  return $null
 }
 try{$lease=[IO.File]::Open((Join-Path $root 'operation.lock'),'OpenOrCreate','ReadWrite','None')}catch{throw 'Candidate operation lock is owned by another control; recovery preserved'}
 try{
  $s=Read-CLMCandidateHostReceipt $Ctx
  if($s.phase -ceq 'removed' -and (Invoke-CLMAdapter $Ctx 'CandidateRegistered')){throw 'Retired candidate is registered; manual inspection required'}
  return $lease
 }catch{$lease.Dispose();throw}
}
function Retire-CLMDiscardedCandidate($Ctx){
 if(-not (Test-Path -LiteralPath $Ctx.candidateRoot)){return}
 # The caller holds candidate operation.lock. Never hide a registered, possibly unmarked import.
 if(Invoke-CLMAdapter $Ctx 'CandidateRegistered'){throw 'Candidate remains registered; manual inspection required'}
 $s=Read-CLMCandidateHostReceipt $Ctx
 if($s.phase -cne 'removed'){$s.phase='removed';Write-CLMJson (Join-Path $Ctx.candidateRoot 'installation.json') $s}
}
function Recover-CLMTransaction($Ctx){
 if($Ctx.phase -in @('completed','removed','rolled-back','restored')){if($Ctx.kind -ceq 'update' -and $Ctx.phase -ceq 'rolled-back'){Retire-CLMDiscardedCandidate $Ctx};return $Ctx}
 if($Ctx.kind -ceq 'update' -and $Ctx.phase -in @('commit-decided','gate-open-attempted','committed')){return Complete-CLMUpdate $Ctx}
 if($Ctx.kind -ceq 'remove'){return Complete-CLMRemove $Ctx}
 if($Ctx.kind -ceq 'restore'){return Complete-CLMRestore $Ctx}
 $hasCandidate=Invoke-CLMAdapter $Ctx 'CandidateOwned'
 if($hasCandidate){Save-CLMJournal $Ctx 'rollback-stop-candidate';Invoke-CLMAdapter $Ctx 'StopCandidate'|Out-Null;Invoke-CLMAdapter $Ctx 'GateClose'|Out-Null;Save-CLMJournal $Ctx 'rollback-release-firewall';Invoke-CLMAdapter $Ctx 'ReleaseStoppedFirewall'|Out-Null;Save-CLMJournal $Ctx 'rollback-terminate-candidate';Invoke-CLMAdapter $Ctx 'TerminateCandidate'|Out-Null;Save-CLMJournal $Ctx 'rollback-discard-candidate';Invoke-CLMAdapter $Ctx 'DiscardCandidate'|Out-Null}
 Retire-CLMDiscardedCandidate $Ctx
 Save-CLMJournal $Ctx 'rollback-source-receipt';$Ctx.source=Sync-CLMKeepaliveReceipt $Ctx.sourceRoot $Ctx.source $Ctx.sourceModule;Write-CLMJson (Join-Path $Ctx.sourceRoot 'installation.json') $Ctx.source
 Invoke-CLMAdapter $Ctx 'RestoreSourceTask'|Out-Null
 if($Ctx.source.desiredRunning){Invoke-CLMAdapter $Ctx 'ResumeSource'|Out-Null}
 Save-CLMJournal $Ctx 'rolled-back';return $Ctx
}
function Complete-CLMRemove($Ctx){
 if($Ctx.phase -notin @('bundle-validated','unregister-source','removed')){
  Save-CLMJournal $Ctx 'disable-source-task';Invoke-CLMAdapter $Ctx 'DisableSourceTask'|Out-Null
  Save-CLMJournal $Ctx 'close-source-panel';Invoke-CLMAdapter $Ctx 'CloseSourcePanel'|Out-Null
  Save-CLMJournal $Ctx 'stop-source';Invoke-CLMAdapter $Ctx 'StopSource'|Out-Null;Invoke-CLMAdapter $Ctx 'AssertSourceStopped'|Out-Null
 }
 if($Ctx.bundleDirectory -and $Ctx.phase -notin @('bundle-validated','unregister-source','removed')){
  Save-CLMJournal $Ctx 'export-bundle';Invoke-CLMAdapter $Ctx 'ExportBundle' $Ctx.bundleDirectory|Out-Null
  $p=Join-Path $Ctx.bundleDirectory 'distribution.tar';$b=[ordered]@{schemaVersion=1;kind='castlink-wsl-full-export';source=$Ctx.source;task=$Ctx.task;files=@([ordered]@{file='distribution.tar';sha256=(Get-CLMHash $p);size=(Get-Item $p).Length})+@($Ctx.bundleHelpers|Where-Object {$_})}
  Write-CLMJson (Join-Path $Ctx.bundleDirectory 'bundle.json') $b;$null=Read-CLMBundle $Ctx.bundleDirectory;$Ctx.bundleManifestHash=Get-CLMHash (Join-Path $Ctx.bundleDirectory 'bundle.json');Save-CLMJournal $Ctx 'bundle-validated'
 }
 if($Ctx.bundleDirectory){if((Get-CLMHash (Join-Path $Ctx.bundleDirectory 'bundle.json')) -cne $Ctx.bundleManifestHash){throw 'Validated removal bundle changed; source preserved'};$null=Read-CLMBundle $Ctx.bundleDirectory}
 Save-CLMJournal $Ctx 'unregister-source';Invoke-CLMAdapter $Ctx 'UnregisterSource'|Out-Null;Invoke-CLMAdapter $Ctx 'RemoveOwnedFiles'|Out-Null;$removed=Copy-CLMObject $Ctx.source;$removed.phase='removed';Write-CLMJson (Join-Path $Ctx.sourceRoot 'installation.json') $removed;Save-CLMJournal $Ctx 'removed';return $Ctx
}
function Invoke-CastlinkMaintenance {
 [CmdletBinding()]param([Parameter(Position=0)][ValidateSet('List','Check','Update','Remove','Restore','Recover')][string]$Action='List',[Parameter(Position=1)][string]$InstallRoot,[string]$TargetDirectory,[string]$ExpectedManifestSha256,[string]$Confirmation,[string]$BundleDirectory,[switch]$EraseData,[scriptblock]$Adapter,[scriptblock]$Progress)
 if($Action -ceq 'Remove' -and -not $BundleDirectory -and -not $EraseData){throw 'Choose an archive directory or explicit -EraseData'}
 if($Action -ceq 'Remove' -and $BundleDirectory -and $EraseData){throw 'Choose archive or erase, not both'}
 if($Action -ceq 'List'){return Get-CastlinkMaintenanceInstallations}
 if(-not $InstallRoot){throw 'Select an exact installation root'};$selected=Assert-CLMPath $InstallRoot
 if($Action -ceq 'Restore'){return Start-CLMRestore -Root $selected -BundleDirectory $BundleDirectory -Adapter $Adapter -Progress $Progress}
 if($Action -ceq 'Recover'){$old=Get-CLMJournal $selected;if($old.phase -in @('completed','removed','rolled-back','restored') -and -not ($old.kind -ceq 'update' -and $old.phase -ceq 'rolled-back' -and (Test-Path -LiteralPath $old.candidateRoot))){return $old};$root=$old.sourceRoot}else{$root=Get-CLMRoot $selected}
 $ctx=@{schemaVersion=1;selectedRoot=$selected;sourceRoot=$root;targetDirectory=$TargetDirectory;manifestSha256=$ExpectedManifestSha256;adapter=$Adapter;progress=$Progress;sourceModule=$null;stagingId=[guid]::NewGuid().ToString('N');recovery=($Action -ceq 'Recover')}
 $locks=New-Object Collections.Generic.List[IDisposable]
 try{
  if($Action -cne 'Check'){
   try{$locks.Add([IO.File]::Open((Join-Path $selected 'maintenance.lock'),'OpenOrCreate','ReadWrite','None'));$locks.Add([IO.File]::Open((Join-Path $root 'operation.lock'),'OpenOrCreate','ReadWrite','None'))}catch{throw 'Maintenance/operation lock is owned by another process'}
  }
  if($Action -ceq 'Recover' -and $old.kind -ceq 'restore'){$ctx.source=$old.source}else{$ctx.source=Invoke-CLMAdapter $ctx 'VerifySource'}
  if($Action -ceq 'Recover'){
   if($old.kind -cne 'restore' -and ($ctx.source.installationId -cne $old.source.installationId -or $ctx.source.releaseTag -cne $old.source.releaseTag -or $ctx.source.rootfsSha256 -cne $old.source.rootfsSha256)){throw 'Recovery source identity changed; preserved for manual inspection'}
   $module=$ctx.sourceModule;$ctx=@{};foreach($p in $old.PSObject.Properties){$ctx[$p.Name]=$p.Value};$ctx.adapter=$Adapter;$ctx.progress=$Progress;$ctx.sourceModule=$module
   $candidateLease=Get-CLMCandidateLease $ctx;if($candidateLease){$locks.Add($candidateLease)}
   return Recover-CLMTransaction $ctx
  }
  if($Action -ceq 'Update' -or $Action -ceq 'Remove'){
   if($Confirmation -cne $ctx.source.distroName){throw 'Exact server name confirmation required'}
   if(Test-Path -LiteralPath (Join-Path $selected 'maintenance-transaction.json')){$prior=Get-CLMJournal $selected;if($prior.phase -notin @('completed','removed','rolled-back','restored')){throw 'Pending maintenance transaction; Recover first'}}
  }
  if($Action -in @('Check','Update')){
   if(-not $TargetDirectory -or -not $ExpectedManifestSha256){throw 'Select an explicit target package and manifest SHA256; no Latest fallback'}
   if($ctx.progress){& $ctx.progress 'verify-package'|Out-Null};$ctx.target=Invoke-CLMAdapter $ctx 'VerifyTarget';if($ctx.source.phase -cne 'ready'){throw 'Source is incomplete; repair original release or Remove it'};$ctx.inspection=Invoke-CLMAdapter $ctx 'InspectSource'
   if(-not $ctx.inspection.initialized -or -not $ctx.inspection.complete -or $ctx.inspection.postgresMajor -ne 16){throw 'Source is incomplete or incompatible; repair its original release or Remove it'}
   $ctx.requiredBytes=[long]$ctx.target.rootfs.expandedBytes*2+[long]$ctx.inspection.dataBytes*3+2147483648L
   $ctx.freeBytes=Invoke-CLMAdapter $ctx 'FreeBytes';if($ctx.freeBytes -lt $ctx.requiredBytes){throw 'Insufficient disk space before maintenance'}
   if($Action -ceq 'Check'){return [pscustomobject]@{source=$ctx.source;target=$ctx.target;requiredBytes=$ctx.requiredBytes;freeBytes=$ctx.freeBytes;stagingId=$ctx.stagingId}}
  }
  $ctx.task=Invoke-CLMAdapter $ctx 'SourceTask';$ctx.id=$ctx.stagingId;$ctx.kind=$Action.ToLowerInvariant()
  $ctx.directory=Join-Path (Get-CLMStorageRoot $root) ('lifecycle-transactions\'+$ctx.id);if($Adapter){[void][IO.Directory]::CreateDirectory($ctx.directory)}else{Protect-CLMDirectory $ctx.directory}
  $ctx.journal=Join-Path $ctx.directory 'journal.json';$ctx.transfer=Join-Path $ctx.directory 'transfer.tar';$ctx.bundleDirectory=$BundleDirectory
  if($BundleDirectory){$BundleDirectory=Assert-CLMPath $BundleDirectory;$ctx.bundleDirectory=$BundleDirectory;if($BundleDirectory -ieq $root -or $BundleDirectory.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Bundle must be outside selected installation'};if(Test-Path -LiteralPath $BundleDirectory){throw 'Bundle destination must be new'};if($Adapter){[void][IO.Directory]::CreateDirectory($BundleDirectory)}else{Protect-CLMDirectory $BundleDirectory}}
  if($Action -ceq 'Update'){$cid=[guid]::NewGuid().ToString('N');$ctx.candidateRoot=Join-Path (Get-CLMStorageRoot $root) ('lifecycle-generations\'+$cid);$ctx.candidate=[pscustomobject]@{schemaVersion=1;installationId=$cid;distroName=('CastLink-Server-'+$cid.Substring(0,12));rootPath=$ctx.candidateRoot;releaseTag=$ctx.target.releaseTag;repository='resokol/castlink';rootfsSha256=$ctx.target.rootfs.sha256;releaseManifestSha256=$ctx.manifestSha256;phase='imported';logicalInstallationId=$(if($ctx.source.logicalInstallationId){$ctx.source.logicalInstallationId}else{$ctx.source.installationId});desiredRunning=[bool]$ctx.source.desiredRunning;autoStartAtLogon=[bool]$ctx.source.autoStartAtLogon}}
  if($ctx.candidate -and $ctx.source.PSObject.Properties['logonTaskMode']){$ctx.candidate|Add-Member NoteProperty logonTaskMode $ctx.source.logonTaskMode -Force}
  Invoke-CLMAdapter $ctx 'PreflightEntryPoint'|Out-Null
  Save-CLMJournal $ctx 'prepared';Write-CLMJson (Join-Path $selected 'maintenance-transaction.json') ([ordered]@{schemaVersion=1;selectedRoot=$selected;id=$ctx.id;journal=$ctx.journal})
  # Legacy RC rejects maintenance phase before Start/Install. Persist it under its own operation.lock.
  $maintenance=Copy-CLMObject $ctx.source;$maintenance.phase='maintenance';$maintenance|Add-Member NoteProperty maintenanceTransaction $ctx.id -Force;Write-CLMJson (Join-Path $root 'installation.json') $maintenance
  Save-CLMJournal $ctx 'disable-source-task';Invoke-CLMAdapter $ctx 'DisableSourceTask'|Out-Null
  Save-CLMJournal $ctx 'close-source-panel';Invoke-CLMAdapter $ctx 'CloseSourcePanel'|Out-Null
  Save-CLMJournal $ctx 'stop-source';Invoke-CLMAdapter $ctx 'StopSource'|Out-Null;Invoke-CLMAdapter $ctx 'AssertSourceStopped'|Out-Null
  if($Action -ceq 'Remove'){return Complete-CLMRemove $ctx}
  Save-CLMJournal $ctx 'export-transfer';Invoke-CLMAdapter $ctx 'ExportTransfer'|Out-Null
  Save-CLMJournal $ctx 'import-candidate';Invoke-CLMAdapter $ctx 'ImportCandidate'|Out-Null
  $candidateLease=Get-CLMCandidateLease $ctx;if($candidateLease){$locks.Add($candidateLease)}
  Save-CLMJournal $ctx 'mark-candidate';Invoke-CLMAdapter $ctx 'MarkCandidate'|Out-Null
  Save-CLMJournal $ctx 'gate-close';Invoke-CLMAdapter $ctx 'GateClose'|Out-Null
  Save-CLMJournal $ctx 'import-transfer';Invoke-CLMAdapter $ctx 'ImportTransfer'|Out-Null
  Save-CLMJournal $ctx 'start-candidate';Invoke-CLMAdapter $ctx 'StartCandidate'|Out-Null
  Save-CLMJournal $ctx 'candidate-readiness';$ctx.ready=Invoke-CLMAdapter $ctx 'CandidateReady'
  Save-CLMJournal $ctx 'prepare-bindings';$ctx.candidate=Invoke-CLMAdapter $ctx 'PrepareBindings'
  Invoke-CLMAdapter $ctx 'PrepareEntryPoint'|Out-Null
  if(-not $ctx.source.desiredRunning){Invoke-CLMAdapter $ctx 'StopCandidate'|Out-Null}
  return Complete-CLMUpdate $ctx
 }finally{foreach($l in $locks){$l.Dispose()}}
}
if(-not $FunctionsOnly -and $MyInvocation.InvocationName -ne '.'){$ErrorActionPreference='Stop';try{Invoke-CastlinkMaintenance -Action $Action -InstallRoot $InstallRoot -TargetDirectory $TargetDirectory -ExpectedManifestSha256 $ExpectedManifestSha256 -Confirmation $Confirmation -BundleDirectory $BundleDirectory -EraseData:$EraseData|Select-Object -Property * -ExcludeProperty adapter,progress,sourceModule}catch{Write-Error $_;exit 1}}
