// Test-only broker seam: actual fixed controller and Worker catalogs remain intact.
// Synthetic win32/path/FS is a dispatch proof, never physical Windows readiness.
export async function load(url,context,nextLoad){
 const result=await nextLoad(url,context);if(url!==new URL('../../dist/windows-database-worker.js',import.meta.url).href)return result;
 let source=String(result.source);
 if(!source.includes("import { Worker } from 'node:worker_threads';")||!source.includes('async function runFixedWindowsTarget('))throw Error('current fixed target controller fixture seam changed');
 source=source.replace("import { Worker } from 'node:worker_threads';",`import {Worker as ActualWorker} from 'node:worker_threads';
class Worker extends ActualWorker {constructor(fixed,options){const f=globalThis.__windowsTargetRouteFixture;if(!f)throw Error('missing test fixture');f.requests.push({fixed,input:Buffer.from(options.workerData.input)});super("Object.defineProperty(process,'platform',{value:'win32'});Object.assign(require('node:path'),require('node:path').win32);"+(f.prefix??'')+fixed,{...options,execArgv:[]})}}`);
 const entry='async function runFixedWindowsTarget(input, family, provider) {';
 if(!source.includes(entry))throw Error('current fixed target entry seam changed');
 source=source.replace(entry,entry+"\n const fixture=globalThis.__windowsTargetRouteFixture;if(!fixture)throw Error('missing test fixture');fixture.families.push(family);provider=fixture.provider??provider;");
 return{...result,source};
}
