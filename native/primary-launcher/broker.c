#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include "core.h"
#include "security.h"
#include "protocol.h"
#include "broker.h"
#include "docker-windows.h"
#include "catalog.h"
struct worker{PROCESS_INFORMATION process;HANDLE input,output,error,job;int live;unsigned frame;uint32_t remaining;uint64_t aggregate,deadline;};
static struct worker session,sync_worker;
static WCHAR docker_exe[CL_MAX_PATH],docker_config[CL_MAX_PATH],docker_environment[CL_MAX_PATH*4],docker_system_root[CL_MAX_PATH];
static HANDLE docker_guards[CL_MAX_GUARDS];
static DECLSPEC_ALIGN(16) unsigned char request_bytes[CL_MAX_REQUEST],reply_bytes[CL_MAX_REQUEST],discard[1024],attributes[65536];
static WCHAR command_line[CL_MAX_COMMAND],wide_input[16384],working_directory[CL_MAX_PATH];
static HANDLE inherited[CL_MAX_GUARDS+3];
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
static void dispose(struct worker*w){EnterCriticalSection(&state_lock);if(w->input)CloseHandle(w->input);if(w->output)CloseHandle(w->output);if(w->error)CloseHandle(w->error);if(w->process.hThread)CloseHandle(w->process.hThread);if(w->process.hProcess)CloseHandle(w->process.hProcess);if(w->job)CloseHandle(w->job);w->input=w->output=w->error=w->job=w->process.hThread=w->process.hProcess=0;w->live=0;LeaveCriticalSection(&state_lock);}
static int reap(struct worker*w,int terminate){DWORD code;JOBOBJECT_BASIC_ACCOUNTING_INFORMATION accounting;uint64_t end;if(!w->live){dispose(w);return 1;}if(terminate){if(!TerminateJobObject(w->job,4))return 0;}if(WaitForSingleObject(w->process.hProcess,10000)!=WAIT_OBJECT_0||!GetExitCodeProcess(w->process.hProcess,&code))return 0;end=now()+10000;for(;;){if(!QueryInformationJobObject(w->job,JobObjectBasicAccountingInformation,&accounting,sizeof(accounting),0))return 0;if(!accounting.ActiveProcesses)break;if(now()>=end)return 0;Sleep(2);}dispose(w);return terminate||code==0;}
static int duplicate(HANDLE h,HANDLE*out){return DuplicateHandle(GetCurrentProcess(),h,GetCurrentProcess(),out,0,TRUE,DUPLICATE_SAME_ACCESS);}
static int launch(struct worker*w,const WCHAR*exe,const WCHAR*script,HANDLE*guards,unsigned count,const WCHAR*environment){SECURITY_ATTRIBUTES sa,process_security;HANDLE stdin_read=0,stdout_write=0,stderr_write=0;STARTUPINFOEXW start;JOBOBJECT_EXTENDED_LIMIT_INFORMATION job;SIZE_T size=sizeof(attributes);unsigned i,total=0;size_t used=0;int ok=0;
 /* Explicit loops avoid unbounded stack/CRT startup dependencies. */
 unsigned char*p=(unsigned char*)&start;for(i=0;i<sizeof(start);i++)p[i]=0;p=(unsigned char*)&job;for(i=0;i<sizeof(job);i++)p[i]=0;
 if(!cl_private_security(&sa,TRUE))return 0;
 if(!CreatePipe(&stdin_read,&w->input,&sa,65536)||!CreatePipe(&w->output,&stdout_write,&sa,65536)||!CreatePipe(&w->error,&stderr_write,&sa,65536))goto done;
 if(!SetHandleInformation(w->input,HANDLE_FLAG_INHERIT,0)||!SetHandleInformation(w->output,HANDLE_FLAG_INHERIT,0)||!SetHandleInformation(w->error,HANDLE_FLAG_INHERIT,0))goto done;
 for(i=0;i<count;i++){if(!duplicate(guards[i],&inherited[total]))goto done;total++;}
 inherited[total++]=stdin_read;stdin_read=0;inherited[total++]=stdout_write;stdout_write=0;inherited[total++]=stderr_write;stderr_write=0;
 {unsigned last=0;for(i=0;exe[i];i++){if(i>=CL_MAX_PATH-1)goto done;working_directory[i]=exe[i];if(exe[i]==L'\\')last=i;}if(last<3)goto done;working_directory[last]=0;}
 if(!cl_quote((uint16_t*)command_line,CL_MAX_COMMAND,&used,(const uint16_t*)exe))goto done;
 if(script){static const WCHAR flags[]=L" -NoLogo -NoProfile -NonInteractive -Command ";for(i=0;flags[i];i++){if(used>=CL_MAX_COMMAND-1)goto done;command_line[used++]=flags[i];}}
 if(script){if(!cl_quote((uint16_t*)command_line,CL_MAX_COMMAND,&used,(const uint16_t*)script))goto done;}
 else{const WCHAR*args[7]={L"--host",L"npipe:////./pipe/dockerDesktopLinuxEngine",L"--config",docker_config,L"info",L"--format",L"{\"ID\":{{json .ID}}}"};unsigned a;for(a=0;a<7;a++){if(used>=CL_MAX_COMMAND-1)goto done;command_line[used++]=L' ';if(!cl_quote((uint16_t*)command_line,CL_MAX_COMMAND,&used,(const uint16_t*)args[a]))goto done;}}
 start.StartupInfo.cb=sizeof(start);start.StartupInfo.dwFlags=STARTF_USESTDHANDLES;start.StartupInfo.hStdInput=inherited[count];start.StartupInfo.hStdOutput=inherited[count+1];start.StartupInfo.hStdError=inherited[count+2];start.lpAttributeList=(LPPROC_THREAD_ATTRIBUTE_LIST)attributes;
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
static int docker_selector(void){WCHAR host[CL_MAX_PATH],other[2];DWORD n;static const WCHAR endpoint[]=L"npipe:////./pipe/dockerDesktopLinuxEngine";
 if(GetEnvironmentVariableW(L"DOCKER_CONTEXT",other,2)||GetEnvironmentVariableW(L"DOCKER_CONFIG",other,2))return 0;
 n=GetEnvironmentVariableW(L"DOCKER_HOST",host,CL_MAX_PATH);return n&&n<CL_MAX_PATH&&CompareStringOrdinal(host,-1,endpoint,-1,FALSE)==CSTR_EQUAL;
}
int cl_broker_run(HANDLE request,HANDLE reply,HANDLE node,const WCHAR*exe,HANDLE*guards,unsigned count,const WCHAR*environment){uint32_t previous=0;unsigned status;size_t output;int clean=1;struct cl_request r;node_process=node;InitializeCriticalSection(&state_lock);watch_stop=0;operation_deadline=0;if(!duplicate(GetCurrentThread(),&main_thread))return 0;watch_thread=CreateThread(0,0,watchdog,0,0,0);if(!watch_thread){CloseHandle(main_thread);DeleteCriticalSection(&state_lock);return 0;}
 while(node_alive()){unsigned char size[4];uint32_t n;if(!read_exact(request,size,4,1))break;n=(uint32_t)size[0]|((uint32_t)size[1]<<8)|((uint32_t)size[2]<<16)|((uint32_t)size[3]<<24);if(n<8||n>CL_MAX_REQUEST||!read_exact(request,request_bytes,n,0)||!cl_parse_request(request_bytes,n,previous,&r))break;previous=r.id;status=4;output=0;EnterCriticalSection(&state_lock);operation_deadline=now()+20000;LeaveCriticalSection(&state_lock);
  if(r.opcode==1||r.opcode==2){const WCHAR*script=r.opcode==1?cl_protect_script:cl_bridge_script;
   if(cl_catalog_json(r.opcode,r.body,r.bytes,session.live)&&MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,(const char*)r.body,(int)r.bytes,wide_input,16384)){
    status=5;if(launch(&sync_worker,exe,script,guards,count,environment)&&write_all(sync_worker.input,r.body,r.bytes)){CloseHandle(sync_worker.input);sync_worker.input=0;if(sync_result(&sync_worker,reply_bytes+12,&output))status=0;}if(sync_worker.live)reap(&sync_worker,1);
   }
  }else if(r.opcode==7){
   if(cl_catalog_json(7,r.body,r.bytes,session.live)&&docker_selector()){
    static const unsigned char selector[]="{\"context\":\"\",\"customConfig\":false,\"host\":\"npipe:////./pipe/dockerDesktopLinuxEngine\"}";struct cl_docker_candidate candidate;unsigned total=0;size_t selected=0;
    status=5;
    if(launch(&sync_worker,exe,cl_docker_script,guards,count,environment)&&write_all(sync_worker.input,selector,sizeof(selector)-1)){
     CloseHandle(sync_worker.input);sync_worker.input=0;
     if(sync_result(&sync_worker,reply_bytes+12,&selected)&&cl_parse_docker_candidate(reply_bytes+12,selected,&candidate)&&cl_admit_docker(&candidate,docker_exe,docker_config,docker_guards,&total)){
      if(docker_env()&&launch(&sync_worker,docker_exe,0,docker_guards,total,docker_environment)){CloseHandle(sync_worker.input);sync_worker.input=0;if(sync_result(&sync_worker,request_bytes,&selected)&&cl_docker_engine_result(request_bytes,selected,reply_bytes+12,CL_MAX_REQUEST-12,&output))status=0;}
     }
    }
    if(sync_worker.live)reap(&sync_worker,1);
   }
  }else if(r.opcode==3){if(!session.live&&header(r.body,r.bytes)){status=5;if(launch(&session,exe,cl_backup_script,guards,count,environment)&&write_all(session.input,r.body,r.bytes)&&line(&session,reply_bytes+12,&output))status=0;if(status)reap(&session,1);}}
  else if(r.opcode==4&&session.live){const unsigned char*b=r.body;size_t bytes=r.bytes;if(!session.remaining){uint32_t cap;if(bytes<6||b[0]!=1||b[1]!=session.frame||session.frame>=10)goto response;cap=session.frame<4?67108864:session.frame==9?65536:1048576;{uint32_t declared=big(b+2);if(declared>cap||session.aggregate+declared>273743872)goto response;session.aggregate+=declared;session.remaining=declared+6;}}
   if(bytes>session.remaining)goto response;status=5;if(write_all(session.input,b,bytes)){session.remaining-=(uint32_t)bytes;if(session.remaining){status=0;}else if(line(&session,reply_bytes+12,&output)){session.frame++;status=0;}}if(status)reap(&session,1);
  }else if(r.opcode==5&&session.live){if(session.frame==10&&!session.remaining&&r.bytes==1&&r.body[0]==2){status=5;if(write_all(session.input,r.body,1)){CloseHandle(session.input);session.input=0;if(line(&session,reply_bytes+12,&output)&&reap(&session,0))status=0;}if(session.live)reap(&session,1);}}
  else if(r.opcode==6){status=5;if(session.live)reap(&session,1);}
  response:if(status)output=0;if(!respond(reply,status,r.id,output))break;EnterCriticalSection(&state_lock);operation_deadline=0;LeaveCriticalSection(&state_lock);
 }
 if(session.live&&!reap(&session,1))clean=0;if(sync_worker.live&&!reap(&sync_worker,1))clean=0;InterlockedExchange(&watch_stop,1);if(WaitForSingleObject(watch_thread,10000)!=WAIT_OBJECT_0)return 0;CloseHandle(watch_thread);CloseHandle(main_thread);DeleteCriticalSection(&state_lock);return clean;}
