import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
export function preflight({platform,arch,expectedArch,translated}) {
 if(platform!=='darwin'||!['arm64','x64'].includes(expectedArch)||arch!==expectedArch||translated!==false)throw Error('A native macOS runner of the requested architecture is required');
 return {platform,arch};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const read=(cmd,args)=>execFileSync(cmd,args,{encoding:'utf8'}).trim();
 let translated=false;
 // sysctl.proc_translated is absent on Intel; all other errors fail closed.
 if(process.platform==='darwin'){
   try{translated=read('/usr/sbin/sysctl',['-in','sysctl.proc_translated'])==='1';}
   catch(e){if(!String(e.stderr).includes('unknown oid'))throw e;}
 }
 const result=preflight({platform:process.platform,arch:process.arch,expectedArch:process.argv[2],translated});
 console.log(JSON.stringify({...result,node:process.version,macOS:read('/usr/bin/sw_vers',['-productVersion']),sdk:read('/usr/bin/xcrun',['--show-sdk-version']),xcode:read('/usr/bin/xcodebuild',['-version']),swift:read('/usr/bin/xcrun',['swiftc','--version'])},null,2));
}
