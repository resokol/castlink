#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include "core.h"
#include "security.h"
#include "protocol.h"
#include "broker.h"
#include "docker-windows.h"
#include "catalog.h"
#include "managed.h"
#include "target-catalog.h"
#include "root-catalog.h"
#include "target-windows.h"
#include "target-helpers.h"
struct worker{PROCESS_INFORMATION process;HANDLE input,output,error,job,scratch;int live;unsigned frame;uint32_t remaining;uint64_t aggregate,deadline;};
static struct worker session,sync_worker;
static struct cl_config_write config_write;
static WCHAR docker_exe[CL_MAX_PATH],compose_exe[CL_MAX_PATH],docker_config[CL_MAX_PATH],docker_config_file[CL_MAX_PATH],docker_environment[CL_MAX_PATH*4],docker_system_root[CL_MAX_PATH];
static HANDLE docker_guards[CL_MAX_GUARDS];
static struct cl_native_context context_state;
static unsigned docker_guard_count,node_guard_count,context_pending,preflight_pending,docker_command;
static unsigned doctor_stage;
static unsigned char docker_sha[32],compose_sha[32],server_facts[512],compose_facts[64];
static struct cl_target_capture target_capture;
static struct cl_root_capture root_capture;
static unsigned char target_packet[CL_TARGET_REQUEST_MAX],target_facts[CL_TARGET_INSPECT_MAX];
static WCHAR target_argument[CL_MAX_COMMAND];static char target_config_utf8[3072];
static HANDLE target_guards[CL_MAX_GUARDS];
static const struct cl_target_plan*target_plan;
static unsigned target_guard_count;static int target_reaped,target_poison;
static WCHAR compose_environment[CL_MAX_PATH*6],compose_empty_env[CL_MAX_PATH];static char compose_empty_utf8[3072];
static unsigned char selector_input[8192],converted_path[4096];
static DECLSPEC_ALIGN(16) unsigned char request_bytes[CL_MAX_REQUEST],reply_bytes[CL_MAX_REQUEST],discard[1024],attributes[65536];
static WCHAR command_line[CL_MAX_COMMAND],wide_input[16384],working_directory[CL_MAX_PATH];
static WCHAR worker_environment[CL_MAX_PATH*8+128];
static WCHAR managed_script[CL_MAX_COMMAND],managed_path[CL_MAX_PATH];
static HANDLE inherited[CL_MAX_GUARDS+4];
static uint64_t now(void);
static int node_alive(void);
static HANDLE node_process,main_thread,watch_thread;
static CRITICAL_SECTION state_lock;
static volatile LONG watch_stop;
static uint64_t operation_deadline;
static DWORD WINAPI watchdog(void*unused){(void)unused;while(!InterlockedCompareExchange(&watch_stop,0,0)){int expired;EnterCriticalSection(&state_lock);expired=!node_alive()||(operation_deadline&&now()>operation_deadline)||(session.live&&now()>session.deadline)||(sync_worker.live&&now()>sync_worker.deadline);if(expired){if(session.live&&session.job)TerminateJobObject(session.job,4);if(sync_worker.live&&sync_worker.job)TerminateJobObject(sync_worker.job,4);CancelSynchronousIo(main_thread);}LeaveCriticalSection(&state_lock);Sleep(10);}return 0;}

static uint64_t now(void){return GetTickCount64();}
static int node_alive(void){return WaitForSingleObject(node_process,0)==WAIT_TIMEOUT;}
static int write_all(HANDLE handle,const unsigned char*b,size_t n){DWORD wrote;size_t at=0;while(at<n){if(!WriteFile(handle,b+at,(DWORD)(n-at),&wrote,0)||!wrote)return 0;at+=wrote;}return 1;}
static void dispose(struct worker*w){EnterCriticalSection(&state_lock);if(w->input)CloseHandle(w->input);if(w->output)CloseHandle(w->output);if(w->error)CloseHandle(w->error);if(w->process.hThread)CloseHandle(w->process.hThread);if(w->process.hProcess)CloseHandle(w->process.hProcess);if(w->job)CloseHandle(w->job);w->input=w->output=w->error=w->job=w->process.hThread=w->process.hProcess=0;w->live=0;if(w->scratch){cl_worker_scratch_close(w==&session?1:0);w->scratch=0;}LeaveCriticalSection(&state_lock);}
static int reap(struct worker*w,int terminate){DWORD code;JOBOBJECT_BASIC_ACCOUNTING_INFORMATION accounting;uint64_t end;if(!w->live){dispose(w);return 1;}if(terminate){if(!TerminateJobObject(w->job,4))return 0;}if(WaitForSingleObject(w->process.hProcess,10000)!=WAIT_OBJECT_0||!GetExitCodeProcess(w->process.hProcess,&code))return 0;end=now()+10000;for(;;){if(!QueryInformationJobObject(w->job,JobObjectBasicAccountingInformation,&accounting,sizeof(accounting),0))return 0;if(!accounting.ActiveProcesses)break;if(now()>=end)return 0;Sleep(2);}dispose(w);return terminate||code==0;}
static int duplicate(HANDLE h,HANDLE*out){return DuplicateHandle(GetCurrentProcess(),h,GetCurrentProcess(),out,0,TRUE,DUPLICATE_SAME_ACCESS);}
/* Called only by the serial request loop. Remote handles intentionally remain
   in checked Node until its exit, including primary-parent crash. */
