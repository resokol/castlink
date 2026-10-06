#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <aclapi.h>
BOOLEAN WINAPI SystemFunction036(PVOID buffer,ULONG bytes);
#include "core.h"
#include "security.h"
#include "inventory.h"
#include "broker.h"
#include "docker-windows.h"
/* No CRT startup. Compiler-emitted copies resolve to these local definitions. */
void *memset(void *p,int c,size_t n){unsigned char*q=p;size_t i;for(i=0;i<n;i++)q[i]=(unsigned char)c;return p;}
void *memcpy(void *p,const void *s,size_t n){unsigned char*q=p;const unsigned char*r=s;size_t i;for(i=0;i<n;i++)q[i]=r[i];return p;}
struct held {HANDLE handle;WCHAR path[CL_MAX_PATH];BY_HANDLE_FILE_INFORMATION identity;int directory;int inventory;int system;};
static struct held held[CL_MAX_GUARDS];
static HANDLE transferred[CL_MAX_GUARDS+8];
static unsigned held_count,transfer_count;
static int attributes_ready;
/* Initialization diagnostics contain finite stage/index data only; no paths or OS error strings. */
static unsigned init_phase,init_reason,init_index;
static size_t init_number(char*out,unsigned value){char digits[10];size_t n=0,i;do{digits[n++]=(char)('0'+value%10);value/=10;}while(value);for(i=0;i<n;i++)out[i]=digits[n-i-1];return n;}
static void init_refusal(void){char text[160];size_t n=0,i;DWORD written;HANDLE error=GetStdHandle(STD_ERROR_HANDLE);static const char*a="{\"schemaVersion\":1,\"phase\":";static const char*b=",\"reason\":";static const char*c=",\"guardIndex\":";for(i=0;a[i];i++)text[n++]=a[i];n+=init_number(text+n,init_phase);for(i=0;b[i];i++)text[n++]=b[i];n+=init_number(text+n,init_reason);for(i=0;c[i];i++)text[n++]=c[i];n+=init_number(text+n,init_index);text[n++]='}';text[n++]='\n';if(error&&error!=INVALID_HANDLE_VALUE)WriteFile(error,text,(DWORD)n,&written,0);}

static WCHAR image[CL_MAX_PATH],root[CL_MAX_PATH],system_dir[CL_MAX_PATH],powershell[CL_MAX_PATH],node[CL_MAX_PATH],bootstrap[CL_MAX_PATH],command[CL_MAX_COMMAND];
static DECLSPEC_ALIGN(16) unsigned char io[65536],token_bytes[1024],sid_system[SECURITY_MAX_SID_SIZE],sid_admin[SECURITY_MAX_SID_SIZE],attribute_bytes[65536];
static PSID current_sid;
/* Fixed NT SERVICE\TrustedInstaller SID, not caller registry/environment data. */
static const struct {BYTE revision,count;SID_IDENTIFIER_AUTHORITY authority;DWORD sub[6];} installer_sid={1,6,{{0,0,0,0,0,5}},{80,956008885,3418522649,1831038044,1853292631,2271478464}};
static PSID sid_installer=(PSID)&installer_sid;
static STARTUPINFOEXW start;
static PROCESS_INFORMATION child;
static HANDLE request_read,request_write,reply_read,reply_write;
static unsigned char stdio_table[sizeof(int)+5+5*sizeof(HANDLE)];
static WCHAR environment[CL_MAX_PATH*3+256];
static size_t length(const WCHAR*s){size_t n=0;while(s[n]){if(n>=CL_MAX_PATH)return CL_MAX_PATH;n++;}return n;}
static int copy(WCHAR*out,const WCHAR*in){size_t n=length(in),i;if(n>=CL_MAX_PATH)return 0;for(i=0;i<=n;i++)out[i]=in[i];return 1;}
static int equal(const WCHAR*a,const WCHAR*b){return CompareStringOrdinal(a,-1,b,-1,TRUE)==CSTR_EQUAL;}
static int append(WCHAR*out,const WCHAR*in){size_t a=length(out),b=length(in),i;if(a+b>=CL_MAX_PATH)return 0;for(i=0;i<=b;i++)out[a+i]=in[i];return 1;}
static int dos(const WCHAR*p){size_t n=length(p),i;if(n<3||n>=CL_MAX_PATH||p[0]<L'A'||p[0]>L'Z'||p[1]!=L':'||p[2]!=L'\\')return 0;for(i=3;i<n;i++)if(p[i]<32||p[i]==L':'||p[i]==L'/'||p[i]==L'"'||p[i]==L'*'||p[i]==L'?')return 0;return 1;}
static int trusted_sid(PSID sid,int system){return IsValidSid(sid)&&(EqualSid(sid,sid_system)||EqualSid(sid,sid_admin)||(system?EqualSid(sid,sid_installer):EqualSid(sid,current_sid)));}
static int acl(HANDLE handle,int system,int drive_root){PSECURITY_DESCRIPTOR sd=0;PSID owner=0;PACL dacl=0;ACL_SIZE_INFORMATION info;unsigned i;int ok=0;DWORD write_mask=GENERIC_ALL|GENERIC_WRITE|FILE_WRITE_DATA|FILE_APPEND_DATA|FILE_WRITE_EA|FILE_WRITE_ATTRIBUTES|DELETE|FILE_DELETE_CHILD|WRITE_DAC|WRITE_OWNER;
 /* At the OS drive root bit 4 permits creating unrelated subdirectories, not
    altering existing protected children. All registered descendants are still
    held/canonical/ACL-verified before execution. Files and other directories
    retain the original barrier, including child deletion and authority changes. */
 if(system&&drive_root)write_mask&=~FILE_APPEND_DATA;
 if(init_phase==2)init_reason=3;
 if(GetSecurityInfo(handle,SE_FILE_OBJECT,OWNER_SECURITY_INFORMATION|DACL_SECURITY_INFORMATION,&owner,0,&dacl,0,&sd)!=ERROR_SUCCESS)return 0;
 if(init_phase==2)init_reason=4;
 if(!trusted_sid(owner,system)||!dacl||!GetAclInformation(dacl,&info,sizeof(info),AclSizeInformation))goto done;
 if(init_phase==2)init_reason=5;
 for(i=0;i<info.AceCount;i++){void*raw=0;ACE_HEADER*head;ACCESS_ALLOWED_ACE*a;if(!GetAce(dacl,i,&raw))goto done;head=raw;if(head->AceFlags&INHERIT_ONLY_ACE)continue;if(head->AceType==ACCESS_DENIED_ACE_TYPE)continue;if(head->AceType!=ACCESS_ALLOWED_ACE_TYPE)goto done;a=raw;
  if((a->Mask&write_mask)&&!trusted_sid((PSID)&a->SidStart,system))goto done;
 }ok=1;done:if(sd)LocalFree(sd);return ok;}
