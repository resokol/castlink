import test from 'node:test';
import assert from 'node:assert/strict';
import {profileRoot} from '../dist/profile.js';
test('default profile root preserves platform defaults',()=>{
 assert.equal(profileRoot({},'win32','C:\\Users\\Operator'),'C:\\Users\\Operator\\AppData\\Local\\CastLink\\profiles');
 assert.equal(profileRoot({LOCALAPPDATA:'C:\\Local'},'win32','C:\\Users\\Operator'),'C:\\Local\\CastLink\\profiles');
 assert.equal(profileRoot({},'darwin','/Users/operator'),'/Users/operator/Library/Application Support/CastLink/profiles');
});
test('app-specific override accepts absolute Windows Unicode spaces and POSIX paths',()=>{
 assert.equal(profileRoot({CASTLINK_PROFILE_ROOT:'D:\\GitHub\\SL\\studiolink\\Личные профили'},'win32','C:\\Users\\Operator'),'D:\\GitHub\\SL\\studiolink\\Личные профили');
 assert.equal(profileRoot({CASTLINK_PROFILE_ROOT:'/private/Operator profiles'},'darwin','/Users/operator'),'/private/Operator profiles');
});
test('invalid overrides fail with a fixed error without echoing input',()=>{
 for(const value of ['', 'relative-secret', 'D:relative-secret', '\\relative-secret', 'C:\\secret\\..\\profiles','C:\\secret\npath','C:\\','/']) {
  assert.throws(()=>profileRoot({CASTLINK_PROFILE_ROOT:value},value.startsWith('/')?'darwin':'win32','unused'),error=>error.name==='CliError'&&error.message==='CASTLINK_PROFILE_ROOT must be an absolute private directory path.');
 }
});

test('native CLI entry rejects malformed profile override with fixed exit 2',async()=>{
 const {spawnSync}=await import('node:child_process');
 const entry=new URL('../dist/main.js',import.meta.url);
 const result=spawnSync(process.execPath,[entry.pathname,'status','--json'],{encoding:'utf8',env:{...process.env,CASTLINK_PROFILE_ROOT:'relative_PRIVATE_FIXTURE'}});
 assert.equal(result.status,2);
 assert.equal((result.stdout+result.stderr).includes('relative_PRIVATE_FIXTURE'),false);
 assert.match(result.stdout+result.stderr,/CASTLINK_PROFILE_ROOT must be an absolute private directory path\./);
});
