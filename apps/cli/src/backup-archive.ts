import {CliError} from './types.js';
const limit=64*1024*1024;
const failure=()=>new CliError('Cold backup scope, identity, private files or content cannot be verified; diagnose retained private partial files before retry using a new output directory.',4);
export function validateBackupArchive(b:Buffer):void{
 if(b.length>limit||b.length<1024||b.length%512)throw failure();let pos=0,ended=false,paxPath:string|undefined;const seen=new Set<string>();
 const field=(h:Buffer,a:number,n:number)=>h.subarray(a,a+n).toString('ascii').replace(/\0.*$/s,'');
 const oct=(h:Buffer,a:number,n:number)=>{const s=field(h,a,n).trim();if(!/^[0-7]+$/.test(s))throw failure();return parseInt(s,8);};
 while(pos+512<=b.length){const h=b.subarray(pos,pos+512);pos+=512;if(h.every(x=>x===0)){if(b.length-pos<512||!b.subarray(pos).every(x=>x===0)||paxPath)throw failure();ended=true;break;}let sum=0;for(let i=0;i<512;i++)sum+=i>=148&&i<156?32:h[i]!;if(h.some(x=>x>127)||sum!==oct(h,148,8)||field(h,257,6)!=='ustar')throw failure();const n=oct(h,124,12),type=field(h,156,1);if(n>limit||pos+Math.ceil(n/512)*512>b.length)throw failure();const body=b.subarray(pos,pos+n);if(!b.subarray(pos+n,pos+Math.ceil(n/512)*512).every(x=>x===0))throw failure();pos+=Math.ceil(n/512)*512;
 if(type==='x'){if(paxPath!==undefined)throw failure();let offset=0;while(offset<body.length){const space=body.indexOf(32,offset),size=Number(body.subarray(offset,space).toString());if(space<offset||!Number.isInteger(size)||size<5||offset+size>body.length||body[offset+size-1]!==10)throw failure();const line=body.subarray(space+1,offset+size-1).toString('utf8'),eq=line.indexOf('='),key=line.slice(0,eq),value=line.slice(eq+1);if(!['path','mtime','atime','ctime'].includes(key)||key==='path'&&paxPath!==undefined||key!=='path'&&!/^\d+(\.\d+)?$/.test(value))throw failure();if(key==='path')paxPath=value;offset+=size;}continue;}
 const prefix=field(h,345,155);let name=paxPath??(prefix?prefix+'/':'')+field(h,0,100);paxPath=undefined;name=name.replace(/^\.\//,'').replace(/\/$/,'');if(name==='.')name='';if(name&&(/^[\/\\]/.test(name)||/[\\\x00-\x1f\x7f]/.test(name)||name.split('/').some(x=>!x||x==='.'||x==='..')||Buffer.byteLength(name)>1024)||!['','0','5'].includes(type)||field(h,157,100)!==''||type==='5'&&n!==0||type!=='5'&&!name||seen.has(name)||seen.size>=10000)throw failure();seen.add(name);
 }if(!ended)throw failure();
}