static int inspect(struct held*h){WCHAR canonical[CL_MAX_PATH+4];DWORD n;BY_HANDLE_FILE_INFORMATION info;
 if(!GetFileInformationByHandle(h->handle,&info)||(info.dwFileAttributes&FILE_ATTRIBUTE_REPARSE_POINT)||(((info.dwFileAttributes&FILE_ATTRIBUTE_DIRECTORY)!=0)!=h->directory)||(!h->directory&&(!info.nNumberOfLinks||(!h->system&&info.nNumberOfLinks!=1))))return 0;
 n=GetFinalPathNameByHandleW(h->handle,canonical,CL_MAX_PATH+4,FILE_NAME_NORMALIZED|VOLUME_NAME_DOS);
 if(n<7||n>=CL_MAX_PATH+4||canonical[0]!=L'\\'||canonical[1]!=L'\\'||canonical[2]!=L'?'||canonical[3]!=L'\\'||!equal(canonical+4,h->path)||((h->system||(!h->directory&&h->inventory<0&&!equal(h->path,image)))&&!acl(h->handle,h->system,h->directory&&length(h->path)==3)))return 0;
 h->identity=info;return 1;}
static int stable(struct held*h){BY_HANDLE_FILE_INFORMATION a;if(!GetFileInformationByHandle(h->handle,&a))return 0;return a.dwFileAttributes==h->identity.dwFileAttributes&&a.dwVolumeSerialNumber==h->identity.dwVolumeSerialNumber&&a.nFileIndexHigh==h->identity.nFileIndexHigh&&a.nFileIndexLow==h->identity.nFileIndexLow&&a.nNumberOfLinks==h->identity.nNumberOfLinks&&a.nFileSizeHigh==h->identity.nFileSizeHigh&&a.nFileSizeLow==h->identity.nFileSizeLow&&a.ftLastWriteTime.dwHighDateTime==h->identity.ftLastWriteTime.dwHighDateTime&&a.ftLastWriteTime.dwLowDateTime==h->identity.ftLastWriteTime.dwLowDateTime;}
/* OS ancestry is registered first from GetSystemDirectoryW. A shared drive
   ancestor retains that OS policy; package-only paths never acquire it. */
