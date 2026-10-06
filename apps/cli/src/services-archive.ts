// Fixed bounded Caddy archive parser; bytes never leave the target helper.
export const nodeServiceCaddyArchive=String.raw`
function startCaddyDigest(b){
 let pos=0,body,ended=false,pax=false;
 const field=(h,a,n)=>h.subarray(a,a+n).toString('ascii').replace(/\0.*$/s,'');
 const oct=(h,a,n)=>{const v=field(h,a,n).trim();if(!/^[0-7]+$/.test(v))startFail();return parseInt(v,8)};
 while(pos+512<=b.length){const h=b.subarray(pos,pos+512);pos+=512;if(h.every(v=>v===0)){if(b.length-pos<512||!b.subarray(pos).every(v=>v===0))startFail();ended=true;break}
 let sum=0;for(let i=0;i<512;i++)sum+=i>=148&&i<156?32:h[i];if(h.some(v=>v>127)||sum!==oct(h,148,8)||field(h,257,6)!=='ustar'||field(h,345,155)!=='')startFail();const size=oct(h,124,12),kind=field(h,156,1),name=field(h,0,100);if(size>65536||pos+Math.ceil(size/512)*512>b.length)startFail();const bytes=b.subarray(pos,pos+size);if(!b.subarray(pos+size,pos+Math.ceil(size/512)*512).every(v=>v===0))startFail();pos+=Math.ceil(size/512)*512;
 if(kind==='x'){if(pax||body)startFail();pax=true;let at=0;while(at<bytes.length){const space=bytes.indexOf(32,at),length=Number(bytes.subarray(at,space).toString());if(space<at||!Number.isInteger(length)||length<5||at+length>bytes.length||bytes[at+length-1]!==10)startFail();const record=bytes.subarray(space+1,at+length-1).toString(),eq=record.indexOf('='),key=record.slice(0,eq),value=record.slice(eq+1);if(eq<1||!['path','mtime','atime','ctime'].includes(key)||(key==='path'?value!=='Caddyfile':!/^\d+(\.\d+)?$/.test(value)))startFail();at+=length}continue}
 if(!['','0'].includes(kind)||name!=='Caddyfile'||body||size===0||oct(h,100,8)!==292||field(h,157,100)!=='')startFail();body=bytes;
 }
 if(!ended||!body)startFail();return leaseCrypto.createHash('sha256').update(body).digest('hex');
}
`;