static int persist_node_guards(void){HANDLE remote;if(docker_guard_count>CL_MAX_GUARDS||node_guard_count>docker_guard_count)return 0;while(node_guard_count<docker_guard_count){if(!DuplicateHandle(GetCurrentProcess(),docker_guards[node_guard_count],node_process,&remote,0,TRUE,DUPLICATE_SAME_ACCESS))return 0;node_guard_count++;}return 1;}
static int launch(struct worker*w,const WCHAR*exe,const WCHAR*script,HANDLE*guards,unsigned count,const WCHAR*environment){SECURITY_ATTRIBUTES sa,process_security;HANDLE stdin_read=0,stdout_write=0,stderr_write=0;STARTUPINFOEXW start;JOBOBJECT_EXTENDED_LIMIT_INFORMATION job;SIZE_T size=sizeof(attributes);unsigned i,total=0,stdio_index;size_t used=0;int ok=0;
 if(script==cl_bridge_script||script==cl_setup_script||script==cl_backup_script){const struct cl_item*item=0;if(!cl_managed_inventory(managed_path,&item)||!cl_managed_prefix((uint16_t*)managed_script,CL_MAX_COMMAND,(uint16_t*)managed_path,item->bytes,item->hash,(const uint16_t*)script))return 0;script=managed_script;}
 /* Explicit loops avoid unbounded stack/CRT startup dependencies. */
 unsigned char*p=(unsigned char*)&start;for(i=0;i<sizeof(start);i++)p[i]=0;p=(unsigned char*)&job;for(i=0;i<sizeof(job);i++)p[i]=0;
 if(!cl_private_security(&sa,TRUE))return 0;
 if(!CreatePipe(&stdin_read,&w->input,&sa,65536)||!CreatePipe(&w->output,&stdout_write,&sa,65536)||!CreatePipe(&w->error,&stderr_write,&sa,65536))goto done;
 if(!SetHandleInformation(w->input,HANDLE_FLAG_INHERIT,0)||!SetHandleInformation(w->output,HANDLE_FLAG_INHERIT,0)||!SetHandleInformation(w->error,HANDLE_FLAG_INHERIT,0))goto done;
 if(script||(target_plan&&target_plan->executable==1)){const WCHAR*scratch_path=0;HANDLE remote;if(!cl_worker_scratch_create(w==&session?1:0,&w->scratch,&scratch_path)||!(script?cl_worker_environment((const uint16_t*)environment,(const uint16_t*)scratch_path,(uint16_t*)worker_environment,sizeof(worker_environment)/sizeof(worker_environment[0])):cl_compose_worker_environment((const uint16_t*)docker_config_file,(const uint16_t*)docker_config,(const uint16_t*)docker_system_root,(const uint16_t*)scratch_path,(uint16_t*)worker_environment,sizeof(worker_environment)/sizeof(worker_environment[0]))))goto done;if(!DuplicateHandle(GetCurrentProcess(),w->scratch,node_process,&remote,0,TRUE,DUPLICATE_SAME_ACCESS)||!duplicate(w->scratch,&inherited[total]))goto done;total++;environment=worker_environment;}
 stdio_index=count+total;
 for(i=0;i<count;i++){if(!duplicate(guards[i],&inherited[total]))goto done;total++;}
 inherited[total++]=stdin_read;stdin_read=0;inherited[total++]=stdout_write;stdout_write=0;inherited[total++]=stderr_write;stderr_write=0;
 {unsigned last=0;for(i=0;exe[i];i++){if(i>=CL_MAX_PATH-1)goto done;working_directory[i]=exe[i];if(exe[i]==L'\\')last=i;}if(last<3)goto done;working_directory[last]=0;}
 if(!cl_quote((uint16_t*)command_line,CL_MAX_COMMAND,&used,(const uint16_t*)exe))goto done;
 if(script){static const WCHAR flags[]=L" -NoLogo -NoProfile -NonInteractive -Command ";for(i=0;flags[i];i++){if(used>=CL_MAX_COMMAND-1)goto done;command_line[used++]=flags[i];}}
 if(script){if(!cl_quote((uint16_t*)command_line,CL_MAX_COMMAND,&used,(const uint16_t*)script))goto done;}
 else if(target_plan){unsigned a;for(a=0;a<target_plan->argc;a++){int n=MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,target_plan->argv[a],-1,target_argument,CL_MAX_COMMAND);if(n<1||used>=CL_MAX_COMMAND-1)goto done;command_line[used++]=L' ';if(!cl_quote((uint16_t*)command_line,CL_MAX_COMMAND,&used,(const uint16_t*)target_argument))goto done;}}
 else{const WCHAR*args[7]={L"--host",L"npipe:////./pipe/dockerDesktopLinuxEngine",L"--config",docker_config,L"info",L"--format",L"{\"ID\":{{json .ID}}}"};unsigned a,n=7;if(docker_command==1)args[6]=L"{{.ID}}|{{.OSType}}|{{.Architecture}}|{{.ServerVersion}}";else if(docker_command==2){args[0]=L"version";args[1]=L"--short";n=2;}else if(docker_command)goto done;for(a=0;a<n;a++){if(used>=CL_MAX_COMMAND-1)goto done;command_line[used++]=L' ';if(!cl_quote((uint16_t*)command_line,CL_MAX_COMMAND,&used,(const uint16_t*)args[a]))goto done;}}
 start.StartupInfo.cb=sizeof(start);start.StartupInfo.dwFlags=STARTF_USESTDHANDLES;start.StartupInfo.hStdInput=inherited[stdio_index];start.StartupInfo.hStdOutput=inherited[stdio_index+1];start.StartupInfo.hStdError=inherited[stdio_index+2];start.lpAttributeList=(LPPROC_THREAD_ATTRIBUTE_LIST)attributes;
 if(!InitializeProcThreadAttributeList(start.lpAttributeList,1,0,&size))goto done;
 if(!UpdateProcThreadAttribute(start.lpAttributeList,0,PROC_THREAD_ATTRIBUTE_HANDLE_LIST,inherited,total*sizeof(HANDLE),0,0)){DeleteProcThreadAttributeList(start.lpAttributeList);goto done;}
 w->job=CreateJobObjectW(0,0);job.BasicLimitInformation.LimitFlags=JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
 if(!w->job||!SetInformationJobObject(w->job,JobObjectExtendedLimitInformation,&job,sizeof(job))){DeleteProcThreadAttributeList(start.lpAttributeList);goto done;}
 if(!cl_private_security(&process_security,FALSE)){DeleteProcThreadAttributeList(start.lpAttributeList);goto done;}
 ok=CreateProcessW(exe,command_line,&process_security,&process_security,TRUE,CREATE_SUSPENDED|CREATE_NO_WINDOW|EXTENDED_STARTUPINFO_PRESENT|CREATE_UNICODE_ENVIRONMENT,(void*)environment,working_directory,&start.StartupInfo,&w->process)!=0;DeleteProcThreadAttributeList(start.lpAttributeList);if(!ok)goto done;EnterCriticalSection(&state_lock);w->live=1;w->deadline=now()+(target_plan?target_plan->timeout:w==&sync_worker?20000:180000);LeaveCriticalSection(&state_lock);
 if(!AssignProcessToJobObject(w->job,w->process.hProcess)){TerminateProcess(w->process.hProcess,4);if(WaitForSingleObject(w->process.hProcess,10000)!=WAIT_OBJECT_0){ok=0;goto retained;}ok=0;goto done;}
 if(ResumeThread(w->process.hThread)==(DWORD)-1){TerminateJobObject(w->job,4);if(WaitForSingleObject(w->process.hProcess,10000)!=WAIT_OBJECT_0){ok=0;goto retained;}ok=0;goto done;}CloseHandle(w->process.hThread);w->process.hThread=0;w->frame=0;w->remaining=0;w->aggregate=0;
 retained:if(!ok&&w->live&&WaitForSingleObject(w->process.hProcess,0)!=WAIT_OBJECT_0){for(i=0;i<total;i++)CloseHandle(inherited[i]);return 0;}
 done:for(i=0;i<total;i++)CloseHandle(inherited[i]);if(stdin_read)CloseHandle(stdin_read);if(stdout_write)CloseHandle(stdout_write);if(stderr_write)CloseHandle(stderr_write);if(!ok)dispose(w);return ok;}