static int add(const WCHAR*name,int directory,int index,int system){unsigned i;struct held*h;if(!dos(name))return 0;for(i=0;i<held_count;i++)if(equal(held[i].path,name))return held[i].directory==directory&&(directory||held[i].inventory==index);if(held_count>=CL_MAX_GUARDS)return 0;h=&held[held_count];if(!copy(h->path,name))return 0;h->directory=directory;h->inventory=index;h->system=system;h->handle=INVALID_HANDLE_VALUE;held_count++;return 1;}
static int ancestors(const WCHAR*name,int system){WCHAR part[CL_MAX_PATH];size_t i,n=length(name);if(!dos(name))return 0;for(i=0;i<n;i++){part[i]=name[i];if(i==2||name[i]==L'\\'){part[i+(i==2?1:0)]=0;if(!add(part,1,-1,system))return 0;part[i]=name[i];}}return 1;}
static int guard(void*ctx,unsigned index){struct held*h=&held[index];(void)ctx;init_phase=2;init_reason=1;init_index=index;h->handle=CreateFileW(h->path,GENERIC_READ|READ_CONTROL,FILE_SHARE_READ,0,OPEN_EXISTING,FILE_FLAG_OPEN_REPARSE_POINT|(h->directory?FILE_FLAG_BACKUP_SEMANTICS:FILE_FLAG_SEQUENTIAL_SCAN),0);if(h->handle==INVALID_HANDLE_VALUE)return 0;init_reason=2;if(!inspect(h)){CloseHandle(h->handle);h->handle=INVALID_HANDLE_VALUE;return 0;}return 1;}
static int hashfile(struct held*h,const struct cl_item*item){struct cl_sha sha;uint64_t remaining=item->bytes,actual=((uint64_t)h->identity.nFileSizeHigh<<32)|h->identity.nFileSizeLow;DWORD got;unsigned char hash[32];unsigned i;LARGE_INTEGER zero;if(actual!=remaining)return 0;zero.QuadPart=0;if(!SetFilePointerEx(h->handle,zero,0,FILE_BEGIN))return 0;cl_sha_init(&sha);while(remaining){DWORD want=remaining>sizeof(io)?(DWORD)sizeof(io):(DWORD)remaining;if(!ReadFile(h->handle,io,want,&got,0)||!got||got>want||!cl_sha_update(&sha,io,got))return 0;remaining-=got;}if(!ReadFile(h->handle,io,1,&got,0)||got)return 0;cl_sha_final(&sha,hash);for(i=0;i<32;i++)if(hash[i]!=item->hash[i])return 0;return stable(h);}
/* Refuse configuration routes that can redirect protected OS binding into
   private probing/compiler/profiler code. Accepted bytes are ASCII XML or
   UTF-16LE ASCII XML; other encodings fail closed instead of bypassing scan. */
static int os_config(struct held*h){static unsigned char text[65536];static const char*blocked[]={"probing","codebase","devpath","appdomainmanager","assemblyresolve"};DWORD got;size_t n=0,i,j,k,config_offset=0;int wide=0;LARGE_INTEGER zero;uint64_t bytes=((uint64_t)h->identity.nFileSizeHigh<<32)|h->identity.nFileSizeLow;if(!bytes||bytes>sizeof(io)-1)return 0;zero.QuadPart=0;if(!SetFilePointerEx(h->handle,zero,0,FILE_BEGIN)||!ReadFile(h->handle,io,(DWORD)bytes+1,&got,0)||got!=bytes||!stable(h))return 0;if(bytes>=2&&io[0]==255&&io[1]==254){wide=1;config_offset=2;if(bytes%2)return 0;}else if(bytes>=3&&io[0]==239&&io[1]==187&&io[2]==191)config_offset=3;for(i=config_offset;i<bytes;i+=wide?2:1){unsigned char c=io[i];if(!c||c>127||(wide&&io[i+1]))return 0;text[n++]=(c>='A'&&c<='Z')?(unsigned char)(c+32):c;}for(k=0;k<sizeof(blocked)/sizeof(blocked[0]);k++)for(i=0;i<n;i++){for(j=0;blocked[k][j]&&i+j<n&&text[i+j]==(unsigned char)blocked[k][j];j++);if(!blocked[k][j])return 0;}return 1;}
static int verify(void*ctx,unsigned index){struct held*h=&held[index];(void)ctx;init_phase=3;init_reason=1;init_index=index;if(!stable(h))return 0;init_reason=2;if(h->inventory==-3&&!os_config(h))return 0;init_reason=3;if(h->inventory>=0&&!hashfile(h,&cl_files[h->inventory]))return 0;return 1;}
/* Enumerate only after all directory handles are held. Extra package members are
   rejected; initial executing image is the sole inventory cycle exception. */
