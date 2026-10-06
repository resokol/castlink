// Execute the production ACL predicate against the observed Windows root ACE;
// mocks supply metadata only. This does not claim native filesystem acceptance.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const source=fs.readFileSync(path.join(root,'native/primary-launcher/windows.c'),'utf8');
const trusted=source.slice(source.indexOf('static int trusted_sid('),source.indexOf('static int acl('));
const acl=source.slice(source.indexOf('static int acl('),source.indexOf('static int inspect('));
assert.ok(trusted.startsWith('static int trusted_sid(')&&acl.startsWith('static int acl('));
const updated=acl.includes('int drive_root');
if(updated)assert.ok(source.includes('acl(h->handle,h->system,h->directory&&length(h->path)==3)'));
const c=String.raw`
#include <stdint.h>
#include <stddef.h>
#include <stdio.h>
typedef uint32_t DWORD;typedef void* HANDLE;typedef void* PSECURITY_DESCRIPTOR;typedef DWORD* PSID;
typedef struct{unsigned char AceType,AceFlags;uint16_t AceSize;}ACE_HEADER;
typedef struct{ACE_HEADER Header;DWORD Mask,SidStart;}ACCESS_ALLOWED_ACE;
typedef struct{DWORD AceCount,AclBytesInUse,AclBytesFree;}ACL_SIZE_INFORMATION;
typedef struct{int unused;}ACL;typedef ACL* PACL;
#define ERROR_SUCCESS 0
#define SE_FILE_OBJECT 1
#define OWNER_SECURITY_INFORMATION 1
#define DACL_SECURITY_INFORMATION 4
#define AclSizeInformation 2
#define INHERIT_ONLY_ACE 8
#define ACCESS_DENIED_ACE_TYPE 1
#define ACCESS_ALLOWED_ACE_TYPE 0
#define GENERIC_ALL 0x10000000u
#define GENERIC_WRITE 0x40000000u
#define FILE_WRITE_DATA 2u
#define FILE_APPEND_DATA 4u
#define FILE_WRITE_EA 16u
#define FILE_WRITE_ATTRIBUTES 256u
#define DELETE 65536u
#define FILE_DELETE_CHILD 64u
#define WRITE_DAC 262144u
#define WRITE_OWNER 524288u
static DWORD system_value=1,admin_value=2,installer_value=3,current_value=4;
static PSID sid_system=&system_value,sid_admin=&admin_value,sid_installer=&installer_value,current_sid=&current_value;
static PSID fixture_owner;static ACL fixture_acl;static ACCESS_ALLOWED_ACE fixture_ace;static int get_ace_failure;
static unsigned init_phase=2,init_reason;
static int IsValidSid(PSID s){return s&&*s>=1&&*s<=6;}
static int EqualSid(PSID a,PSID b){return *a==*b;}
static DWORD GetSecurityInfo(HANDLE h,int kind,DWORD flags,PSID*owner,void*g,PACL*dacl,void*s,PSECURITY_DESCRIPTOR*sd){(void)h;(void)kind;(void)flags;(void)g;(void)s;*owner=fixture_owner;*dacl=&fixture_acl;*sd=&fixture_acl;return 0;}
static int GetAclInformation(PACL p,void*out,size_t bytes,int kind){(void)p;(void)bytes;(void)kind;((ACL_SIZE_INFORMATION*)out)->AceCount=1;return 1;}
static int GetAce(PACL p,unsigned index,void**out){(void)p;(void)index;*out=&fixture_ace;return !get_ace_failure;}
static void* LocalFree(void*p){(void)p;return 0;}
${trusted}
${acl}
static int observed_acl(int system,int drive_root){fixture_owner=system?sid_installer:current_sid;init_reason=0;${updated?'return acl((void*)1,system,drive_root);':'(void)drive_root;return acl((void*)1,system);'}}
static unsigned passed,failed;
static void check(const char*name,int system,int drive_root,DWORD mask,int expected){int actual;fixture_ace.Header.AceType=0;fixture_ace.Header.AceFlags=0;fixture_ace.Mask=mask;fixture_ace.SidStart=6;get_ace_failure=0;actual=observed_acl(system,drive_root);if(actual==expected&&init_reason==5){passed++;}else{failed++;printf("FAIL %s expected=%d actual=%d\n",name,expected,actual);}}
int main(void){DWORD prohibited[]={FILE_WRITE_DATA,GENERIC_WRITE,GENERIC_ALL,FILE_DELETE_CHILD,DELETE,WRITE_DAC,WRITE_OWNER,FILE_WRITE_EA,FILE_WRITE_ATTRIBUTES};unsigned i;
check("measured OS drive-root create-subdirectory ACE",1,1,4u,1);
check("file/nonroot OS directory retains bit4 barrier",1,0,4u,0);
check("package drive-root retains bit4 barrier",0,1,4u,0);
for(i=0;i<sizeof(prohibited)/sizeof(prohibited[0]);i++){check("root prohibited bit",1,1,prohibited[i],0);check("root creation plus prohibited bit",1,1,4u|prohibited[i],0);}
check("root read and synchronize with creation",1,1,4u|0x100000u|0x20000u|1u|32u,1);
fixture_ace.Header.AceType=9;fixture_ace.Mask=4;fixture_ace.SidStart=6;if(!observed_acl(1,1))passed++;else failed++;
fixture_ace.Header.AceType=0;get_ace_failure=1;if(!observed_acl(1,1))passed++;else failed++;
printf("production ACL cases: %u PASS / %u FAIL\n",passed,failed);return failed?1:0;}
`;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-os-drive-acl-'));
try{const input=path.join(dir,'proof.c'),binary=path.join(dir,'proof');fs.writeFileSync(input,c,{mode:0o600});const compiled=spawnSync('cc',['-std=c11','-Wall','-Wextra','-Werror',input,'-o',binary],{encoding:'utf8',timeout:20000,maxBuffer:65536});assert.equal(compiled.status,0,compiled.stderr);const proof=spawnSync(binary,[],{encoding:'utf8',timeout:5000,maxBuffer:65536});process.stdout.write(proof.stdout);assert.equal(proof.status,0,proof.stderr);}finally{fs.rmSync(dir,{recursive:true,force:true});}
