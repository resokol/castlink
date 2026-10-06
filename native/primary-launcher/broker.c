#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include "core.h"
#include "security.h"
#include "protocol.h"
#include "broker.h"
#include "docker-windows.h"
#include "catalog.h"
#include "managed.h"
struct worker{PROCESS_INFORMATION process;HANDLE input,output,error,job,scratch;int live;unsigned frame;uint32_t remaining;uint64_t aggregate,deadline;};
static struct worker session,sync_worker;
static struct cl_config_write config_write;
static WCHAR docker_exe[CL_MAX_PATH],docker_config[CL_MAX_PATH],docker_environment[CL_MAX_PATH*4],docker_system_root[CL_MAX_PATH];
static HANDLE docker_guards[CL_MAX_GUARDS];
static struct cl_native_context context_state;
static unsigned docker_guard_count,node_guard_count,context_pending;
static unsigned char selector_input[8192],converted_path[4096];
static DECLSPEC_ALIGN(16) unsigned char request_bytes[CL_MAX_REQUEST],reply_bytes[CL_MAX_REQUEST],discard[1024],attributes[65536];
static WCHAR command_line[CL_MAX_COMMAND],wide_input[16384],working_directory[CL_MAX_PATH];
static WCHAR worker_environment[CL_MAX_PATH*4+128];
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
 if(script){const WCHAR*scratch_path=0;HANDLE remote;if(!cl_worker_scratch_create(w==&session?1:0,&w->scratch,&scratch_path)||!cl_worker_environment((const uint16_t*)environment,(const uint16_t*)scratch_path,(uint16_t*)worker_environment,sizeof(worker_environment)/sizeof(worker_environment[0])))goto done;if(!DuplicateHandle(GetCurrentProcess(),w->scratch,node_process,&remote,0,TRUE,DUPLICATE_SAME_ACCESS)||!duplicate(w->scratch,&inherited[total]))goto done;total++;environment=worker_environment;}
 stdio_index=count+total;
 for(i=0;i<count;i++){if(!duplicate(guards[i],&inherited[total]))goto done;total++;}
 inherited[total++]=stdin_read;stdin_read=0;inherited[total++]=stdout_write;stdout_write=0;inherited[total++]=stderr_write;stderr_write=0;
 {unsigned last=0;for(i=0;exe[i];i++){if(i>=CL_MAX_PATH-1)goto done;working_directory[i]=exe[i];if(exe[i]==L'\\')last=i;}if(last<3)goto done;working_directory[last]=0;}
 if(!cl_quote((uint16_t*)command_line,CL_MAX_COMMAND,&used,(const uint16_t*)exe))goto done;
 if(script){static const WCHAR flags[]=L" -NoLogo -NoProfile -NonInteractive -Command ";for(i=0;flags[i];i++){if(used>=CL_MAX_COMMAND-1)goto done;command_line[used++]=flags[i];}}
 if(script){if(!cl_quote((uint16_t*)command_line,CL_MAX_COMMAND,&used,(const uint16_t*)script))goto done;}
 else{const WCHAR*args[7]={L"--host",L"npipe:////./pipe/dockerDesktopLinuxEngine",L"--config",docker_config,L"info",L"--format",L"{\"ID\":{{json .ID}}}"};unsigned a;for(a=0;a<7;a++){if(used>=CL_MAX_COMMAND-1)goto done;command_line[used++]=L' ';if(!cl_quote((uint16_t*)command_line,CL_MAX_COMMAND,&used,(const uint16_t*)args[a]))goto done;}}
 start.StartupInfo.cb=sizeof(start);start.StartupInfo.dwFlags=STARTF_USESTDHANDLES;start.StartupInfo.hStdInput=inherited[stdio_index];start.StartupInfo.hStdOutput=inherited[stdio_index+1];start.StartupInfo.hStdError=inherited[stdio_index+2];start.lpAttributeList=(LPPROC_THREAD_ATTRIBUTE_LIST)attributes;
 if(!InitializeProcThreadAttributeList(start.lpAttributeList,1,0,&size))goto done;
 if(!UpdateProcThreadAttribute(start.lpAttributeList,0,PROC_THREAD_ATTRIBUTE_HANDLE_LIST,inherited,total*sizeof(HANDLE),0,0)){DeleteProcThreadAttributeList(start.lpAttributeList);goto done;}
 w->job=CreateJobObjectW(0,0);job.BasicLimitInformation.LimitFlags=JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
 if(!w->job||!SetInformationJobObject(w->job,JobObjectExtendedLimitInformation,&job,sizeof(job))){DeleteProcThreadAttributeList(start.lpAttributeList);goto done;}
 if(!cl_private_security(&process_security,FALSE)){DeleteProcThreadAttributeList(start.lpAttributeList);goto done;}
 ok=CreateProcessW(exe,command_line,&process_security,&process_security,TRUE,CREATE_SUSPENDED|CREATE_NO_WINDOW|EXTENDED_STARTUPINFO_PRESENT|CREATE_UNICODE_ENVIRONMENT,(void*)environment,working_directory,&start.StartupInfo,&w->process)!=0;DeleteProcThreadAttributeList(start.lpAttributeList);if(!ok)goto done;EnterCriticalSection(&state_lock);w->live=1;w->deadline=now()+(w==&sync_worker?20000:180000);LeaveCriticalSection(&state_lock);
 if(!AssignProcessToJobObject(w->job,w->process.hProcess)){TerminateProcess(w->process.hProcess,4);if(WaitForSingleObject(w->process.hProcess,10000)!=WAIT_OBJECT_0){ok=0;goto retained;}ok=0;goto done;}
 if(ResumeThread(w->process.hThread)==(DWORD)-1){TerminateJobObject(w->job,4);if(WaitForSingleObject(w->process.hProcess,10000)!=WAIT_OBJECT_0){ok=0;goto retained;}ok=0;goto done;}CloseHandle(w->process.hThread);w->process.hThread=0;w->frame=0;w->remaining=0;w->aggregate=0;
 retained:if(!ok&&w->live&&WaitForSingleObject(w->process.hProcess,0)!=WAIT_OBJECT_0){for(i=0;i<total;i++)CloseHandle(inherited[i]);return 0;}
 done:for(i=0;i<total;i++)CloseHandle(inherited[i]);if(stdin_read)CloseHandle(stdin_read);if(stdout_write)CloseHandle(stdout_write);if(stderr_write)CloseHandle(stderr_write);if(!ok)dispose(w);return ok;}