static int quiet_error(struct worker*w){DWORD n;if(!PeekNamedPipe(w->error,0,0,0,&n,0))return 0;return n==0;}
static int line(struct worker*w,unsigned char*out,size_t*length){DWORD n,got;size_t used=0;uint64_t end=now()+20000;while(now()<end&&now()<w->deadline&&node_alive()){
 if(!quiet_error(w))return 0;if(PeekNamedPipe(w->output,0,0,0,&n,0)&&n){if(!ReadFile(w->output,discard,1,&got,0)||got!=1)return 0;if(discard[0]=='\n'){if(used&&out[used-1]=='\r')used--;*length=used;return used>0;}if(used>=16384)return 0;out[used++]=discard[0];continue;}if(WaitForSingleObject(w->process.hProcess,0)!=WAIT_TIMEOUT)return 0;Sleep(2);}return 0;}
static int sync_result(struct worker*w,unsigned char*out,size_t*length){
 DWORD n,got,code,pipe_error;size_t used=0;int exited;uint64_t end=now()+20000;
 while(now()<end&&node_alive()){
  exited=WaitForSingleObject(w->process.hProcess,0)==WAIT_OBJECT_0;
  if(PeekNamedPipe(w->error,0,0,0,&n,0)){if(n)return 0;}
  else {pipe_error=GetLastError();if(pipe_error!=ERROR_BROKEN_PIPE||WaitForSingleObject(w->process.hProcess,0)!=WAIT_OBJECT_0)return 0;exited=1;}
  if(PeekNamedPipe(w->output,0,0,0,&n,0)){
   if(n){if(n>16384-used||!ReadFile(w->output,out+used,n,&got,0)||!got)return 0;used+=got;continue;}
  }else {pipe_error=GetLastError();if(pipe_error!=ERROR_BROKEN_PIPE||WaitForSingleObject(w->process.hProcess,0)!=WAIT_OBJECT_0)return 0;exited=1;}
  if(exited){
   if(PeekNamedPipe(w->error,0,0,0,&n,0)){if(n)return 0;}
   else {pipe_error=GetLastError();if(pipe_error!=ERROR_BROKEN_PIPE||WaitForSingleObject(w->process.hProcess,0)!=WAIT_OBJECT_0)return 0;}
   if(!GetExitCodeProcess(w->process.hProcess,&code)||code||!used)return 0;*length=used;return reap(w,0);
  }
  Sleep(2);
 }
 return 0;
}
static int private_result(struct worker*w,unsigned char*out,size_t cap,size_t*length,int allow_empty){DWORD n,got,code,pipe_error;size_t used=0;int exited;while(now()<w->deadline&&node_alive()){exited=WaitForSingleObject(w->process.hProcess,0)==WAIT_OBJECT_0;if(PeekNamedPipe(w->error,0,0,0,&n,0)){if(n)return 0;}else {pipe_error=GetLastError();if(pipe_error!=ERROR_BROKEN_PIPE||WaitForSingleObject(w->process.hProcess,0)!=WAIT_OBJECT_0)return 0;exited=1;}if(PeekNamedPipe(w->output,0,0,0,&n,0)){if(n){if(n>cap-used||!ReadFile(w->output,out+used,n,&got,0)||!got)return 0;used+=got;continue;}}else {pipe_error=GetLastError();if(pipe_error!=ERROR_BROKEN_PIPE||WaitForSingleObject(w->process.hProcess,0)!=WAIT_OBJECT_0)return 0;exited=1;}if(exited){if(PeekNamedPipe(w->error,0,0,0,&n,0)){if(n)return 0;}else {pipe_error=GetLastError();if(pipe_error!=ERROR_BROKEN_PIPE||WaitForSingleObject(w->process.hProcess,0)!=WAIT_OBJECT_0)return 0;}if(!GetExitCodeProcess(w->process.hProcess,&code)||code||(!used&&!allow_empty))return 0;*length=used;return reap(w,0);}Sleep(2);}return 0;}
static int target_result(struct worker*w,unsigned char*out,size_t cap,size_t*length){return private_result(w,out,cap,length,0);}
static int read_exact(HANDLE h,unsigned char*b,size_t n,int idle){DWORD ready,got;size_t at=0;uint64_t end=now()+20000;while(at<n&&node_alive()){if(session.live&&now()>session.deadline)return 0;if(!PeekNamedPipe(h,0,0,0,&ready,0))return 0;if(!ready){if(!idle&&now()>end)return 0;Sleep(2);continue;}idle=0;if(!ReadFile(h,b+at,(DWORD)(n-at<ready?n-at:ready),&got,0)||!got)return 0;at+=got;}return at==n;}
#include "image-result.inc"
static void little(unsigned char*b,uint32_t n){unsigned i;for(i=0;i<4;i++)b[i]=(unsigned char)(n>>(i*8));}
static int respond(HANDLE reply,unsigned status,uint32_t id,size_t bytes){little(reply_bytes,(uint32_t)(8+bytes));reply_bytes[4]=1;reply_bytes[5]=(unsigned char)status;reply_bytes[6]=reply_bytes[7]=0;little(reply_bytes+8,id);return write_all(reply,reply_bytes,12+bytes);}
static uint32_t big(const unsigned char*b){return((uint32_t)b[0]<<24)|((uint32_t)b[1]<<16)|((uint32_t)b[2]<<8)|b[3];}
static int header(const unsigned char*b,size_t n){static const char magic[]="CLBKOUT1";size_t at=8;unsigned i;if(n<8||n>16384)return 0;for(i=0;i<8;i++)if(b[i]!=(unsigned char)magic[i])return 0;for(i=0;i<14;i++){uint32_t size;if(at+4>n)return 0;size=big(b+at);at+=4;if(!size||size>4096||at+size>n||!MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,(const char*)b+at,(int)size,wide_input,16384))return 0;at+=size;}return at==n;}
static int docker_env(void){DWORD n=GetSystemDirectoryW(docker_system_root,CL_MAX_PATH);if(n<12||n>=CL_MAX_PATH||CompareStringOrdinal(docker_system_root+n-9,-1,L"\\System32",-1,TRUE)!=CSTR_EQUAL)return 0;docker_system_root[n-9]=0;return cl_docker_environment((uint16_t*)docker_config_file,(uint16_t*)docker_system_root,(uint16_t*)docker_environment,CL_MAX_PATH*4);}
static int json_text(unsigned char*out,size_t cap,size_t*at,const char*s){size_t i;for(i=0;s[i];i++){if(*at>=cap)return 0;out[(*at)++]=(unsigned char)s[i];}return 1;}
static int json_wide(unsigned char*out,size_t cap,size_t*at,const WCHAR*s){int n,i;unsigned char c;n=WideCharToMultiByte(CP_UTF8,WC_ERR_INVALID_CHARS,s,-1,(char*)converted_path,sizeof(converted_path),0,0);if(n<1)return 0;if(!json_text(out,cap,at,"\""))return 0;for(i=0;i<n-1;i++){c=converted_path[i];if(c<32)return 0;if(c=='\\'||c=='\"'){if(!json_text(out,cap,at,"\\"))return 0;}if(*at>=cap)return 0;out[(*at)++]=c;}return json_text(out,cap,at,"\"");}
static int json_sha(unsigned char*out,size_t cap,size_t*at,const unsigned char*sha){static const char hex[]="0123456789abcdef";unsigned i;if(!json_text(out,cap,at,"\""))return 0;for(i=0;i<32;i++){if(*at+2>cap)return 0;out[(*at)++]=(unsigned char)hex[sha[i]>>4];out[(*at)++]=(unsigned char)hex[sha[i]&15];}return json_text(out,cap,at,"\"");}
static int json_number(unsigned char*out,size_t cap,size_t*at,uint32_t value){unsigned char digits[10];unsigned n=0;do{digits[n++]=(unsigned char)('0'+value%10);value/=10;}while(value);while(n){if(*at>=cap)return 0;out[(*at)++]=digits[--n];}return 1;}
static int json_file(unsigned char*out,size_t cap,size_t*at,const WCHAR*path,uint32_t bytes,const unsigned char*sha){return json_text(out,cap,at,"{\"path\":")&&json_wide(out,cap,at,path)&&json_text(out,cap,at,",\"bytes\":")&&json_number(out,cap,at,bytes)&&json_text(out,cap,at,",\"sha256\":")&&json_sha(out,cap,at,sha)&&json_text(out,cap,at,"}");}
static int context_descriptor(unsigned char*out,size_t cap,size_t*length){size_t at=0;if(!json_text(out,cap,&at,"{\"schemaVersion\":1,\"status\":\"context-held\",\"kind\":")||!json_text(out,cap,&at,context_state.kind==1?"\"current\"":"\"explicit\"")||!json_text(out,cap,&at,",\"config\":"))return 0;if(context_state.kind==1){if(!json_file(out,cap,&at,context_state.config_path,context_state.config_bytes,context_state.config_sha))return 0;}else if(!json_text(out,cap,&at,"null"))return 0;if(!json_text(out,cap,&at,",\"metadata\":")||!json_file(out,cap,&at,context_state.metadata_path,context_state.metadata_bytes,context_state.metadata_sha)||!json_text(out,cap,&at,"}"))return 0;*length=at;return 1;}
/* Serialized request loop only; keep the two path buffers off the CRT-free stack. */
static int docker_selector(size_t*length,unsigned preflight){static WCHAR value[CL_MAX_PATH],profile[CL_MAX_PATH];DWORD n;size_t at=0;static const WCHAR endpoint[]=L"npipe:////./pipe/dockerDesktopLinuxEngine";const char*selection;
 if(GetEnvironmentVariableW(L"DOCKER_CONFIG",value,CL_MAX_PATH))return 0;
 n=GetEnvironmentVariableW(L"DOCKER_CONTEXT",value,CL_MAX_PATH);if(n>=CL_MAX_PATH)return 0;
 if(n){if(CompareStringOrdinal(value,-1,L"desktop-linux",-1,FALSE)!=CSTR_EQUAL)return 0;selection="{\"context\":\"desktop-linux\",\"customConfig\":false,\"host\":\"\",\"profile\":";}
 else{n=GetEnvironmentVariableW(L"DOCKER_HOST",value,CL_MAX_PATH);if(n>=CL_MAX_PATH)return 0;if(n){if(CompareStringOrdinal(value,-1,endpoint,-1,FALSE)!=CSTR_EQUAL)return 0;selection="{\"context\":\"\",\"customConfig\":false,\"host\":\"npipe:////./pipe/dockerDesktopLinuxEngine\",\"profile\":";}else selection="{\"context\":\"\",\"customConfig\":false,\"host\":\"\",\"profile\":";}
 n=GetEnvironmentVariableW(L"USERPROFILE",profile,CL_MAX_PATH);if(n>=CL_MAX_PATH)return 0;if(!n)profile[0]=0;return json_text(selector_input,sizeof(selector_input),&at,selection)&&json_wide(selector_input,sizeof(selector_input),&at,profile)&&json_text(selector_input,sizeof(selector_input),&at,preflight?",\"preflight\":true}":"}")&&(*length=at)!=0;
}
/* One fixed bounded tuple on the primary parent's stderr. No worker bytes,
   paths, environment, OS errors or candidate records are forwarded. */