static int within(const WCHAR*p,const WCHAR*base){size_t i,n=length(base);if(length(p)<n)return 0;for(i=0;i<n;i++){WCHAR a=p[i],b=base[i];if(a>=L'a'&&a<=L'z')a-=32;if(b>=L'a'&&b<=L'z')b-=32;if(a!=b)return 0;}return p[n]==0||p[n]==L'\\';}
/* Only prepare/transfer on the entry thread invokes complete; no callback reentry. */
static int complete(void){unsigned i,j;static WCHAR pattern[CL_MAX_PATH],name[CL_MAX_PATH];WIN32_FIND_DATAW data;HANDLE scan;for(i=0;i<held_count;i++){if(!held[i].directory||!within(held[i].path,root))continue;if(!copy(pattern,held[i].path)||!append(pattern,L"\\*"))return 0;scan=FindFirstFileW(pattern,&data);if(scan==INVALID_HANDLE_VALUE)return 0;do{if(equal(data.cFileName,L".")||equal(data.cFileName,L".."))continue;if(!copy(name,held[i].path)||!append(name,L"\\")||!append(name,data.cFileName)){FindClose(scan);return 0;}for(j=0;j<held_count;j++)if(equal(name,held[j].path))break;if(j==held_count){FindClose(scan);return 0;}}while(FindNextFileW(scan,&data));if(GetLastError()!=ERROR_NO_MORE_FILES){FindClose(scan);return 0;}FindClose(scan);}return 1;}
static int duplicate(HANDLE original,HANDLE*out){return original&&original!=INVALID_HANDLE_VALUE&&DuplicateHandle(GetCurrentProcess(),original,GetCurrentProcess(),out,0,TRUE,DUPLICATE_SAME_ACCESS);}
static int transfer(void*ctx,unsigned count){unsigned i;SIZE_T bytes=sizeof(attribute_bytes);SECURITY_ATTRIBUTES sa;HANDLE stdio[5];int five=5;(void)ctx;init_phase=4;init_reason=0;init_index=0;if(!complete())return 0;if(!cl_private_security(&sa,TRUE))return 0;
 if(!CreatePipe(&request_read,&request_write,&sa,65536)||!SetHandleInformation(request_read,HANDLE_FLAG_INHERIT,0)||!CreatePipe(&reply_read,&reply_write,&sa,65536)||!SetHandleInformation(reply_write,HANDLE_FLAG_INHERIT,0))return 0;
 for(i=0;i<count;i++){if(!duplicate(held[i].handle,&transferred[transfer_count]))return 0;transfer_count++;}
 for(i=0;i<3;i++){if(!duplicate(GetStdHandle(i==0?STD_INPUT_HANDLE:i==1?STD_OUTPUT_HANDLE:STD_ERROR_HANDLE),&stdio[i]))return 0;transferred[transfer_count++]=stdio[i];}
 stdio[3]=request_write;stdio[4]=reply_read;for(i=3;i<5;i++)transferred[transfer_count++]=stdio[i];
 memcpy(stdio_table,&five,sizeof(five));for(i=0;i<5;i++){stdio_table[sizeof(int)+i]=(unsigned char)(0x01|(GetFileType(stdio[i])==FILE_TYPE_PIPE?0x08:GetFileType(stdio[i])==FILE_TYPE_CHAR?0x40:0));memcpy(stdio_table+sizeof(int)+5+i*sizeof(HANDLE),&stdio[i],sizeof(HANDLE));}
 start.StartupInfo.cb=sizeof(start);start.StartupInfo.dwFlags=STARTF_USESTDHANDLES;start.StartupInfo.hStdInput=stdio[0];start.StartupInfo.hStdOutput=stdio[1];start.StartupInfo.hStdError=stdio[2];start.StartupInfo.cbReserved2=(WORD)sizeof(stdio_table);start.StartupInfo.lpReserved2=stdio_table;
 start.lpAttributeList=(LPPROC_THREAD_ATTRIBUTE_LIST)attribute_bytes;if(!InitializeProcThreadAttributeList(start.lpAttributeList,1,0,&bytes))return 0;attributes_ready=1;
 return UpdateProcThreadAttribute(start.lpAttributeList,0,PROC_THREAD_ATTRIBUTE_HANDLE_LIST,transferred,transfer_count*sizeof(HANDLE),0,0)!=0;}
static int spawn(void*ctx){unsigned i;SECURITY_ATTRIBUTES process_security;(void)ctx;init_phase=5;init_reason=0;init_index=0;if(!cl_private_security(&process_security,FALSE))return 0;if(!CreateProcessW(node,command,&process_security,&process_security,TRUE,EXTENDED_STARTUPINFO_PRESENT|CREATE_UNICODE_ENVIRONMENT,environment,root,&start.StartupInfo,&child))return 0;
 /* Parent must close its copies of child pipe endpoints, or EOF is hidden. */
 for(i=0;i<transfer_count;i++)CloseHandle(transferred[i]);transfer_count=0;request_write=reply_read=0;CloseHandle(child.hThread);child.hThread=0;return 1;}
static int waitchild(void*ctx,unsigned*status){DWORD code;(void)ctx;init_phase=6;init_reason=0;init_index=0;
 {unsigned i;for(i=0;i<held_count;i++)transferred[i]=held[i].handle;if(!cl_broker_run(request_read,reply_write,child.hProcess,powershell,transferred,held_count,environment))return 0;}
 if(reply_write){CloseHandle(reply_write);reply_write=0;}if(request_read){CloseHandle(request_read);request_read=0;}
 if(WaitForSingleObject(child.hProcess,INFINITE)!=WAIT_OBJECT_0||!GetExitCodeProcess(child.hProcess,&code))return 0;CloseHandle(child.hProcess);child.hProcess=0;*status=code;return 1;}
static void closeall(void*ctx,unsigned count){unsigned i;(void)ctx;(void)count;for(i=0;i<held_count;i++)if(held[i].handle!=INVALID_HANDLE_VALUE){CloseHandle(held[i].handle);held[i].handle=INVALID_HANDLE_VALUE;}for(i=0;i<transfer_count;i++)CloseHandle(transferred[i]);transfer_count=0;if(attributes_ready)DeleteProcThreadAttributeList(start.lpAttributeList);if(request_read)CloseHandle(request_read);if(request_write)CloseHandle(request_write);if(reply_read)CloseHandle(reply_read);if(reply_write)CloseHandle(reply_write);}
/* Fixed candidate catalog names known-folder base; native appends all executable
   suffixes and admits the signed observation only against held original bytes. */
