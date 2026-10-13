// Execute the real limiter inside route unit tests; only the log sink is stubbed.
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path"),ts=require("typescript");
const holder={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,"../../lib/rate-limit.ts"),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:holder,exports:holder.exports,require:name=>{if(name==="./server-log")return {serverLog(){}};throw Error(name);},Date,console});
module.exports=holder.exports;