static void doctor_refusal(unsigned opcode,unsigned status){
 char text[96];size_t n=0,i;HANDLE error;static const char a[]="{\"schemaVersion\":1,\"operation\":";static const char b[]=",\"stage\":";static const char c[]=",\"status\":";
 if((opcode!=14&&opcode!=8)||(status!=4&&status!=5) )return;
 switch(doctor_stage){case 1:case 2:case 3:case 4:case 5:case 6:case 7:case 8:case 9:case 10:case 11:case 12:case 13:case 20:case 21:case 30:case 41:case 42:case 43:case 44:case 45:case 51:case 52:case 53:case 54:case 61:case 62:case 63:case 64:case 71:case 72:case 73:case 74:case 75:case 76:break;default:return;}
 for(i=0;a[i];i++){text[n++]=a[i];}if(opcode==14){text[n++]='1';text[n++]='4';}else text[n++]='8';
 for(i=0;b[i];i++){text[n++]=b[i];}if(doctor_stage>=10)text[n++]=(char)('0'+doctor_stage/10);text[n++]=(char)('0'+doctor_stage%10);
 for(i=0;c[i];i++){text[n++]=c[i];}text[n++]=(char)('0'+status);text[n++]='}';text[n++]='\n';error=GetStdHandle(STD_ERROR_HANDLE);if(error&&error!=INVALID_HANDLE_VALUE)write_all(error,(const unsigned char*)text,n);
}
static int docker_query(unsigned mode,const WCHAR*exe,size_t*selected){int ok=0;unsigned base=doctor_stage;docker_command=mode;if((doctor_stage=base+1,cl_check_docker_guards())&&(doctor_stage=base+2,launch(&sync_worker,exe,0,docker_guards,docker_guard_count,docker_environment))){CloseHandle(sync_worker.input);sync_worker.input=0;ok=(doctor_stage=base+3,sync_result(&sync_worker,request_bytes,selected))&&(doctor_stage=base+4,cl_check_docker_guards());}docker_command=0;if(sync_worker.live)reap(&sync_worker,1);return ok;}
static int docker_result(const WCHAR*environment,size_t*output){size_t selected=0,server_bytes=0,compose_bytes=0,i;(void)environment;doctor_stage=30;if(!docker_env())return 0;if(!preflight_pending)return (doctor_stage=40,docker_query(0,docker_exe,&selected))&&(doctor_stage=45,cl_docker_engine_result(request_bytes,selected,reply_bytes+12,CL_MAX_REQUEST-12,output));
 doctor_stage=50;if(!docker_query(1,docker_exe,&selected)||selected>sizeof(server_facts)){return 0;}server_bytes=selected;for(i=0;i<selected;i++)server_facts[i]=request_bytes[i];
 doctor_stage=60;if(!docker_query(2,compose_exe,&selected)||selected>sizeof(compose_facts)){return 0;}compose_bytes=selected;for(i=0;i<selected;i++)compose_facts[i]=request_bytes[i];
 doctor_stage=70;if(!docker_query(1,docker_exe,&selected)||selected!=server_bytes){return 0;}doctor_stage=75;for(i=0;i<selected;i++)if(server_facts[i]!=request_bytes[i])return 0;
 doctor_stage=76;return cl_docker_preflight_result(server_facts,server_bytes,compose_facts,compose_bytes,docker_sha,compose_sha,reply_bytes+12,CL_MAX_REQUEST-12,output);
}