int cl_admit_docker(const struct cl_docker_candidate*c,WCHAR*exe,WCHAR*config,WCHAR*file_anchor,HANDLE*out,unsigned*count){
 /* The single broker request loop is the sole caller; its watchdog never admits files.
    Static scratch keeps the CRT-free frame below the stack-probe boundary. */
 static WCHAR base[CL_MAX_PATH],app[CL_MAX_PATH],desktop[CL_MAX_PATH],config_file[CL_MAX_PATH],plugin_file[CL_MAX_PATH];unsigned before=held_count,i;int n;struct cl_item observed;
 if(!c||!exe||!config||!file_anchor||!out||!count)return 0;
 n=MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,(const char*)c->base,(int)c->base_bytes,base,CL_MAX_PATH-1);if(n<3||n>=CL_MAX_PATH-1)return 0;base[n]=0;if(!dos(base))return 0;
 if(!ancestors(base,c->machine!=0)||!add(base,1,-1,c->machine!=0)||!copy(app,base)||!append(app,c->machine?L"\\Docker\\Docker":L"\\Programs\\DockerDesktop"))return 0;
 if(!copy(desktop,app)||!append(desktop,L"\\Docker Desktop.exe")||!ancestors(desktop,0)||!add(desktop,0,-3,0))return 0;
 if(!copy(exe,app)||!append(exe,L"\\resources\\bin\\docker.exe")||!ancestors(exe,0)||!add(exe,0,-4,0))return 0;
 for(i=before;i<held_count;i++)if(!guard(0,i))return 0;
 for(i=0;i<held_count;i++)if(!stable(&held[i]))return 0;
 observed.path=0;for(i=0;i<held_count;i++){
  unsigned j;if(equal(held[i].path,desktop)){observed.bytes=c->desktop_bytes;for(j=0;j<32;j++)observed.hash[j]=c->desktop_sha[j];if(!hashfile(&held[i],&observed))return 0;}
  if(equal(held[i].path,exe)){observed.bytes=c->docker_bytes;for(j=0;j<32;j++)observed.hash[j]=c->docker_sha[j];if(!hashfile(&held[i],&observed))return 0;}
 }
 /* --config is a held DIRECTORY; its original FILE remains separately hashed. */
 if(!copy(config,root)||!append(config,L"\\metadata\\docker-config")||!copy(config_file,config)||!append(config_file,L"\\config.json")||!copy(plugin_file,config)||!append(plugin_file,L"\\cli-plugins"))return 0;
 {int found=0,directory_found=0;struct cl_sha sha;static const unsigned char minimum[]={123,125,10};observed.bytes=3;cl_sha_init(&sha);if(!cl_sha_update(&sha,minimum,3))return 0;cl_sha_final(&sha,observed.hash);for(i=0;i<held_count;i++){if(equal(held[i].path,config)){if(!held[i].directory)return 0;directory_found=1;}if(equal(held[i].path,config_file)){if(held[i].directory||held[i].inventory<0||!hashfile(&held[i],&observed))return 0;found=1;}}if(!found||!directory_found)return 0;}
 /* A held regular-file sentinel structurally excludes the config-dir plugin route. */
 {int found=0;struct cl_sha sha;static const unsigned char blocked[]={100,105,115,97,98,108,101,100,10};observed.bytes=sizeof(blocked);cl_sha_init(&sha);if(!cl_sha_update(&sha,blocked,sizeof(blocked)))return 0;cl_sha_final(&sha,observed.hash);for(i=0;i<held_count;i++)if(equal(held[i].path,plugin_file)){if(held[i].directory||held[i].inventory<0||!hashfile(&held[i],&observed))return 0;found=1;}if(!found)return 0;}
 for(i=0;i<held_count;i++)if(within(held[i].path,config)&&!equal(held[i].path,config)&&!equal(held[i].path,config_file)&&!equal(held[i].path,plugin_file))return 0;
 if(!copy(file_anchor,config_file))return 0;
 for(i=0;i<held_count;i++){out[i]=held[i].handle;}
 *count=held_count;return 1;
}
/* Fixed installed plugin only. Candidate provenance is observed by the signed
   catalog; native owns its path, held bytes/ancestry and all execution authority. */
