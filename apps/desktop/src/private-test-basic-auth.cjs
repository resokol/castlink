'use strict';
const fs=require('node:fs'),path=require('node:path');
// Private deployment sidecar only. Never expose credentials to a renderer or log.
function readPrivateTestAuth(file){
  if(typeof file!=='string'||!path.isAbsolute(file))return null;
  let fd;
  try{
    fd=fs.openSync(file,'r');
    const stat=fs.fstatSync(fd);
    if(!stat.isFile()||stat.size<1||stat.size>4096)return null;
    const bytes=Buffer.alloc(4097),size=fs.readSync(fd,bytes,0,bytes.length,0);
    if(size!==stat.size||size>4096)return null;
    const value=JSON.parse(bytes.subarray(0,size).toString('utf8'));
    if(!value||Array.isArray(value)||Object.keys(value).sort().join(',')!=='origin,password,username')return null;
    const {origin,username,password}=value;
    if(typeof origin!=='string'||origin.length>2048||typeof username!=='string'||!username||username.length>128||
       typeof password!=='string'||!password||password.length>1024||/[\x00-\x1f\x7f-\x9f]/.test(origin+username+password)||username.includes(':'))return null;
    const url=new URL(origin);
    if(url.protocol!=='https:'||url.origin!==origin||url.username||url.password)return null;
    return Object.freeze({origin,username,password});
  }catch{return null;}
  finally{if(fd!==undefined)fs.closeSync(fd);}
}
function installPrivateTestAuth({app,enabled,file,getClient,getOrigin}){
  if(enabled!==true)return()=>{};
  const config=readPrivateTestAuth(file);
  if(!config)return()=>{};
  const attempted=new WeakSet();
  const login=(event,contents,details,authInfo,callback)=>{
    event.preventDefault();
    let allowed=false;
    try{
      const owner=getClient(),url=new URL(details.url),configured=new URL(config.origin);
      allowed=!!owner&&!owner.isDestroyed()&&contents===owner.webContents&&!contents.isDestroyed()&&
        getOrigin()===config.origin&&url.origin===config.origin&&!url.username&&!url.password&&
        authInfo.isProxy===false&&typeof authInfo.scheme==='string'&&authInfo.scheme.toLowerCase()==='basic'&&
        authInfo.host===configured.hostname&&authInfo.port===Number(configured.port||443)&&!attempted.has(contents);
    }catch{}
    if(!allowed){callback();return;}
    attempted.add(contents); // A rejected credential must never trigger another attempt.
    callback(config.username,config.password);
  };
  app.on('login',login);
  return()=>app.removeListener('login',login);
}
module.exports={readPrivateTestAuth,installPrivateTestAuth};