static int target_run(void*ctx,const struct cl_target_plan*p,unsigned char*out,size_t cap,struct cl_target_result*r){size_t n=0;int ok=0;(void)ctx;if(!p||p->executable>1||(p->executable==1&&(!compose_exe[0]||!compose_environment[0]))||p->allow_empty<0||p->allow_empty>1)return 0;target_plan=p;if(cl_check_docker_guards()&&cl_target_windows_guards(target_guards,docker_guard_count,&target_guard_count)){unsigned i;for(i=0;i<docker_guard_count;i++)target_guards[i]=docker_guards[i];if(launch(&sync_worker,p->executable==1?compose_exe:docker_exe,0,target_guards,target_guard_count,p->executable==1?compose_environment:docker_environment)&&(!p->input_bytes||write_all(sync_worker.input,p->input,p->input_bytes))){CloseHandle(sync_worker.input);sync_worker.input=0;ok=p->opcode==37&&p->executable==0&&p->argc==9?cache_image_result(&sync_worker,p->argv[8],out,cap,&n)!=0:p->allow_empty?private_result(&sync_worker,out,cap,&n,1):target_result(&sync_worker,out,cap,&n);}}target_plan=0;target_reaped=!sync_worker.live||reap(&sync_worker,1);r->reaped=target_reaped;r->exit_code=ok?0:4;r->stderr_bytes=0;r->bytes=ok?n:0;return ok&&target_reaped;}
static int target_caddy(const struct cl_target_request*q);
static int target_current(void*ctx,const struct cl_target_request*q,int effect){(void)ctx;(void)effect;return cl_target_windows_current(q)&&((q->opcode!=22&&q->opcode!=25&&q->opcode!=34)||target_caddy(q));}
static int target_package(void*ctx){(void)ctx;return cl_check_docker_guards();}
static int target_engine(void*ctx,struct cl_target_string expected){size_t n=0,m=0,i;unsigned char formatted[512];(void)ctx;if(!docker_query(0,docker_exe,&n)||!cl_docker_engine_result(request_bytes,n,formatted,sizeof(formatted),&m)||m<11+expected.n)return 0;for(i=0;i<expected.n;i++)if(formatted[11+i]!=expected.p[i])return 0;return formatted[11+expected.n]=='"';}
static int template_text(char*out,size_t*at,const char*s){size_t i;for(i=0;s[i];i++){if(*at>=16000)return 0;out[(*at)++]=s[i];}return 1;}
static int template_value(char*out,size_t*at,struct cl_target_string v){size_t i;if(!template_text(out,at,"\""))return 0;for(i=0;i<v.n;i++){unsigned c=v.p[i];if(c=='\\'||c=='"'){if(!template_text(out,at,"\\"))return 0;}if(c<32||*at>=16000)return 0;out[(*at)++]=(char)c;}return template_text(out,at,"\"");}
static int template_equal(char*out,size_t*at,const char*key,struct cl_target_string v){return template_text(out,at," (eq ")&&template_text(out,at,key)&&template_text(out,at," ")&&template_value(out,at,v)&&template_text(out,at,")");}
static int target_helper(void*ctx,const struct cl_target_request*q,const struct cl_target_helper*h){static char format[16001],cid[65],image[72],compose[3072];struct cl_target_plan p;struct cl_target_result r={0,0,0,0};size_t at=0,i,n;static const char marker[]="CL_TARGET_STRUCTURAL_V1\n";struct cl_target_string image_value,compose_value;unsigned char*out=target_facts;(void)ctx;if(q->opcode==21||q->opcode==26){if(h->opcode!=17)return 0;}else if(q->opcode==24){if(h->opcode!=18)return 0;}else if(q->opcode<16||q->opcode>18||h->opcode!=q->opcode)return 0;for(i=0;i<64;i++)cid[i]=(char)q->container.p[i];cid[64]=0;for(i=0;i<7;i++)image[i]="sha256:"[i];for(i=0;i<64;i++)image[7+i]=(char)q->image.p[i];image[71]=0;image_value.p=(const unsigned char*)image;image_value.n=71;if(q->root.n+13>sizeof(compose))return 0;for(i=0;i<q->root.n;i++)compose[i]=(char)q->root.p[i];for(i=0;i<13;i++)compose[q->root.n+i]="\\compose.yaml"[i];compose_value.p=(const unsigned char*)compose;compose_value.n=q->root.n+13;
 if(!template_text(format,&at,"{{$clean := true}}{{range .Config.Env}}{{$key := index (split . \"=\") 0}}{{if or (eq $key \"GLIBC_TUNABLES\") (and (ge (len $key) 3) (eq (slice $key 0 3) \"LD_\"))}}{{$clean = false}}{{end}}{{end}}{{if and $clean .State.Running .HostConfig.ReadonlyRootfs (not .HostConfig.Privileged) (eq (len .HostConfig.CapAdd) 0) (eq (len .HostConfig.CapDrop) 1) (eq (index .HostConfig.CapDrop 0) \"ALL\") (eq (len .HostConfig.Devices) 0) (eq (len .HostConfig.DeviceRequests) 0) (eq (len .HostConfig.Tmpfs) 0) (eq (len .HostConfig.SecurityOpt) 1) (eq (index .HostConfig.SecurityOpt 0) \"no-new-privileges:true\") (eq (index .Config.Labels \"com.docker.compose.service\") \"web\") (eq (len .Mounts) 1) (eq (index .Mounts 0).Type \"volume\") (eq (index .Mounts 0).Driver \"local\") (eq (index .Mounts 0).Destination \"/data\") (index .Mounts 0).RW")||!template_equal(format,&at,".Id",q->container)||!template_equal(format,&at,".Image",image_value)||!template_equal(format,&at,"(index .Config.Labels \"com.docker.compose.project\")",q->project)||!template_equal(format,&at,"(index .Config.Labels \"com.docker.compose.config-hash\")",q->config_hash)||!template_equal(format,&at,"(index .Config.Labels \"com.docker.compose.project.working_dir\")",q->root)||!template_equal(format,&at,"(index .Config.Labels \"com.docker.compose.project.config_files\")",compose_value)||!template_text(format,&at," (eq (index .Mounts 0).Name \"")||at+q->project.n+12>=sizeof(format)){return 0;}
 for(i=0;i<q->project.n;i++)format[at++]=(char)q->project.p[i];
 if(!template_text(format,&at,"_web-data\")}}CL_TARGET_STRUCTURAL_V1{{end}}")){return 0;}
 format[at]=0;p.opcode=15;p.executable=0;p.allow_empty=0;p.timeout=10000;p.input=0;p.input_bytes=0;p.output_cap=64;p.argc=9;p.argv[0]="--host";p.argv[1]="npipe:////./pipe/dockerDesktopLinuxEngine";p.argv[2]="--config";p.argv[3]=target_config_utf8;p.argv[4]="container";p.argv[5]="inspect";p.argv[6]="--format";p.argv[7]=format;p.argv[8]=cid;
 if(!target_run(0,&p,out,64,&r)){return 0;}
 n=r.bytes;for(i=0;i<n;i++)if(i>=sizeof(marker)-1||out[i]!=(unsigned char)marker[i])return 0;return n==sizeof(marker)-1;}