static int quiet_error(struct worker*w){DWORD n;if(!PeekNamedPipe(w->error,0,0,0,&n,0))return 0;return n==0;}
static int line(struct worker*w,unsigned char*out,size_t*length){DWORD n,got;size_t used=0;uint64_t end=now()+20000;while(now()<end&&now()<w->deadline&&node_alive()){
 if(!quiet_error(w))return 0;if(PeekNamedPipe(w->output,0,0,0,&n,0)&&n){if(!ReadFile(w->output,discard,1,&got,0)||got!=1)return 0;if(discard[0]=='\n'){if(used&&out[used-1]=='\r')used--;*length=used;return used>0;}if(used>=16384)return 0;out[used++]=discard[0];continue;}if(WaitForSingleObject(w->process.hProcess,0)!=WAIT_TIMEOUT)return 0;Sleep(2);}return 0;}
static int sync_result(struct worker*w,unsigned char*out,size_t*length){DWORD n,got,code;size_t used=0;uint64_t end=now()+20000;while(now()<end&&node_alive()){
 if(!quiet_error(w))return 0;if(PeekNamedPipe(w->output,0,0,0,&n,0)&&n){if(n>16384-used)return 0;if(!ReadFile(w->output,out+used,n,&got,0)||!got)return 0;used+=got;continue;}if(WaitForSingleObject(w->process.hProcess,0)==WAIT_OBJECT_0){if(!GetExitCodeProcess(w->process.hProcess,&code)||code||!used||!quiet_error(w))return 0;*length=used;return reap(w,0);}Sleep(2);}return 0;}