int cl_check_docker_guards(void){unsigned i;for(i=0;i<held_count;i++)if(!stable(&held[i]))return 0;return complete();}
int cl_admit_compose(const struct cl_docker_candidate*c,WCHAR*compose,HANDLE*out,unsigned*count){
 static WCHAR base[CL_MAX_PATH];unsigned before=held_count,i,j;int n,found=0;struct cl_item observed;
 if(!c||!compose||!out||!count||!c->compose_bytes||c->compose_bytes>134217728||!c->compose_sha)return 0;
 n=MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,(const char*)c->base,(int)c->base_bytes,base,CL_MAX_PATH-1);if(n<3||n>=CL_MAX_PATH-1)return 0;base[n]=0;if(!dos(base))return 0;
 if(!copy(compose,base)||!append(compose,c->machine?L"\\Docker\\Docker":L"\\Programs\\DockerDesktop")||!append(compose,L"\\resources\\cli-plugins\\docker-compose.exe")||!ancestors(compose,0)||!add(compose,0,-7,0))return 0;
 for(i=before;i<held_count;i++)if(!guard(0,i))return 0;
 for(i=0;i<held_count;i++)if(!stable(&held[i]))return 0;
 observed.bytes=c->compose_bytes;for(j=0;j<32;j++)observed.hash[j]=c->compose_sha[j];
 for(i=0;i<held_count;i++){if(equal(held[i].path,compose)){if(held[i].directory||!hashfile(&held[i],&observed))return 0;found=1;}out[i]=held[i].handle;}
 if(!found){return 0;}*count=held_count;return 1;
}
int cl_admit_context(const struct cl_docker_candidate*c,struct cl_native_context*out,HANDLE*guards,unsigned*count){
 static const unsigned char name[]="desktop-linux";static const WCHAR hex[]=L"0123456789abcdef";WCHAR profile[CL_MAX_PATH],id[65];struct cl_sha sha;unsigned char hash[32];struct cl_item observed;unsigned before=held_count,i,j;int n,seen_config=0,seen_meta=0;
 if(!c||!out||!guards||!count||(c->context_kind!=1&&c->context_kind!=2)||!c->profile)return 0;
 n=MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,(const char*)c->profile,(int)c->profile_bytes,profile,CL_MAX_PATH-1);if(n<3||n>=CL_MAX_PATH-1)return 0;profile[n]=0;if(!dos(profile))return 0;
 cl_sha_init(&sha);if(!cl_sha_update(&sha,name,sizeof(name)-1))return 0;cl_sha_final(&sha,hash);for(i=0;i<32;i++){id[i*2]=hex[hash[i]>>4];id[i*2+1]=hex[hash[i]&15];}id[64]=0;
 if(!copy(out->metadata_path,profile)||!append(out->metadata_path,L"\\.docker\\contexts\\meta\\")||!append(out->metadata_path,id)||!append(out->metadata_path,L"\\meta.json")||!ancestors(out->metadata_path,0)||!add(out->metadata_path,0,-6,0))return 0;
 out->config_path[0]=0;if(c->context_kind==1&&(!copy(out->config_path,profile)||!append(out->config_path,L"\\.docker\\config.json")||!ancestors(out->config_path,0)||!add(out->config_path,0,-5,0)))return 0;
 for(i=before;i<held_count;i++)if(!guard(0,i))return 0;
 for(i=0;i<held_count;i++)if(!stable(&held[i]))return 0;
 observed.path=0;for(i=0;i<held_count;i++){
  if(equal(held[i].path,out->metadata_path)){observed.bytes=c->metadata_bytes;for(j=0;j<32;j++)observed.hash[j]=c->metadata_sha[j];if(held[i].directory||!hashfile(&held[i],&observed))return 0;seen_meta=1;}
  if(c->context_kind==1&&equal(held[i].path,out->config_path)){observed.bytes=c->config_bytes;for(j=0;j<32;j++)observed.hash[j]=c->config_sha[j];if(held[i].directory||!hashfile(&held[i],&observed))return 0;seen_config=1;}
 }
 if(!seen_meta||(c->context_kind==1&&!seen_config)){return 0;}
 out->kind=c->context_kind;out->config_bytes=c->config_bytes;out->metadata_bytes=c->metadata_bytes;for(i=0;i<32;i++){out->config_sha[i]=c->config_sha[i];out->metadata_sha[i]=c->metadata_sha[i];}
 for(i=0;i<held_count;i++){guards[i]=held[i].handle;}*count=held_count;return 1;
}
/* Entry thread only. App-state root is bounded data; other ambient values are
   not copied. Its physical SID/ancestry/DACL predicates remain Node/helper PRE. */
