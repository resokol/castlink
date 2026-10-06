// Execute the production physical predicate; Win32 replies are fixture metadata.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const source=fs.readFileSync(new URL('../../native/primary-launcher/windows.c',import.meta.url),'utf8');
const inspect=source.slice(source.indexOf('static int inspect('),source.indexOf('static int stable('));
const stable=source.slice(source.indexOf('static int stable('),source.indexOf('/* OS ancestry'));
assert.ok(inspect.startsWith('static int inspect(')&&stable.startsWith('static int stable('));
const add=source.slice(source.indexOf('static int add('),source.indexOf('static int ancestors('));
const verify=source.slice(source.indexOf('static int verify('),source.indexOf('/* Enumerate only'));
const c=String.raw`
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <wchar.h>
typedef uint32_t DWORD;typedef unsigned HANDLE;typedef wchar_t WCHAR;
typedef struct{DWORD dwHighDateTime,dwLowDateTime;} FILETIME;
typedef struct{DWORD dwFileAttributes,dwVolumeSerialNumber,nFileIndexHigh,nFileIndexLow,nNumberOfLinks,nFileSizeHigh,nFileSizeLow;FILETIME ftLastWriteTime;} BY_HANDLE_FILE_INFORMATION;
struct held{HANDLE handle;WCHAR path[64];int directory,system,inventory;BY_HANDLE_FILE_INFORMATION identity;};
#define CL_MAX_PATH 64
#define FILE_ATTRIBUTE_REPARSE_POINT 1024u
#define FILE_ATTRIBUTE_DIRECTORY 16u
#define FILE_NAME_NORMALIZED 0
#define VOLUME_NAME_DOS 0
static BY_HANDLE_FILE_INFORMATION reply;
static WCHAR image[CL_MAX_PATH]=L"D:\\preview\\castlink.exe",observed_path[CL_MAX_PATH];
static int metadata_ok,canonical_ok,matching,acl_ok,acl_calls,bad_prefix;
static DWORD canonical_length;
static int GetFileInformationByHandle(HANDLE h,BY_HANDLE_FILE_INFORMATION*out){(void)h;*out=reply;return metadata_ok;}
static DWORD GetFinalPathNameByHandleW(HANDLE h,WCHAR*out,DWORD cap,DWORD flags){(void)h;(void)cap;(void)flags;wcscpy(out,L"\\\\?\\");wcscat(out,observed_path);if(bad_prefix)out[0]=L'X';return canonical_ok?canonical_length:0;}
static int equal(const WCHAR*a,const WCHAR*b){return matching&&wcscmp(a,b)==0;}
static size_t length(const WCHAR*p){return wcslen(p);}
static int acl(HANDLE h,int system,int drive_root){(void)h;(void)system;(void)drive_root;acl_calls++;return acl_ok;}
${inspect}
${stable}
#define CL_MAX_GUARDS 4
#define INVALID_HANDLE_VALUE 0xffffffffu
static struct held held[CL_MAX_GUARDS];static unsigned held_count,init_phase,init_reason,init_index;
static int dos(const WCHAR*p){return p[0]&&p[1]==L':'&&p[2]==L'\\';}
static int copy(WCHAR*out,const WCHAR*in){if(wcslen(in)>=CL_MAX_PATH)return 0;wcscpy(out,in);return 1;}
${add}
struct cl_item{int unused;};static struct cl_item cl_files[1];static int hash_calls;
static int hashfile(struct held*p,const struct cl_item*i){(void)p;(void)i;hash_calls++;return 0;}
static int os_config(struct held*p){(void)p;return 1;}
${verify}
static struct held h;
static unsigned passed,failed;
static void reset(int system,DWORD links){memset(&h,0,sizeof(h));h.handle=1;h.system=system;h.inventory=system?-2:0;wcscpy(h.path,system?L"C:\\Windows\\powershell.exe":L"D:\\preview\\node.exe");wcscpy(observed_path,h.path);memset(&reply,0,sizeof(reply));reply.dwFileAttributes=32;reply.nNumberOfLinks=links;metadata_ok=canonical_ok=matching=acl_ok=1;acl_calls=bad_prefix=0;canonical_length=29;}
static void check(const char*name,int expected,int expected_acl){int result=inspect(&h);if(result==expected&&acl_calls==expected_acl)passed++;else{failed++;printf("FAIL %s result=%d acl=%d\n",name,result,acl_calls);}}
int main(void){
reset(1,1);check("stock OS single link",1,1);
reset(1,2);check("measured stock OS two links",1,1);
reset(1,3);check("OS servicing additional link",1,1);
reset(1,0);check("OS zero links invalid",0,0);
reset(0,1);check("private single link",1,0);
reset(0,2);check("private two links refused",0,0);
reset(0,3);check("private three links refused",0,0);
reset(0,0);check("private zero links refused",0,0);
reset(1,2);metadata_ok=0;check("metadata failure",0,0);
reset(1,2);reply.dwFileAttributes|=FILE_ATTRIBUTE_REPARSE_POINT;check("OS reparse",0,0);
reset(1,2);reply.dwFileAttributes|=FILE_ATTRIBUTE_DIRECTORY;check("OS kind mismatch",0,0);
reset(1,2);canonical_ok=0;check("canonical failure",0,0);
reset(1,2);bad_prefix=1;check("canonical prefix",0,0);
reset(1,2);canonical_length=CL_MAX_PATH+4;check("canonical bounds",0,0);
reset(1,2);matching=0;check("canonical mismatch",0,0);
reset(1,2);acl_ok=0;check("OS owner or DACL refusal still reached",0,1);
reset(0,1);acl_ok=0;check("ordinary inventory file writable ACL allowed",1,0);
reset(1,2);if(inspect(&h)&&h.identity.nNumberOfLinks==2&&stable(&h)){reply.nNumberOfLinks=3;if(!stable(&h))passed++;else failed++;}else failed++;
reset(1,2);h.directory=0;reply.dwFileAttributes=32;acl_ok=1;check("observed row 5 POWERSHELL",1,1);
reset(1,4);h.directory=0;reply.dwFileAttributes=32;acl_ok=1;check("observed row 8 MODULE_MANAGEMENT",1,1);
reset(1,4);h.directory=0;reply.dwFileAttributes=32;acl_ok=1;check("observed row 10 MODULE_UTILITY",1,1);
reset(1,4);h.directory=0;reply.dwFileAttributes=32;acl_ok=1;check("observed row 12 MODULE_SECURITY",1,1);
reset(1,4);h.directory=0;reply.dwFileAttributes=32;acl_ok=1;check("observed row 13 POWERSHELL_CONFIG",1,1);
reset(0,1);h.directory=1;reply.dwFileAttributes=22;acl_ok=0;check("observed row 19 PACKAGE_ANCESTOR",1,0);
reset(0,1);h.directory=1;reply.dwFileAttributes=16;acl_ok=0;check("observed row 20 PACKAGE_ANCESTOR",1,0);
reset(0,1);h.directory=1;reply.dwFileAttributes=16;acl_ok=0;check("observed row 21 PACKAGE_ANCESTOR",1,0);
reset(0,1);h.directory=1;reply.dwFileAttributes=16;acl_ok=0;check("observed row 22 PACKAGE_ANCESTOR",1,0);
reset(0,1);h.directory=1;reply.dwFileAttributes=16;acl_ok=0;check("observed row 23 PACKAGE_ANCESTOR",1,0);

reset(0,1);h.inventory=-1;wcscpy(h.path,image);wcscpy(observed_path,h.path);acl_ok=0;check("exact executing image ordinary ACL allowed",1,0);
reset(0,1);h.inventory=-1;acl_ok=0;check("nonself negative-index file ACL retained",0,1);
reset(0,1);h.inventory=-3;acl_ok=0;check("installed Docker or context file ACL retained",0,1);
reset(0,1);h.inventory=-3;check("installed file accepted after ACL",1,1);
reset(0,2);h.inventory=-3;check("installed Desktop additional link accepted",1,1);
reset(0,3);h.inventory=-7;check("measured installed Compose three links accepted",1,1);
reset(0,3);h.inventory=-4;check("installed Docker CLI additional links accepted",1,1);
reset(0,0);h.inventory=-3;check("installed Desktop zero links refused",0,0);
reset(0,0);h.inventory=-4;check("installed Docker zero links refused",0,0);
reset(0,0);h.inventory=-7;check("installed Compose zero links refused",0,0);
reset(0,3);h.inventory=-7;acl_ok=0;check("Compose ACL admission retained",0,1);
reset(0,3);h.inventory=-7;matching=0;check("Compose canonical mismatch refused",0,0);
reset(0,3);h.inventory=-7;reply.dwFileAttributes|=1024;check("Compose reparse refused",0,0);
reset(0,3);h.inventory=-7;reply.dwFileAttributes|=16;check("Compose file kind refused",0,0);
reset(0,2);h.inventory=-5;check("context config two links refused",0,0);
reset(0,2);h.inventory=-6;check("context metadata two links refused",0,0);
reset(0,2);h.inventory=-1;wcscpy(h.path,image);wcscpy(observed_path,h.path);check("initial image two links refused",0,0);
reset(0,3);h.inventory=-7;if(inspect(&h)&&stable(&h)){reply.nNumberOfLinks=4;if(!stable(&h))passed++;else failed++;}else failed++;
reset(0,3);h.inventory=-7;if(inspect(&h)&&stable(&h)){reply.nFileIndexLow++;if(!stable(&h))passed++;else failed++;}else failed++;
reset(0,3);h.inventory=-7;if(inspect(&h)&&stable(&h)){reply.ftLastWriteTime.dwLowDateTime++;if(!stable(&h))passed++;else failed++;}else failed++;
reset(0,1);h.directory=1;reply.dwFileAttributes=16;acl_ok=0;check("ordinary package interior writable directory",1,0);
reset(1,1);h.directory=1;reply.dwFileAttributes=16;acl_ok=0;check("OS directory writable ACL refused",0,1);
reset(0,1);h.directory=1;reply.dwFileAttributes=16|1024;acl_ok=0;check("ordinary directory reparse refused",0,0);
reset(0,1);h.directory=1;reply.dwFileAttributes=16;matching=0;check("ordinary directory canonical refused",0,0);
reset(0,1);matching=0;check("inventory canonical refused",0,0);
reset(0,1);reply.dwFileAttributes|=1024;check("inventory reparse refused",0,0);
reset(0,1);if(inspect(&h)&&stable(&h)){reply.nFileIndexLow++;if(!stable(&h))passed++;else failed++;}else failed++;

held_count=0;if(add(L"D:\\preview\\context.json",0,-5,0)&&!add(L"D:\\preview\\context.json",0,-7,0)&&held[0].inventory==-5)passed++;else failed++;
held_count=0;if(add(L"D:\\preview\\docker.exe",0,-3,0)&&!add(L"D:\\preview\\docker.exe",0,-1,0)&&held[0].inventory==-3)passed++;else failed++;
reset(0,1);if(inspect(&h)){held[0]=h;hash_calls=0;if(!verify(0,0)&&hash_calls==1)passed++;else failed++;}else failed++;
printf("production physical cases: %u PASS / %u FAIL\n",passed,failed);return failed?1:0;}
`;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-os-file-inspect-'));
try{const input=path.join(dir,'proof.c'),binary=path.join(dir,'proof');fs.writeFileSync(input,c,{mode:0o600});const build=spawnSync('cc',['-std=c11','-Wall','-Wextra','-Werror',input,'-o',binary],{encoding:'utf8',timeout:20000,maxBuffer:65536});assert.equal(build.status,0,build.stderr);const proof=spawnSync(binary,[],{encoding:'utf8',timeout:5000,maxBuffer:65536});process.stdout.write(proof.stdout);assert.equal(proof.status,0,proof.stderr);}finally{fs.rmSync(dir,{recursive:true,force:true});}
