const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {JsonRoomStoreBackend}=require('../lib/room-store.ts');const root=fs.mkdtempSync(path.join(os.tmpdir(),'media-revision-'));
require('./media-room-revision-contract.cjs')(new JsonRoomStoreBackend(()=>path.join(root,'rooms.json'))).catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>fs.rmSync(root,{recursive:true,force:true}));
