// Execute the exact production stable() predicate with Win32 metadata fixtures.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
const source=fs.readFileSync(new URL('../../native/primary-launcher/windows.c',import.meta.url),'utf8');
const stable=source.slice(source.indexOf('static int stable('),source.indexOf('/* OS ancestry'));
assert.ok(stable.startsWith('static int stable('));
const scratch=source.slice(source.indexOf('int cl_worker_scratch_create('),source.indexOf('void cl_worker_scratch_close('));
assert.match(scratch,/candidate\[n-1\]=0/);assert.match(scratch,/CreateDirectoryW\(candidate,&sa\)/);
// The fixed worker creates a sibling below the package's registered parent.
const root='D:\\profiles\\proof\\package',parent=path.win32.dirname(root);
assert.equal(parent,'D:\\profiles\\proof');assert.ok(source.includes('ancestors(image,0)'));
const c=String.raw`
#include <stdint.h>
#include <stdio.h>
#include <string.h>
typedef uint32_t DWORD;typedef unsigned HANDLE;
typedef struct{DWORD dwHighDateTime,dwLowDateTime;} FILETIME;
typedef struct{DWORD dwFileAttributes,dwVolumeSerialNumber,nFileIndexHigh,nFileIndexLow,nNumberOfLinks,nFileSizeHigh,nFileSizeLow;FILETIME ftLastWriteTime;} BY_HANDLE_FILE_INFORMATION;
struct held{HANDLE handle;int directory;BY_HANDLE_FILE_INFORMATION identity;};
static BY_HANDLE_FILE_INFORMATION reply;static int metadata_ok=1;
static int GetFileInformationByHandle(HANDLE h,BY_HANDLE_FILE_INFORMATION*out){(void)h;*out=reply;return metadata_ok;}
${stable}
static struct held h;static unsigned passed,failed;
static void reset(int directory){memset(&h,0,sizeof(h));h.handle=1;h.directory=directory;h.identity.dwFileAttributes=directory?16:32;h.identity.dwVolumeSerialNumber=4;h.identity.nFileIndexLow=7;h.identity.nNumberOfLinks=1;h.identity.nFileSizeLow=8;h.identity.ftLastWriteTime.dwLowDateTime=9;reply=h.identity;metadata_ok=1;}
static void check(const char*name,int expected){int got=stable(&h);if(got==expected)passed++;else{failed++;printf("FAIL %s expected=%d actual=%d\n",name,expected,got);}}
int main(void){int d;
reset(1);reply.ftLastWriteTime.dwLowDateTime++;check("registered parent changed by own scratch creation",1);
reset(1);reply.ftLastWriteTime.dwHighDateTime++;check("directory timestamp high",1);
reset(1);reply.nFileSizeLow++;check("directory volatile size low",1);
reset(1);reply.nFileSizeHigh++;check("directory volatile size high",1);
for(d=0;d<2;d++){
 reset(d);check("unchanged identity",1);
 reset(d);metadata_ok=0;check("metadata failure",0);
 reset(d);reply.dwFileAttributes^=1;check("attributes changed",0);
 reset(d);reply.dwVolumeSerialNumber++;check("volume changed",0);
 reset(d);reply.nFileIndexHigh++;check("file index high changed",0);
 reset(d);reply.nFileIndexLow++;check("file index low changed",0);
 reset(d);reply.nNumberOfLinks++;check("link count changed",0);
}
reset(0);reply.ftLastWriteTime.dwLowDateTime++;check("file timestamp low refused",0);
reset(0);reply.ftLastWriteTime.dwHighDateTime++;check("file timestamp high refused",0);
reset(0);reply.nFileSizeLow++;check("file size low refused",0);
reset(0);reply.nFileSizeHigh++;check("file size high refused",0);
printf("production directory stability: %u PASS / %u FAIL\n",passed,failed);return failed?1:0;
}`;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-directory-stable-'));
try{const file=path.join(dir,'proof.c'),exe=path.join(dir,'proof');fs.writeFileSync(file,c,{mode:0o600});const build=spawnSync('cc',['-std=c11','-Wall','-Wextra','-Werror',file,'-o',exe],{encoding:'utf8',timeout:20000,maxBuffer:65536});assert.equal(build.status,0,build.stderr);const run=spawnSync(exe,[],{encoding:'utf8',timeout:5000,maxBuffer:65536});process.stdout.write(run.stdout);assert.equal(run.status,0,run.stderr);}finally{fs.rmSync(dir,{recursive:true,force:true});}