static int target_caddy(const struct cl_target_request*q){static char format[16001],cid[65],image[72],compose[3072];struct cl_target_plan p;struct cl_target_result r={0,0,0,0};size_t at=0,i,n;static const char marker[]="CL_TARGET_CADDY_V1\n";struct cl_target_string image_value,compose_value;if(q->opcode!=22&&q->opcode!=25&&q->opcode!=34)return 0;for(i=0;i<64;i++)cid[i]=(char)q->container.p[i];cid[64]=0;for(i=0;i<7;i++)image[i]="sha256:"[i];for(i=0;i<64;i++)image[7+i]=(char)q->image.p[i];image[71]=0;image_value.p=(const unsigned char*)image;image_value.n=71;if(q->root.n+13>sizeof(compose))return 0;for(i=0;i<q->root.n;i++)compose[i]=(char)q->root.p[i];for(i=0;i<13;i++)compose[q->root.n+i]="\\compose.yaml"[i];compose_value.p=(const unsigned char*)compose;compose_value.n=q->root.n+13;
 if(!template_text(format,&at,"{{$data := false}}{{$config := false}}{{$file := false}}{{range .Mounts}}{{if and (eq .Type \"volume\") (eq .Driver \"local\") (eq .Destination \"/data\") .RW (eq .Name \"")||at+q->project.n+14>=sizeof(format))return 0;
 for(i=0;i<q->project.n;i++)format[at++]=(char)q->project.p[i];
 if(!template_text(format,&at,"_caddy-data\")}}{{$data = true}}{{else if and (eq .Type \"volume\") (eq .Driver \"local\") (eq .Destination \"/config\") .RW (eq .Name \"")||at+q->project.n+16>=sizeof(format))return 0;
 for(i=0;i<q->project.n;i++)format[at++]=(char)q->project.p[i];
 if(!template_text(format,&at,"_caddy-config\")}}{{$config = true}}{{else if and (eq .Type \"bind\") (eq .Destination \"/etc/caddy/Caddyfile\") (not .RW)}}{{$file = true}}{{end}}{{end}}{{if and $data $config $file (eq (len .Mounts) 3) .State.Running (not .HostConfig.Privileged) (eq (index .Config.Labels \"com.docker.compose.service\") \"caddy\")")||!template_equal(format,&at,".Id",q->container)||!template_equal(format,&at,".Image",image_value)||!template_equal(format,&at,"(index .Config.Labels \"com.docker.compose.project\")",q->project)||!template_equal(format,&at,"(index .Config.Labels \"com.docker.compose.config-hash\")",q->config_hash)||!template_equal(format,&at,"(index .Config.Labels \"com.docker.compose.project.working_dir\")",q->root)||!template_equal(format,&at,"(index .Config.Labels \"com.docker.compose.project.config_files\")",compose_value)||!template_text(format,&at,"}}CL_TARGET_CADDY_V1{{end}}"))return 0;
 format[at]=0;p.opcode=15;p.executable=0;p.allow_empty=0;p.timeout=10000;p.input=0;p.input_bytes=0;p.output_cap=64;p.argc=9;p.argv[0]="--host";p.argv[1]="npipe:////./pipe/dockerDesktopLinuxEngine";p.argv[2]="--config";p.argv[3]=target_config_utf8;p.argv[4]="container";p.argv[5]="inspect";p.argv[6]="--format";p.argv[7]=format;p.argv[8]=cid;if(!target_run(0,&p,target_facts,64,&r)){return 0;}
 n=r.bytes;for(i=0;i<n;i++)if(i>=sizeof(marker)-1||target_facts[i]!=(unsigned char)marker[i])return 0;return n==sizeof(marker)-1;}

