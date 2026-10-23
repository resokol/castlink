'use strict';
const path=require('node:path'),fs=require('node:fs');
const {parseRemoteLaunch}=require('./remote-pc-protocol.cjs');
/** On-demand component only: no client launcher, account, setup or updater. */
function startScreenShare(electron,argv=process.argv){
 const {app}=electron,allowLoopback=argv.includes('--pptx-test-build')&&argv.includes('--remote-pc-allow-loopback-test');
 const link=argv.find(value=>typeof value==='string'&&/^castlink-share:/i.test(value));
 try{parseRemoteLaunch(link,{scheme:'castlink-share:',allowLoopback});}catch{app.quit();return;}
 const name=allowLoopback?'CastLink Screen Share Test':'CastLink Screen Share';
 app.setName(name);
 const profile=path.join(app.getPath('appData'),name);
 fs.mkdirSync(path.join(profile,'session'),{recursive:true});
 app.setPath('userData',profile);app.setPath('sessionData',path.join(profile,'session'));
 if(process.platform==='win32')app.setAppUserModelId(allowLoopback?'ru.castlink.screen-share.test':'ru.castlink.screen-share');
 if(!app.requestSingleInstanceLock()){app.quit();return;}
 return require('./remote-pc-helper.cjs').runRemotePcHelper({...electron,scheme:'castlink-share:',standalone:true,allowLoopback}).catch(()=>app.quit());
}
module.exports={startScreenShare};
if(require.main===module)startScreenShare(require('electron'));