static int read_exact(HANDLE h,unsigned char*b,size_t n,int idle){DWORD ready,got;size_t at=0;uint64_t end=now()+20000;while(at<n&&node_alive()){if(session.live&&now()>session.deadline)return 0;if(!PeekNamedPipe(h,0,0,0,&ready,0))return 0;if(!ready){if(!idle&&now()>end)return 0;Sleep(2);continue;}idle=0;if(!ReadFile(h,b+at,(DWORD)(n-at<ready?n-at:ready),&got,0)||!got)return 0;at+=got;}return at==n;}
static void little(unsigned char*b,uint32_t n){unsigned i;for(i=0;i<4;i++)b[i]=(unsigned char)(n>>(i*8));}
static int respond(HANDLE reply,unsigned status,uint32_t id,size_t bytes){little(reply_bytes,(uint32_t)(8+bytes));reply_bytes[4]=1;reply_bytes[5]=(unsigned char)status;reply_bytes[6]=reply_bytes[7]=0;little(reply_bytes+8,id);return write_all(reply,reply_bytes,12+bytes);}
static uint32_t big(const unsigned char*b){return((uint32_t)b[0]<<24)|((uint32_t)b[1]<<16)|((uint32_t)b[2]<<8)|b[3];}
static int header(const unsigned char*b,size_t n){static const char magic[]="CLBKOUT1";size_t at=8;unsigned i;if(n<8||n>16384)return 0;for(i=0;i<8;i++)if(b[i]!=(unsigned char)magic[i])return 0;for(i=0;i<14;i++){uint32_t size;if(at+4>n)return 0;size=big(b+at);at+=4;if(!size||size>4096||at+size>n||!MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,(const char*)b+at,(int)size,wide_input,16384))return 0;at+=size;}return at==n;}
static int docker_env(void){DWORD n=GetSystemDirectoryW(docker_system_root,CL_MAX_PATH);if(n<12||n>=CL_MAX_PATH||CompareStringOrdinal(docker_system_root+n-9,-1,L"\\System32",-1,TRUE)!=CSTR_EQUAL)return 0;docker_system_root[n-9]=0;return cl_docker_environment((uint16_t*)docker_config,(uint16_t*)docker_system_root,(uint16_t*)docker_environment,CL_MAX_PATH*4);}
static int json_text(unsigned char*out,size_t cap,size_t*at,const char*s){size_t i;for(i=0;s[i];i++){if(*at>=cap)return 0;out[(*at)++]=(unsigned char)s[i];}return 1;}
static int json_wide(unsigned char*out,size_t cap,size_t*at,const WCHAR*s){int n,i;unsigned char c;n=WideCharToMultiByte(CP_UTF8,WC_ERR_INVALID_CHARS,s,-1,(char*)converted_path,sizeof(converted_path),0,0);if(n<1)return 0;if(!json_text(out,cap,at,"\""))return 0;for(i=0;i<n-1;i++){c=converted_path[i];if(c<32)return 0;if(c=='\\'||c=='\"'){if(!json_text(out,cap,at,"\\"))return 0;}if(*at>=cap)return 0;out[(*at)++]=c;}return json_text(out,cap,at,"\"");}
static int json_sha(unsigned char*out,size_t cap,size_t*at,const unsigned char*sha){static const char hex[]="0123456789abcdef";unsigned i;if(!json_text(out,cap,at,"\""))return 0;for(i=0;i<32;i++){if(*at+2>cap)return 0;out[(*at)++]=(unsigned char)hex[sha[i]>>4];out[(*at)++]=(unsigned char)hex[sha[i]&15];}return json_text(out,cap,at,"\"");}
static int json_number(unsigned char*out,size_t cap,size_t*at,uint32_t value){unsigned char digits[10];unsigned n=0;do{digits[n++]=(unsigned char)('0'+value%10);value/=10;}while(value);while(n){if(*at>=cap)return 0;out[(*at)++]=digits[--n];}return 1;}
static int json_file(unsigned char*out,size_t cap,size_t*at,const WCHAR*path,uint32_t bytes,const unsigned char*sha){return json_text(out,cap,at,"{\"path\":")&&json_wide(out,cap,at,path)&&json_text(out,cap,at,",\"bytes\":")&&json_number(out,cap,at,bytes)&&json_text(out,cap,at,",\"sha256\":")&&json_sha(out,cap,at,sha)&&json_text(out,cap,at,"}");}
static int context_descriptor(unsigned char*out,size_t cap,size_t*length){size_t at=0;if(!json_text(out,cap,&at,"{\"schemaVersion\":1,\"status\":\"context-held\",\"kind\":")||!json_text(out,cap,&at,context_state.kind==1?"\"current\"":"\"explicit\"")||!json_text(out,cap,&at,",\"config\":"))return 0;if(context_state.kind==1){if(!json_file(out,cap,&at,context_state.config_path,context_state.config_bytes,context_state.config_sha))return 0;}else if(!json_text(out,cap,&at,"null"))return 0;if(!json_text(out,cap,&at,",\"metadata\":")||!json_file(out,cap,&at,context_state.metadata_path,context_state.metadata_bytes,context_state.metadata_sha)||!json_text(out,cap,&at,"}"))return 0;*length=at;return 1;}
/* Serialized request loop only; keep the two path buffers off the CRT-free stack. */
static int docker_selector(size_t*length){static WCHAR value[CL_MAX_PATH],profile[CL_MAX_PATH];DWORD n;size_t at=0;static const WCHAR endpoint[]=L"npipe:////./pipe/dockerDesktopLinuxEngine";const char*selection;
 if(GetEnvironmentVariableW(L"DOCKER_CONFIG",value,CL_MAX_PATH))return 0;
 n=GetEnvironmentVariableW(L"DOCKER_CONTEXT",value,CL_MAX_PATH);if(n>=CL_MAX_PATH)return 0;
 if(n){if(CompareStringOrdinal(value,-1,L"desktop-linux",-1,FALSE)!=CSTR_EQUAL)return 0;selection="{\"context\":\"desktop-linux\",\"customConfig\":false,\"host\":\"\",\"profile\":";}
 else{n=GetEnvironmentVariableW(L"DOCKER_HOST",value,CL_MAX_PATH);if(n>=CL_MAX_PATH)return 0;if(n){if(CompareStringOrdinal(value,-1,endpoint,-1,FALSE)!=CSTR_EQUAL)return 0;selection="{\"context\":\"\",\"customConfig\":false,\"host\":\"npipe:////./pipe/dockerDesktopLinuxEngine\",\"profile\":";}else selection="{\"context\":\"\",\"customConfig\":false,\"host\":\"\",\"profile\":";}
 n=GetEnvironmentVariableW(L"USERPROFILE",profile,CL_MAX_PATH);if(n>=CL_MAX_PATH)return 0;if(!n)profile[0]=0;return json_text(selector_input,sizeof(selector_input),&at,selection)&&json_wide(selector_input,sizeof(selector_input),&at,profile)&&json_text(selector_input,sizeof(selector_input),&at,"}")&&(*length=at)!=0;
}
static int docker_result(const WCHAR*environment,size_t*output){size_t selected=0;(void)environment;if(docker_env()&&launch(&sync_worker,docker_exe,0,docker_guards,docker_guard_count,docker_environment)){CloseHandle(sync_worker.input);sync_worker.input=0;if(sync_result(&sync_worker,request_bytes,&selected)&&cl_docker_engine_result(request_bytes,selected,reply_bytes+12,CL_MAX_REQUEST-12,output))return 1;}if(sync_worker.live)reap(&sync_worker,1);return 0;}
int cl_broker_run(HANDLE request,HANDLE reply,HANDLE node,const WCHAR*exe,HANDLE*guards,unsigned count,const WCHAR*environment){uint32_t previous=0;unsigned status;size_t output;int clean=1;struct cl_request r;node_process=node;node_guard_count=count;InitializeCriticalSection(&state_lock);watch_stop=0;operation_deadline=0;if(!duplicate(GetCurrentThread(),&main_thread))return 0;watch_thread=CreateThread(0,0,watchdog,0,0,0);if(!watch_thread){CloseHandle(main_thread);DeleteCriticalSection(&state_lock);return 0;}
 while(node_alive()){unsigned char size[4];uint32_t n;if(!read_exact(request,size,4,!config_write.declared))break;n=(uint32_t)size[0]|((uint32_t)size[1]<<8)|((uint32_t)size[2]<<16)|((uint32_t)size[3]<<24);if(n<8||n>CL_MAX_REQUEST||!read_exact(request,request_bytes,n,0)||!cl_parse_request(request_bytes,n,previous,&r))break;previous=r.id;status=4;output=0;EnterCriticalSection(&state_lock);operation_deadline=now()+20000;LeaveCriticalSection(&state_lock);
  if(config_write.declared&&(r.opcode!=10&&r.opcode!=11)){cl_config_write_reset(&config_write);goto response;}
  if(r.opcode>=9&&r.opcode<=11){int step=cl_config_write_step(&config_write,r.opcode,r.body,r.bytes,session.live);if(step==1)status=0;else if(step==2){status=5;if(MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,(const char*)config_write.body,(int)config_write.used,0,0)&&launch(&sync_worker,exe,cl_bridge_script,guards,count,environment)&&write_all(sync_worker.input,config_write.body,config_write.used)){CloseHandle(sync_worker.input);sync_worker.input=0;if(sync_result(&sync_worker,reply_bytes+12,&output))status=0;}if(sync_worker.live)reap(&sync_worker,1);cl_config_write_reset(&config_write);}}
  else if(r.opcode==1||r.opcode==2||r.opcode==12){const WCHAR*script=r.opcode==1?cl_protect_script:r.opcode==12?cl_setup_script:cl_catalog_json(13,r.body,r.bytes,1)?cl_registry_script:cl_bridge_script;
   if(cl_catalog_json(r.opcode,r.body,r.bytes,session.live)&&MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,(const char*)r.body,(int)r.bytes,wide_input,16384)){
    status=5;if(launch(&sync_worker,exe,script,guards,count,environment)&&write_all(sync_worker.input,r.body,r.bytes)){CloseHandle(sync_worker.input);sync_worker.input=0;if(sync_result(&sync_worker,reply_bytes+12,&output))status=0;}if(sync_worker.live)reap(&sync_worker,1);
   }
  }else if(r.opcode==7){size_t selector_bytes=0;
   if(!context_pending&&cl_catalog_json(7,r.body,r.bytes,session.live)&&docker_selector(&selector_bytes)){
    struct cl_docker_candidate candidate;size_t selected=0;status=5;
    if(launch(&sync_worker,exe,cl_docker_script,guards,count,environment)&&write_all(sync_worker.input,selector_input,selector_bytes)){
     CloseHandle(sync_worker.input);sync_worker.input=0;
     if(sync_result(&sync_worker,reply_bytes+12,&selected)&&cl_parse_docker_candidate(reply_bytes+12,selected,&candidate)&&cl_admit_docker(&candidate,docker_exe,docker_config,docker_guards,&docker_guard_count)){
      if(candidate.context_kind){if(cl_admit_context(&candidate,&context_state,docker_guards,&docker_guard_count)&&persist_node_guards()&&context_descriptor(reply_bytes+12,CL_MAX_REQUEST-12,&output)){context_pending=1;status=0;}}
      else if(persist_node_guards()&&docker_result(environment,&output))status=0;
     }
    }
    if(sync_worker.live)reap(&sync_worker,1);
   }
  }else if(r.opcode==8){if(context_pending&&cl_match_docker_context_selection(r.body,r.bytes,context_state.kind,context_state.config_sha,context_state.metadata_sha)){status=5;if(docker_result(environment,&output)){context_pending=0;status=0;}}}
  else if(r.opcode==3){if(!session.live&&header(r.body,r.bytes)){status=5;if(launch(&session,exe,cl_backup_script,guards,count,environment)&&write_all(session.input,r.body,r.bytes)&&line(&session,reply_bytes+12,&output))status=0;if(status)reap(&session,1);}}
  else if(r.opcode==4&&session.live){const unsigned char*b=r.body;size_t bytes=r.bytes;if(!session.remaining){uint32_t cap;if(bytes<6||b[0]!=1||b[1]!=session.frame||session.frame>=10)goto response;cap=session.frame<4?67108864:session.frame==9?65536:1048576;{uint32_t declared=big(b+2);if(declared>cap||session.aggregate+declared>273743872)goto response;session.aggregate+=declared;session.remaining=declared+6;}}
   if(bytes>session.remaining)goto response;status=5;if(write_all(session.input,b,bytes)){session.remaining-=(uint32_t)bytes;if(session.remaining){status=0;}else if(line(&session,reply_bytes+12,&output)){session.frame++;status=0;}}if(status)reap(&session,1);
  }else if(r.opcode==5&&session.live){if(session.frame==10&&!session.remaining&&r.bytes==1&&r.body[0]==2){status=5;if(write_all(session.input,r.body,1)){CloseHandle(session.input);session.input=0;if(line(&session,reply_bytes+12,&output)&&reap(&session,0))status=0;}if(session.live)reap(&session,1);}}
  else if(r.opcode==6){status=5;if(session.live)reap(&session,1);}
  response:{size_t wipe;volatile unsigned char*private_bytes=request_bytes+8;for(wipe=0;wipe<r.bytes;wipe++)private_bytes[wipe]=0;}if(status)output=0;if(!respond(reply,status,r.id,output))break;EnterCriticalSection(&state_lock);operation_deadline=0;LeaveCriticalSection(&state_lock);
 }
 cl_config_write_reset(&config_write);if(session.live&&!reap(&session,1))clean=0;if(sync_worker.live&&!reap(&sync_worker,1))clean=0;InterlockedExchange(&watch_stop,1);if(WaitForSingleObject(watch_thread,10000)!=WAIT_OBJECT_0)return 0;CloseHandle(watch_thread);CloseHandle(main_thread);DeleteCriticalSection(&state_lock);return clean;}