static int child_environment(void){static WCHAR profile[CL_MAX_PATH],windows_dir[CL_MAX_PATH],modules[CL_MAX_PATH];const WCHAR*selected=0;DWORD n,error;size_t wn=length(system_dir);if(wn<12||!equal(system_dir+wn-9,L"\\System32")||!copy(windows_dir,system_dir))return 0;windows_dir[wn-9]=0;if(!copy(modules,system_dir)||!append(modules,L"\\WindowsPowerShell\\v1.0\\Modules"))return 0;SetLastError(ERROR_SUCCESS);n=GetEnvironmentVariableW(L"CASTLINK_PROFILE_ROOT",profile,CL_MAX_PATH);error=GetLastError();if(n>=CL_MAX_PATH)return 0;if(n)selected=profile;else if(error!=ERROR_ENVVAR_NOT_FOUND)return 0;return cl_primary_environment((const uint16_t*)selected,(const uint16_t*)modules,(const uint16_t*)windows_dir,(uint16_t*)environment,sizeof(environment)/sizeof(environment[0]));}
static int prepare(void){DWORD n,size;HANDLE token;TOKEN_USER*user;unsigned i;size_t used=0,p;const WCHAR*args;
 init_phase=1;init_reason=1;init_index=0;
 if(!OpenProcessToken(GetCurrentProcess(),TOKEN_QUERY,&token))return 0;if(!GetTokenInformation(token,TokenUser,token_bytes,sizeof(token_bytes),&size)){CloseHandle(token);return 0;}CloseHandle(token);user=(TOKEN_USER*)token_bytes;current_sid=user->User.Sid;size=sizeof(sid_system);if(!CreateWellKnownSid(WinLocalSystemSid,0,sid_system,&size))return 0;size=sizeof(sid_admin);if(!CreateWellKnownSid(WinBuiltinAdministratorsSid,0,sid_admin,&size))return 0;
 init_phase=1;init_reason=2;init_index=0;
 n=GetSystemDirectoryW(system_dir,CL_MAX_PATH);if(!n||n>=CL_MAX_PATH||!dos(system_dir))return 0;
 init_phase=1;init_reason=3;init_index=0;
 if(!copy(powershell,system_dir)||!append(powershell,L"\\WindowsPowerShell\\v1.0\\powershell.exe")||!ancestors(powershell,1)||!add(powershell,0,-2,1))return 0;
 /* Fixed stock module entrypoints are admitted under OS owner/effective ACL policy.
    CLR/BCL transitive dependencies use protected OS authority, not byte snapshots. */
 init_phase=1;init_reason=4;init_index=0;
 {static WCHAR module[CL_MAX_PATH];static const WCHAR*names[]={L"Management",L"Utility",L"Security"};unsigned m;for(m=0;m<3;m++){if(!copy(module,system_dir)||!append(module,L"\\WindowsPowerShell\\v1.0\\Modules\\Microsoft.PowerShell.")||!append(module,names[m])||!append(module,L"\\Microsoft.PowerShell.")||!append(module,names[m])||!append(module,L".psd1")||!ancestors(module,1)||!add(module,0,-2,1))return 0;}}
 init_phase=1;init_reason=5;init_index=0;
 {static WCHAR configured[CL_MAX_PATH],windows_root[CL_MAX_PATH];DWORD a;size_t z;if(!copy(configured,powershell)||!append(configured,L".config"))return 0;a=GetFileAttributesW(configured);if(a==INVALID_FILE_ATTRIBUTES){if(GetLastError()!=ERROR_FILE_NOT_FOUND)return 0;}else if(!ancestors(configured,1)||!add(configured,0,-3,1))return 0;if(!copy(windows_root,system_dir))return 0;z=length(windows_root);if(z<9||!equal(windows_root+z-9,L"\\System32"))return 0;windows_root[z-9]=0;if(!copy(configured,windows_root)||!append(configured,L"\\Microsoft.NET\\Framework64\\v4.0.30319\\Config\\machine.config")||!ancestors(configured,1)||!add(configured,0,-3,1))return 0;}
 init_phase=1;init_reason=6;init_index=0;
 if(!child_environment())return 0;

 init_phase=1;init_reason=7;init_index=0;
 n=GetModuleFileNameW(0,image,CL_MAX_PATH);if(!n||n>=CL_MAX_PATH||!dos(image)||n<17||!equal(image+n-17,L"\\bin\\castlink.exe"))return 0;
 init_phase=1;init_reason=8;init_index=0;
 if(!copy(root,image))return 0;root[n-17]=0;if(!ancestors(image,0)||!add(root,1,-1,0)||!add(image,0,-1,0))return 0;
 init_phase=1;init_reason=9;init_index=0;
 for(i=0;i<CL_FILE_COUNT;i++){WCHAR name[CL_MAX_PATH];if(!copy(name,root)||!append(name,L"\\")||!append(name,(const WCHAR*)cl_files[i].path)||!ancestors(name,0)||!add(name,0,(int)i,0))return 0;}
 init_phase=1;init_reason=10;init_index=0;
 if(!copy(node,root)||!append(node,L"\\runtime\\node.exe")||!copy(bootstrap,root)||!append(bootstrap,L"\\native-bootstrap.mjs"))return 0;
 init_phase=1;init_reason=11;init_index=0;
 if(!cl_quote((uint16_t*)command,CL_MAX_COMMAND,&used,(const uint16_t*)node)||used>=CL_MAX_COMMAND-1)return 0;command[used++]=L' ';if(!cl_quote((uint16_t*)command,CL_MAX_COMMAND,&used,(const uint16_t*)bootstrap))return 0;
 init_phase=1;init_reason=12;init_index=0;
 args=GetCommandLineW();p=0;if(args[0]==L'"'){p=1;while(args[p]&&args[p]!=L'"')p++;if(!args[p])return 0;p++;}else while(args[p]&&args[p]!=L' '&&args[p]!=L'\t')p++;while(args[p]==L' '||args[p]==L'\t')p++;
 if(args[p]){command[used++]=L' ';while(args[p]){if(used>=CL_MAX_COMMAND-1)return 0;command[used++]=args[p++];}}command[used]=0;return 1;}
