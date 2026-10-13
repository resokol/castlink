import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';import {spawnSync} from 'node:child_process';import path from 'node:path';import os from 'node:os';import {fileURLToPath} from 'node:url';
const native=fileURLToPath(new URL('../native/primary-launcher/',import.meta.url));
async function run(source,units){const dir=await mkdtemp(path.join(os.tmpdir(),'castlink-managed-kernel-'));try{await writeFile(path.join(dir,'proof.c'),source);const result=spawnSync('/usr/bin/cc',['-std=c11','-fshort-wchar','-Wall','-Wextra','-Werror','-I',native,path.join(dir,'proof.c'),...units.map(n=>path.join(native,n+'.c')),'-o',path.join(dir,'proof')],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);const proof=spawnSync(path.join(dir,'proof'),[],{encoding:'utf8'});assert.equal(proof.status,0,proof.stderr);}finally{await rm(dir,{recursive:true,force:true});}}
test('actual C loader binds exact size/hash to bounded bytes and escapes path before script',()=>run(String.raw`#include <assert.h>
#include <wchar.h>
#include "managed.h"
static uint16_t out[CL_MAX_COMMAND];
static int contains(const char*s){unsigned i,j;for(i=0;out[i];i++){for(j=0;s[j]&&out[i+j]==(unsigned char)s[j];j++);if(!s[j])return 1;}return 0;}
int main(void){unsigned char hash[32]={0};hash[31]=255;assert(cl_managed_prefix(out,CL_MAX_COMMAND,(const uint16_t*)L"D:\\CastLink's\\managed\\CastLink.Native.Workers.dll",123,hash,(const uint16_t*)L"[Console]::Write('{}')"));assert(contains("D:\\CastLink''s\\managed"));assert(contains("$clFile.Length -ne 123"));assert(contains("00000000000000000000000000000000000000000000000000000000000000ff"));assert(contains("[Reflection.Assembly]::Load($clBytes)"));assert(!contains("LoadFrom"));assert(contains("$clFile.ReadByte() -ne -1"));assert(!cl_managed_prefix(out,CL_MAX_COMMAND,(const uint16_t*)L"relative.dll",123,hash,(const uint16_t*)L""));assert(!cl_managed_prefix(out,CL_MAX_COMMAND,(const uint16_t*)L"D:\\x",1048577,hash,(const uint16_t*)L""));assert(!cl_managed_prefix(out,64,(const uint16_t*)L"D:\\x",1,hash,(const uint16_t*)L""));return 0;}`,['managed']));
test('actual C worker environment strips channel/profiler/PATH and fixes both scratch fields',()=>run(String.raw`#include <assert.h>
#include <wchar.h>
#include "core.h"
static uint16_t out[5000];
static int field(const char*s){unsigned i=0,j;while(out[i]){for(j=0;s[j]&&out[i+j]==(unsigned char)s[j];j++);if(!s[j]&&!out[i+j])return 1;while(out[i])i++;i++;}return 0;}
int main(void){static const wchar_t primary[]=L"CASTLINK_NATIVE_REPLY_FD=4\0PATH=C:\\evil\0COR_ENABLE_PROFILING=1\0PSModulePath=C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules\0SystemRoot=C:\\Windows\0TEMP=C:\\evil\0\0";assert(cl_worker_environment((const uint16_t*)primary,(const uint16_t*)L"D:\\private\\castlink-worker-abc",out,5000));assert(field("TEMP=D:\\private\\castlink-worker-abc"));assert(field("TMP=D:\\private\\castlink-worker-abc"));assert(!field("PATH=C:\\evil"));assert(!field("CASTLINK_NATIVE_REPLY_FD=4"));assert(!field("COR_ENABLE_PROFILING=1"));assert(!cl_worker_environment((const uint16_t*)primary,(const uint16_t*)L"D:\\private\\..\\escape",out,5000));assert(!cl_worker_environment((const uint16_t*)primary,(const uint16_t*)L"D:\\private",out,3));return 0;}`,['core']));
test('actual native config predicate rejects private binding routes, unsupported encoding and growth',async()=>{const source=await readFile(path.join(native,'windows.c'),'utf8');const body=source.slice(source.indexOf('static int os_config('),source.indexOf('static int verify('));await run(String.raw`#include <stdint.h>
#include <stddef.h>
#include <string.h>
#include <assert.h>
typedef uint32_t DWORD;typedef struct {int64_t QuadPart;} LARGE_INTEGER;
struct held {int handle;struct {DWORD nFileSizeHigh,nFileSizeLow;} identity;};
static unsigned char io[65536],input[65537];static size_t size;static int growing;
#define FILE_BEGIN 0
static int stable(struct held*h){(void)h;return 1;}
static int SetFilePointerEx(int h,LARGE_INTEGER z,void*p,int origin){(void)h;(void)z;(void)p;(void)origin;return 1;}
static int ReadFile(int h,void*out,DWORD want,DWORD*got,void*p){(void)h;(void)p;*got=(DWORD)(growing?size+1:size);assert(*got<=want);memcpy(out,input,*got);return 1;}
`+body+String.raw`
static int check(const char*s){struct held h={1,{0,0}};size=strlen(s);memcpy(input,s,size);h.identity.nFileSizeLow=(DWORD)size;return os_config(&h);}
int main(void){assert(check("<configuration><startup/></configuration>"));assert(!check("<configuration><runtime><probing privatePath='D:\\evil'/></runtime></configuration>"));assert(!check("<configuration><codeBase href='D:\\evil.dll'/></configuration>"));assert(!check("<configuration><AppDomainManagerType>x</AppDomainManagerType></configuration>"));growing=1;assert(!check("<configuration/>"));growing=0;{const char*s="<configuration><DEVPATH/></configuration>";struct held h={1,{0,0}};unsigned i;size=2+strlen(s)*2;input[0]=255;input[1]=254;for(i=0;s[i];i++){input[2+i*2]=(unsigned char)s[i];input[3+i*2]=0;}h.identity.nFileSizeLow=(DWORD)size;assert(!os_config(&h));input[0]=254;input[1]=255;assert(!os_config(&h));}return 0;}`,[]);});
test('actual scratch creator binds private CREATE, original no-write/delete-share handle and empty-only cleanup',async()=>{const source=await readFile(path.join(native,'windows.c'),'utf8');const body=source.slice(source.indexOf('static struct held scratch_held'),source.indexOf('int cl_managed_inventory'));await run(String.raw`#include <stdint.h>
#include <stddef.h>
#include <string.h>
#include <assert.h>
#include <wchar.h>
#define CL_MAX_PATH 1024
typedef wchar_t WCHAR;typedef uintptr_t HANDLE;typedef struct {int private_at_create;} SECURITY_ATTRIBUTES;typedef struct {int DeleteFile;} FILE_DISPOSITION_INFO;
struct held {HANDLE handle;WCHAR path[CL_MAX_PATH];int directory,system,inventory;};
#define INVALID_HANDLE_VALUE ((HANDLE)-1)
#define FILE_READ_ATTRIBUTES 1
#define READ_CONTROL 2
#define DELETE 4
#define FILE_SHARE_READ 8
#define OPEN_EXISTING 3
#define FILE_FLAG_OPEN_REPARSE_POINT 16
#define FILE_FLAG_BACKUP_SEMANTICS 32
#define FileDispositionInfo 4
#define TRUE 1
static const WCHAR root[]=L"D:\\own\\castlink-package";static int made,opened,closed,attempted,nonempty,collision;
static size_t length(const WCHAR*s){size_t n=0;while(s[n])n++;return n;}
static int copy(WCHAR*out,const WCHAR*in){size_t i,n=length(in);if(n>=CL_MAX_PATH)return 0;for(i=0;i<=n;i++)out[i]=in[i];return 1;}
static int append(WCHAR*out,const WCHAR*in){size_t a=length(out),b=length(in);if(a+b>=CL_MAX_PATH)return 0;return copy(out+a,in);}
static int SystemFunction036(void*p,unsigned n){memset(p,1,n);return 1;}
static int cl_private_directory_security(SECURITY_ATTRIBUTES*sa){sa->private_at_create=1;return 1;}
static int CreateDirectoryW(const WCHAR*p,SECURITY_ATTRIBUTES*sa){assert(sa->private_at_create);assert(p[0]=='D');assert(p[7]=='c');if(collision)return 0;made++;return 1;}
static HANDLE CreateFileW(const WCHAR*p,int access,int share,void*sa,int disposition,int flags,void*template){(void)p;(void)sa;(void)template;assert(made);assert(access==(FILE_READ_ATTRIBUTES|READ_CONTROL|DELETE));assert(share==FILE_SHARE_READ);assert(disposition==OPEN_EXISTING);assert(flags==(FILE_FLAG_OPEN_REPARSE_POINT|FILE_FLAG_BACKUP_SEMANTICS));opened++;return 100;}
static int inspect(struct held*h){assert(h->handle==100&&h->directory&&!h->system);return 1;}
static int SetFileInformationByHandle(HANDLE h,int kind,FILE_DISPOSITION_INFO*d,size_t bytes){assert(h==100&&kind==FileDispositionInfo&&d->DeleteFile&&bytes==sizeof(*d));attempted++;return !nonempty;}
static int CloseHandle(HANDLE h){assert(h==100);closed++;return 1;}
`+body+String.raw`
int main(void){HANDLE h=0;const WCHAR*p=0;assert(cl_worker_scratch_create(0,&h,&p));assert(h==100&&made==1&&opened==1);assert(!cl_worker_scratch_create(0,&h,&p));nonempty=1;cl_worker_scratch_close(0);assert(attempted==1&&closed==1&&made==1);collision=1;assert(!cl_worker_scratch_create(0,&h,&p));assert(attempted==1&&closed==1);assert(!cl_worker_scratch_create(2,&h,&p));return 0;}`,[]);});