static int target_database_url(void*ctx,const struct cl_target_request*q,unsigned char*out,size_t cap,size_t*used){(void)ctx;(void)q;return cl_target_windows_database_url(out,cap,used);}
int cl_broker_run(HANDLE request,HANDLE reply,HANDLE node,const WCHAR*exe,HANDLE*guards,unsigned count,const WCHAR*environment){uint32_t previous=0;unsigned status;size_t output;int clean=1;struct cl_request r;node_process=node;node_guard_count=count;InitializeCriticalSection(&state_lock);watch_stop=0;operation_deadline=0;if(!duplicate(GetCurrentThread(),&main_thread))return 0;watch_thread=CreateThread(0,0,watchdog,0,0,0);if(!watch_thread){CloseHandle(main_thread);DeleteCriticalSection(&state_lock);return 0;}
 while(node_alive()){unsigned char size[4];uint32_t n;if(!read_exact(request,size,4,!config_write.declared))break;n=(uint32_t)size[0]|((uint32_t)size[1]<<8)|((uint32_t)size[2]<<16)|((uint32_t)size[3]<<24);if(n<8||n>CL_MAX_REQUEST||!read_exact(request,request_bytes,n,0)||!cl_parse_request(request_bytes,n,previous,&r))break;previous=r.id;status=4;output=0;doctor_stage=1;EnterCriticalSection(&state_lock);operation_deadline=now()+20000;LeaveCriticalSection(&state_lock);
  if(target_poison){status=5;goto response;}
  if((target_capture.active||root_capture.active)&&r.opcode!=19&&r.opcode!=20)goto response;
  if(config_write.declared&&(r.opcode!=10&&r.opcode!=11)){cl_config_write_reset(&config_write);goto response;}
  if(r.opcode>=9&&r.opcode<=11){int step=cl_config_write_step(&config_write,r.opcode,r.body,r.bytes,session.live);if(step==1)status=0;else if(step==2){status=5;if(MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,(const char*)config_write.body,(int)config_write.used,0,0)&&launch(&sync_worker,exe,cl_bridge_script,guards,count,environment)&&write_all(sync_worker.input,config_write.body,config_write.used)){CloseHandle(sync_worker.input);sync_worker.input=0;if(sync_result(&sync_worker,reply_bytes+12,&output))status=0;}if(sync_worker.live)reap(&sync_worker,1);cl_config_write_reset(&config_write);}}
  else if(r.opcode==1||r.opcode==2||r.opcode==12){const WCHAR*script=r.opcode==1?cl_protect_script:r.opcode==12?cl_setup_script:cl_catalog_json(13,r.body,r.bytes,1)?cl_registry_script:cl_bridge_script;
   if(cl_catalog_json(r.opcode,r.body,r.bytes,session.live)&&MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,(const char*)r.body,(int)r.bytes,wide_input,16384)){
    status=5;if(launch(&sync_worker,exe,script,guards,count,environment)&&write_all(sync_worker.input,r.body,r.bytes)){CloseHandle(sync_worker.input);sync_worker.input=0;if(sync_result(&sync_worker,reply_bytes+12,&output))status=0;}if(sync_worker.live)reap(&sync_worker,1);
   }
  }else if(r.opcode==7||r.opcode==14){size_t selector_bytes=0;
   if((doctor_stage=2,!context_pending)&&(doctor_stage=3,cl_catalog_json(r.opcode,r.body,r.bytes,session.live))&&(doctor_stage=4,docker_selector(&selector_bytes,r.opcode==14))){
    struct cl_docker_candidate candidate;size_t selected=0;status=5;
    if((doctor_stage=5,launch(&sync_worker,exe,cl_docker_script,guards,count,environment))&&(doctor_stage=6,write_all(sync_worker.input,selector_input,selector_bytes))){
     CloseHandle(sync_worker.input);sync_worker.input=0;
     if((doctor_stage=7,sync_result(&sync_worker,reply_bytes+12,&selected))&&(doctor_stage=8,cl_parse_docker_candidate(reply_bytes+12,selected,&candidate))&&(doctor_stage=9,cl_admit_docker(&candidate,docker_exe,docker_config,docker_config_file,docker_guards,&docker_guard_count))&&(doctor_stage=10,((r.opcode==7&&!candidate.compose_bytes)||(r.opcode==14&&cl_admit_compose(&candidate,compose_exe,docker_guards,&docker_guard_count))))){
      unsigned h;preflight_pending=r.opcode==14;for(h=0;h<32;h++){docker_sha[h]=candidate.docker_sha[h];compose_sha[h]=candidate.compose_sha?candidate.compose_sha[h]:0;}
      if(candidate.context_kind){if((doctor_stage=11,cl_admit_context(&candidate,&context_state,docker_guards,&docker_guard_count))&&(doctor_stage=12,persist_node_guards())&&(doctor_stage=13,context_descriptor(reply_bytes+12,CL_MAX_REQUEST-12,&output))){context_pending=1;status=0;}}
      else if((doctor_stage=12,persist_node_guards())&&docker_result(environment,&output))status=0;
     }
    }
    if(sync_worker.live)reap(&sync_worker,1);
   }
  }else if(r.opcode==8){if((doctor_stage=20,context_pending)&&(doctor_stage=21,cl_match_docker_context_selection(r.body,r.bytes,context_state.kind,context_state.config_sha,context_state.metadata_sha))){status=5;if(docker_result(environment,&output)){context_pending=0;status=0;}}}
  else if(r.opcode>=27&&r.opcode<=37){struct cl_target_request q;struct cl_root_ops ops;size_t at;int converted;if(session.live||sync_worker.live||context_pending||!docker_exe[0]||!compose_exe[0]||!r.bytes||r.bytes>sizeof(target_packet))goto response;
   for(at=0;at<r.bytes;at++)target_packet[at]=r.body[at];if(!cl_root_parse(target_packet,r.bytes,&q)||q.opcode!=r.opcode)goto root_done;
   converted=WideCharToMultiByte(CP_UTF8,WC_ERR_INVALID_CHARS,docker_config,-1,target_config_utf8,sizeof(target_config_utf8),0,0);if(converted<1||!docker_env()||!cl_compose_env_file(compose_empty_env)||!cl_compose_environment((uint16_t*)docker_config_file,(uint16_t*)docker_config,(uint16_t*)docker_system_root,(uint16_t*)compose_environment,CL_MAX_PATH*6)||WideCharToMultiByte(CP_UTF8,WC_ERR_INVALID_CHARS,compose_empty_env,-1,compose_empty_utf8,sizeof(compose_empty_utf8),0,0)<1)goto root_done;
   target_reaped=1;if(!cl_target_windows_prepare(&q,node_process))goto root_close;ops.target.ctx=0;ops.target.config_directory=target_config_utf8;ops.target.helpers=0;ops.target.helper_count=0;ops.target.current=target_current;ops.target.guards=target_package;ops.target.engine=target_engine;ops.target.helper=0;ops.target.database_url=0;ops.target.run=target_run;ops.empty_env_file=compose_empty_utf8;
   EnterCriticalSection(&state_lock);operation_deadline=now()+(r.opcode>=31&&r.opcode<=33?180000:90000);LeaveCriticalSection(&state_lock);status=(unsigned)cl_root_begin(&root_capture,&ops,r.id,target_packet,r.bytes);if(!status){little(reply_bytes+12,root_capture.source);little(reply_bytes+16,(uint32_t)root_capture.used);output=8;}
   root_close:if(!target_reaped||sync_worker.live){target_poison=1;status=5;cl_root_abort(&root_capture);}else if(!cl_target_windows_close()){target_poison=1;status=5;cl_root_abort(&root_capture);}root_done:for(at=0;at<sizeof(target_packet);at++)target_packet[at]=0;
  }
  else if((r.opcode>=15&&r.opcode<=18)||(r.opcode>=21&&r.opcode<=26)){struct cl_target_request q;size_t at;struct cl_target_ops ops;if(session.live||sync_worker.live||context_pending||!docker_exe[0]||!r.bytes||r.bytes>sizeof(target_packet))goto response;for(at=0;at<r.bytes;at++)target_packet[at]=r.body[at];if(!cl_target_parse(target_packet,r.bytes,&q)||q.opcode!=r.opcode)goto target_done;{int converted=WideCharToMultiByte(CP_UTF8,WC_ERR_INVALID_CHARS,docker_config,-1,target_config_utf8,sizeof(target_config_utf8),0,0);if(converted<1||!docker_env())goto target_done;}target_reaped=1;if(!cl_target_windows_prepare(&q,node_process))goto target_close;ops.ctx=0;ops.config_directory=target_config_utf8;ops.helpers=cl_target_helpers;ops.helper_count=3;ops.current=target_current;ops.guards=target_package;ops.engine=target_engine;ops.helper=target_helper;ops.database_url=target_database_url;ops.run=target_run;target_reaped=1;EnterCriticalSection(&state_lock);operation_deadline=now()+((r.opcode==16||r.opcode==17||r.opcode==18||r.opcode==24)?160000:40000);LeaveCriticalSection(&state_lock);status=(unsigned)cl_target_begin(&target_capture,&ops,r.id,target_packet,r.bytes);if(!status){little(reply_bytes+12,target_capture.source);little(reply_bytes+16,(uint32_t)target_capture.used);output=8;}
   target_close:if(!target_reaped||sync_worker.live){target_poison=1;status=5;cl_target_abort(&target_capture);}else if(!cl_target_windows_close()){target_poison=1;status=5;cl_target_abort(&target_capture);}target_done:for(at=0;at<sizeof(target_packet);at++)target_packet[at]=0;
  }else if(r.opcode==19){size_t used=0;int done=0;if(r.bytes==8){uint32_t source=(uint32_t)r.body[0]|((uint32_t)r.body[1]<<8)|((uint32_t)r.body[2]<<16)|((uint32_t)r.body[3]<<24),offset=(uint32_t)r.body[4]|((uint32_t)r.body[5]<<8)|((uint32_t)r.body[6]<<16)|((uint32_t)r.body[7]<<24);status=(unsigned)(root_capture.active?cl_root_read(&root_capture,source,offset,reply_bytes+12,CL_TARGET_CHUNK_MAX,&used,&done):cl_target_read(&target_capture,source,offset,reply_bytes+12,CL_TARGET_CHUNK_MAX,&used,&done));if(!status)output=used;}}else if(r.opcode==20){if(r.bytes==4){uint32_t source=(uint32_t)r.body[0]|((uint32_t)r.body[1]<<8)|((uint32_t)r.body[2]<<16)|((uint32_t)r.body[3]<<24);status=(unsigned)(root_capture.active?cl_root_cancel(&root_capture,source):cl_target_cancel(&target_capture,source));}}
  else if(r.opcode==3){if(!session.live&&header(r.body,r.bytes)){status=5;if(launch(&session,exe,cl_backup_script,guards,count,environment)&&write_all(session.input,r.body,r.bytes)&&line(&session,reply_bytes+12,&output))status=0;if(status)reap(&session,1);}}
  else if(r.opcode==4&&session.live){const unsigned char*b=r.body;size_t bytes=r.bytes;if(!session.remaining){uint32_t cap;if(bytes<6||b[0]!=1||b[1]!=session.frame||session.frame>=10)goto response;cap=session.frame<4?67108864:session.frame==9?65536:1048576;{uint32_t declared=big(b+2);if(declared>cap||session.aggregate+declared>273743872)goto response;session.aggregate+=declared;session.remaining=declared+6;}}
   if(bytes>session.remaining)goto response;status=5;if(write_all(session.input,b,bytes)){session.remaining-=(uint32_t)bytes;if(session.remaining){status=0;}else if(line(&session,reply_bytes+12,&output)){session.frame++;status=0;}}if(status)reap(&session,1);
  }else if(r.opcode==5&&session.live){if(session.frame==10&&!session.remaining&&r.bytes==1&&r.body[0]==2){status=5;if(write_all(session.input,r.body,1)){CloseHandle(session.input);session.input=0;if(line(&session,reply_bytes+12,&output)&&reap(&session,0))status=0;}if(session.live)reap(&session,1);}}
  else if(r.opcode==6){status=5;if(session.live)reap(&session,1);}
  response:{size_t wipe;volatile unsigned char*private_bytes=request_bytes+8;for(wipe=0;wipe<r.bytes;wipe++)private_bytes[wipe]=0;}if(status){output=0;doctor_refusal(r.opcode,status);}if(!respond(reply,status,r.id,output))break;{size_t wipe;volatile unsigned char*sent=reply_bytes+12;for(wipe=0;wipe<output;wipe++)sent[wipe]=0;}EnterCriticalSection(&state_lock);operation_deadline=0;LeaveCriticalSection(&state_lock);
 }
 cl_root_abort(&root_capture);cl_target_abort(&target_capture);cl_config_write_reset(&config_write);if(session.live&&!reap(&session,1))clean=0;if(sync_worker.live&&!reap(&sync_worker,1))clean=0;InterlockedExchange(&watch_stop,1);if(WaitForSingleObject(watch_thread,10000)!=WAIT_OBJECT_0)return 0;CloseHandle(watch_thread);CloseHandle(main_thread);DeleteCriticalSection(&state_lock);return clean;}
