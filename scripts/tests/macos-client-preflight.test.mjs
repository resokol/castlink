import test from 'node:test';
import assert from 'node:assert/strict';
import { preflight } from '../macos-client-preflight.mjs';
for (const arch of ['arm64','x64']) test(`accept native ${arch}`,()=>assert.deepEqual(preflight({platform:'darwin',arch,expectedArch:arch,translated:false}),{platform:'darwin',arch}));
test('reject other OS, architecture mismatch and emulation',()=>{
 for(const change of [{platform:'linux'},{arch:'x64'},{expectedArch:'ia32'},{translated:true}])assert.throws(()=>preflight({platform:'darwin',arch:'arm64',expectedArch:'arm64',translated:false,...change}));
});
test('require explicit expected architecture',()=>assert.throws(()=>preflight({platform:'darwin',arch:'arm64',translated:false})));
