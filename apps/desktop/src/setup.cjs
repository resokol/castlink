'use strict';
const fs=require('node:fs'),path=require('node:path');
const {spawn:spawnProcess}=require('node:child_process');

// Only the local launcher may call this adapter. The existing wizard owns target
// selection, saved installation identity, permissions and destructive prompts.
function createSetupAdapter({resourcesPath,platform=process.platform,windowsDirectory=process.env.SystemRoot||'C:\\Windows',spawn=spawnProcess}){
  let active;
  return {
    async launch(action,locale='ru'){
      if(!['install','update','remove'].includes(action))throw Error('Invalid setup action');
      if(!['ru','en','zh-CN'].includes(locale))throw Error('Invalid setup language');
      if(platform!=='win32')throw Error('Setup requires Windows');
      if(active)throw Error('Setup wizard is already open');
      const directory=path.join(resourcesPath,'setup');
      const script=path.join(directory,'scripts','simple-easy-setup-gui.ps1');
      if(!fs.existsSync(script)||!fs.statSync(script).isFile())throw Error('Packaged setup wizard is unavailable');
      const executable=path.win32.join(windowsDirectory,'System32','WindowsPowerShell','v1.0','powershell.exe');
      const args=['-NoProfile','-STA','-WindowStyle','Hidden','-ExecutionPolicy','Bypass','-File',script,'-Action',action,'-Language',locale];
      return new Promise((resolve,reject)=>{
        let child;
        // Match the existing EasySetup host: Framework Console.InputEncoding
        // requires a real console for Docker workers. PowerShell's WindowStyle
        // hides it; CREATE_NO_WINDOW / DETACHED_PROCESS would remove it.
        try{child=spawn(executable,args,{cwd:directory,shell:false,stdio:'ignore',detached:false,windowsHide:false});}
        catch{reject(Error('Could not start setup wizard'));return;}
        active=child;
        const clear=()=>{if(active===child)active=undefined;};
        child.once('error',()=>{clear();reject(Error('Could not start setup wizard'));});
        child.once('exit',clear);
        child.once('spawn',()=>{
          child.unref();
          // Process launch is not evidence that installation/update/removal
          // completed. The WPF wizard displays its own result and errors.
          resolve({started:true});
        });
      });
    },
  };
}
module.exports={createSetupAdapter};
