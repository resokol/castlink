import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';

// These arguments are constructed only from bundled programs; stdin remains data.
const sourceLimit=1024*1024;
function quoteWindows(value:string):string {
 return '"'+value.replace(/(\\*)"/g,'$1$1\\"').replace(/(\\+)$/,'$1$1')+'"';
}
export function windowsCommandLineLength(executable:string,args:readonly string[]):number {
 return [executable,...args].map(quoteWindows).join(' ').length+1;
}
export function fixedNodeArguments(source:string,windows=process.platform==='win32',executable=process.execPath):string[] {
 if(!windows)return ['-e',source];
 const bytes=Buffer.from(source,'utf8');
 if(bytes.length===0||bytes.length>sourceLimit||bytes.toString('utf8')!==source)throw Error('Fixed bundled Node program exceeds its bound.');
 const packed=gzipSync(bytes,{level:9}).toString('base64');
 const digest=createHash('sha256').update(bytes).digest('hex');
 const loader=`let fixedSource;try{const b=require('node:zlib').gunzipSync(Buffer.from('${packed}','base64'),{maxOutputLength:${sourceLimit}});if(b.length!==${bytes.length}||require('node:crypto').createHash('sha256').update(b).digest('hex')!=='${digest}')throw Error();fixedSource=b.toString('utf8');if(!Buffer.from(fixedSource,'utf8').equals(b))throw Error();}catch{process.stderr.write('Fixed bundled Node program verification failed.\\n');process.exit(4);}require('node:vm').runInThisContext(fixedSource,{filename:'castlink-fixed-node.cjs'});`;
 const args=['-e',loader];
 if(windowsCommandLineLength(executable,args)>32767)throw Error('Fixed bundled Node program exceeds the Windows launch bound.');
 return args;
}
