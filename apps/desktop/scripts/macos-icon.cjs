'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {createRequire}=require('node:module');
const {execFileSync}=require('node:child_process');
const {isDeepStrictEqual}=require('node:util');
const CASTLINK_ICON_SOURCE='apps/desktop/assets/castlink-icon.svg';
const CONVERTER='electron-builder@26.15.3/icons@1.1.0';
const ICNS_ENTRIES=Object.freeze({icp4:16,icp5:32,icp6:64,ic07:128,ic08:256,ic09:512,ic10:1024,ic11:32,ic12:64,ic13:512,ic14:1024});
const PNG_MAGIC=Buffer.from([137,80,78,71,13,10,26,10]);
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function regular(file){if(!fs.lstatSync(file).isFile())throw Error('CastLink icon resource must be a regular file');}
function validateIcns(bytes){
 if(bytes.length<8||bytes.length>4*1024*1024||bytes.toString('ascii',0,4)!=='icns'||bytes.readUInt32BE(4)!==bytes.length)throw Error('Invalid CastLink ICNS header');
 const types=new Set();let offset=8;
 while(offset<bytes.length){
  if(offset+8>bytes.length)throw Error('Truncated CastLink ICNS entry');
  const type=bytes.toString('ascii',offset,offset+4),length=bytes.readUInt32BE(offset+4),size=ICNS_ENTRIES[type];
  if(!Object.hasOwn(ICNS_ENTRIES,type)||types.has(type)||length<8||offset+length>bytes.length)throw Error('Invalid CastLink ICNS entry');
  const png=bytes.subarray(offset+8,offset+length);
  if(png.length<45||!png.subarray(0,8).equals(PNG_MAGIC)||png.readUInt32BE(8)!==13||png.toString('ascii',12,16)!=='IHDR'||png.readUInt32BE(16)!==size||png.readUInt32BE(20)!==size)throw Error('CastLink ICNS PNG dimensions do not match '+type);
  let pngOffset=8,ended=false,data=false;
  while(pngOffset+12<=png.length){
   const chunkLength=png.readUInt32BE(pngOffset),chunkType=png.toString('ascii',pngOffset+4,pngOffset+8);
   if(pngOffset+12+chunkLength>png.length)throw Error('Truncated CastLink icon PNG');
   if(chunkType==='IDAT'&&chunkLength>0)data=true;
   pngOffset+=12+chunkLength;
   if(chunkType==='IEND'){if(chunkLength!==0||pngOffset!==png.length)throw Error('Invalid CastLink icon PNG end');ended=true;break;}
  }
  if(!ended||!data)throw Error('Incomplete CastLink icon PNG');
  types.add(type);offset+=length;
 }
 if(types.size!==Object.keys(ICNS_ENTRIES).length)throw Error('CastLink ICNS must include every standard and Retina size through 1024 pixels');
 return [...new Set(Object.values(ICNS_ENTRIES))].sort((a,b)=>a-b);
}
function loadConverter(root){
 const desktop=createRequire(path.join(root,'apps/desktop/package.json'));
 if(desktop('electron-builder/package.json').version!=='26.15.3')throw Error('Pinned electron-builder 26.15.3 required for CastLink icon conversion');
 const builder=createRequire(desktop.resolve('electron-builder/package.json'));
 // Builder's icons@1.1.0 WASM tool is checksum-pinned by this exact dependency;
 // it rasterizes the SVG at 1024px, then derives the smaller Retina variants.
 return builder('app-builder-lib/out/util/iconConverter.js').convertIcon;
}
async function stageMacIcon({root,destination,convertIcon}={}){
 if(typeof root!=='string'||!path.isAbsolute(root)||typeof destination!=='string'||!path.isAbsolute(destination))throw Error('Absolute source and icon destination paths required');
 const source=path.join(root,CASTLINK_ICON_SOURCE);regular(source);
 const sourceBytes=fs.readFileSync(source);if(sourceBytes.length>65536||!sourceBytes.toString('utf8').includes('viewBox="0 0 320 320"'))throw Error('Expected CastLink vector icon source');
 if(fs.existsSync(destination)&&(!fs.lstatSync(destination).isDirectory()||fs.readdirSync(destination).length))throw Error('CastLink icon destination must be empty');
 fs.mkdirSync(destination,{recursive:true});const work=fs.mkdtempSync(path.join(destination,'.convert-'));
 try{
  const converted=await (convertIcon||loadConverter(root))({sources:[source],fallbackSources:[],roots:[],format:'icns',outDir:work});
  if(converted?.isFallback!==false||converted.icons?.length!==1||converted.icons[0].size!==1024)throw Error('CastLink SVG icon conversion fell back or omitted the full vector resolution');
  const generated=converted.icons[0].file;regular(generated);
  if(!fs.realpathSync(generated).startsWith(fs.realpathSync(work)+path.sep))throw Error('CastLink icon converter returned an external file');
  const bytes=fs.readFileSync(generated),sizes=validateIcns(bytes),icon=path.join(destination,'castlink-icon.icns');
  const manifest={schemaVersion:1,source:CASTLINK_ICON_SOURCE,sourceSha256:hash(sourceBytes),sha256:hash(bytes),format:'icns',converter:CONVERTER,sizes};
  fs.renameSync(generated,icon);fs.writeFileSync(path.join(destination,'castlink-icon.json'),JSON.stringify(manifest,null,2)+'\n');
  return icon;
 }finally{fs.rmSync(work,{recursive:true,force:true});}
}
async function verifyMacBundleIcon({bundle,run=execFileSync}={}){
 if(typeof bundle!=='string'||!path.isAbsolute(bundle))throw Error('Absolute macOS bundle required for icon verification');
 const resources=path.join(bundle,'Contents/Resources'),plist=path.join(bundle,'Contents/Info.plist');regular(plist);
 const name=String(await run('/usr/libexec/PlistBuddy',['-c','Print :CFBundleIconFile',plist],{encoding:'utf8',shell:false,timeout:5000,maxBuffer:65536,killSignal:'SIGKILL'})).trim();
 if(!['icon.icns','icon'].includes(name))throw Error('Packaged CastLink icon is not configured in Info.plist');
 const icon=path.join(resources,'icon.icns'),manifestFile=path.join(resources,'castlink-icon.json');regular(icon);regular(manifestFile);
 const bytes=fs.readFileSync(icon),sizes=validateIcns(bytes),source=path.resolve(__dirname,'../assets/castlink-icon.svg');regular(source);
 const expected={schemaVersion:1,source:CASTLINK_ICON_SOURCE,sourceSha256:hash(fs.readFileSync(source)),sha256:hash(bytes),format:'icns',converter:CONVERTER,sizes};
 if(!isDeepStrictEqual(JSON.parse(fs.readFileSync(manifestFile,'utf8')),expected))throw Error('Packaged CastLink icon source or artifact hash does not match its provenance manifest');
 return {status:'PASS',sourceSha256:expected.sourceSha256,sha256:expected.sha256,sizes};
}
module.exports={CASTLINK_ICON_SOURCE,ICNS_ENTRIES,stageMacIcon,validateIcns,verifyMacBundleIcon};
