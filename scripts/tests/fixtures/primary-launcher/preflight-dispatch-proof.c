#include <assert.h>
#include <string.h>
#include "docker.h"
typedef unsigned short WCHAR;typedef int HANDLE;
#define CL_MAX_REQUEST 65536
#define CL_MAX_PATH 1024
struct worker{HANDLE input;int live;};static struct worker sync_worker;
static WCHAR docker_exe[CL_MAX_PATH],compose_exe[CL_MAX_PATH],docker_environment[CL_MAX_PATH];static HANDLE docker_guards[64];static unsigned docker_guard_count,preflight_pending=1,docker_command;static unsigned char docker_sha[32],compose_sha[32],server_facts[512],compose_facts[64],request_bytes[65536],reply_bytes[65536];
static unsigned launches,checks;static int drift_guard,drift_engine,stderr_failure;
static int docker_env(void){return 1;}
static int cl_check_docker_guards(void){checks++;return !drift_guard||checks<3;}
static int launch(struct worker*w,const WCHAR*exe,const WCHAR*script,HANDLE*guards,unsigned count,const WCHAR*environment){(void)script;(void)guards;(void)count;(void)environment;assert(exe==(docker_command==2?compose_exe:docker_exe));assert(docker_command==1||docker_command==2);launches++;w->live=1;w->input=1;return 1;}
static void CloseHandle(HANDLE h){assert(h==1);}
static int reap(struct worker*w,int terminate){(void)terminate;w->live=0;return 1;}
static int sync_result(struct worker*w,unsigned char*out,size_t*n){const char*s=docker_command==2?"v2.40.3\r\n":drift_engine&&launches==3?"foreign|linux|amd64|29.8.2\r\n":"actual|linux|amd64|29.8.2\r\n";if(stderr_failure)return 0;*n=strlen(s);memcpy(out,s,*n);return reap(w,0);}
/* ACTUAL_DISPATCH */
int main(void){size_t output=0;assert(docker_result(0,&output));assert(launches==3&&checks==6);assert(strstr((char*)reply_bytes+12,"\"engine\":\"actual\""));launches=checks=0;drift_guard=1;assert(!docker_result(0,&output));assert(launches==1&&checks==3);assert(!sync_worker.live&&docker_command==0);launches=checks=0;drift_guard=0;drift_engine=1;assert(!docker_result(0,&output));assert(launches==3&&!sync_worker.live);launches=checks=0;drift_engine=0;stderr_failure=1;assert(!docker_result(0,&output));assert(launches==1&&!sync_worker.live&&docker_command==0);return 0;}
