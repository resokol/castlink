'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function stageUpdaterResources(root,destination){
 const source=path.join(root,'scripts/updater/castlink-updater.ps1'),info=fs.lstatSync(source);
 if(!info.isFile()||info.isSymbolicLink()||info.nlink!==1||info.size<=3||info.size>4*1024*1024)throw Error('Invalid updater bootstrap file');
 const bytes=fs.readFileSync(source);
 if(!bytes.subarray(0,3).equals(Buffer.from([0xef,0xbb,0xbf])))throw Error('Windows PowerShell bootstrap requires UTF-8 BOM');
 const directory=path.join(destination,'updater');fs.mkdirSync(directory,{recursive:true});
 const file=path.join(directory,'castlink-updater.ps1');fs.writeFileSync(file,bytes,{flag:'wx'});
 return {file,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
}
module.exports={stageUpdaterResources};