/* Two serial broker slots, maximum 64 private scratch objects per invocation.
   They are siblings of the immutable package. No recursive/path cleanup. */
static struct held scratch_held[2];
static unsigned scratch_created;
int cl_worker_scratch_create(unsigned slot,HANDLE*handle,const WCHAR**path){static WCHAR candidate[CL_MAX_PATH];static unsigned char nonce[16];static const WCHAR hex[]=L"0123456789abcdef";SECURITY_ATTRIBUTES sa;size_t n,i;struct held*h;if(slot>1||!handle||!path||scratch_created>=64)return 0;h=&scratch_held[slot];if(h->handle&&h->handle!=INVALID_HANDLE_VALUE)return 0;if(!copy(candidate,root))return 0;n=length(candidate);while(n&&candidate[n-1]!=L'\\')n--;if(n<4)return 0;candidate[n-1]=0;if(!append(candidate,L"\\castlink-worker-")||!SystemFunction036(nonce,sizeof(nonce))||!cl_private_directory_security(&sa))return 0;n=length(candidate);if(n+32>=CL_MAX_PATH)return 0;for(i=0;i<16;i++){candidate[n++]=hex[nonce[i]>>4];candidate[n++]=hex[nonce[i]&15];}candidate[n]=0;if(!CreateDirectoryW(candidate,&sa))return 0;scratch_created++;if(!copy(h->path,candidate))return 0;h->directory=1;h->system=0;h->inventory=-1;h->handle=CreateFileW(candidate,FILE_READ_ATTRIBUTES|READ_CONTROL|DELETE,FILE_SHARE_READ,0,OPEN_EXISTING,FILE_FLAG_OPEN_REPARSE_POINT|FILE_FLAG_BACKUP_SEMANTICS,0);if(h->handle==INVALID_HANDLE_VALUE||!inspect(h)){if(h->handle!=INVALID_HANDLE_VALUE)CloseHandle(h->handle);h->handle=0;return 0;}*handle=h->handle;*path=h->path;return 1;}
void cl_worker_scratch_close(unsigned slot){FILE_DISPOSITION_INFO disposition;struct held*h;if(slot>1)return;h=&scratch_held[slot];if(!h->handle||h->handle==INVALID_HANDLE_VALUE)return;/* Reached after confirmed worker/job reap, or before any child launch. Only original empty directory can be marked; nonempty/uncertain scratch retains quota. Node duplicate guards may keep confirmed delete-pending storage until Node exits. */disposition.DeleteFile=TRUE;{int marked=SetFileInformationByHandle(h->handle,FileDispositionInfo,&disposition,sizeof(disposition))!=0;if(!CloseHandle(h->handle))return;h->handle=0;if(marked&&scratch_created)scratch_created--;}}
int cl_managed_inventory(WCHAR*path,const struct cl_item**item){unsigned i;for(i=0;i<CL_FILE_COUNT;i++)if(equal((const WCHAR*)cl_files[i].path,L"managed\\CastLink.Native.Workers.dll")){if(!copy(path,root)||!append(path,L"\\")||!append(path,(const WCHAR*)cl_files[i].path))return 0;*item=&cl_files[i];return 1;}return 0;}
/* Publisher-owned newline env file. All package guards already persist in the
   checked Node; this returns data only after held original identity/hash. */
int cl_compose_env_file(WCHAR*path){unsigned i,j;struct cl_item expected;struct cl_sha sha;static const unsigned char newline[]={10};expected.bytes=1;cl_sha_init(&sha);if(!cl_sha_update(&sha,newline,1))return 0;cl_sha_final(&sha,expected.hash);for(i=0;i<CL_FILE_COUNT;i++)if(equal((const WCHAR*)cl_files[i].path,L"metadata\\compose-empty.env")){if(cl_files[i].bytes!=1)return 0;for(j=0;j<32;j++)if(cl_files[i].hash[j]!=expected.hash[j])return 0;if(!copy(path,root)||!append(path,L"\\metadata\\compose-empty.env"))return 0;for(j=0;j<held_count;j++)if(equal(held[j].path,path))return !held[j].directory&&held[j].inventory==(int)i&&stable(&held[j])&&hashfile(&held[j],&expected);return 0;}return 0;}
void WINAPI castlink_entry(void){unsigned status=4;struct cl_ops ops;ops.ctx=0;ops.guard=guard;ops.verify=verify;ops.inherit=transfer;ops.spawn=spawn;ops.wait=waitchild;ops.close=closeall;if(!prepare()||!cl_run(&ops,held_count,&status)){init_refusal();ExitProcess(4);}ExitProcess(status);}
