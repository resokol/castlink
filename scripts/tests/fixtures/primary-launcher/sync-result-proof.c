#include <assert.h>
#include <stdint.h>
#include <stddef.h>
#include <string.h>
typedef unsigned DWORD;typedef unsigned HANDLE;
#define WAIT_OBJECT_0 0
#define WAIT_TIMEOUT 258
#define ERROR_BROKEN_PIPE 109
struct worker {HANDLE output,error;struct {HANDLE hProcess;} process;};
static DWORD last,exit_code;static int consumed,exited,reaped,failed_reap,stderr_bytes,output_error,stderr_error,exit_on_peek;static uint64_t ticks;static unsigned declared=4;
static uint64_t now(void){return ticks++;}static int node_alive(void){return 1;}static void Sleep(unsigned n){(void)n;ticks+=100;}
static DWORD WaitForSingleObject(HANDLE h,unsigned n){assert(h==3);(void)n;last=997;return exited?WAIT_OBJECT_0:WAIT_TIMEOUT;}
DWORD GetLastError(void){return last;}
static int PeekNamedPipe(HANDLE h,void*a,unsigned b,void*c,DWORD*n,void*d){(void)a;(void)b;(void)c;(void)d;assert(h==1||h==2);if(h==2){if(exit_on_peek==2&&!exited){exited=1;last=ERROR_BROKEN_PIPE;return 0;}if((exit_on_peek==1||exit_on_peek==3)&&!exited){*n=0;return 1;}if(stderr_bytes){*n=1;return 1;}last=stderr_error;return 0;}if(!consumed){*n=declared;return 1;}if(exit_on_peek==1&&!exited)exited=1;if(exit_on_peek==3&&!exited){exited=1;stderr_bytes=1;}last=output_error;return 0;}
static int ReadFile(HANDLE h,void*out,DWORD n,DWORD*got,void*over){assert(h==1);(void)over;assert(n<=16384);memset(out,'X',n);*got=n;consumed=1;return 1;}
static int GetExitCodeProcess(HANDLE h,DWORD*out){assert(h==3);*out=exit_code;return 1;}
static int reap(struct worker*w,int kill){(void)w;assert(!kill);reaped++;return !failed_reap;}
/* ACTUAL_SYNC_RESULT */
static void reset(void){last=exit_code=0;consumed=reaped=failed_reap=stderr_bytes=exit_on_peek=0;exited=1;output_error=stderr_error=ERROR_BROKEN_PIPE;ticks=0;declared=4;}
int main(void){struct worker w={1,2,{3}};unsigned char out[16384];size_t n=0;reset();assert(sync_result(&w,out,&n));assert(n==4&&reaped==1);reset();stderr_bytes=1;assert(!sync_result(&w,out,&n)&&!reaped);reset();stderr_error=5;assert(!sync_result(&w,out,&n)&&!reaped);reset();output_error=5;assert(!sync_result(&w,out,&n)&&!reaped);reset();exited=0;assert(!sync_result(&w,out,&n)&&!reaped);reset();exit_code=4;assert(!sync_result(&w,out,&n)&&!reaped);reset();declared=16385;assert(!sync_result(&w,out,&n)&&!reaped);reset();failed_reap=1;assert(!sync_result(&w,out,&n)&&reaped==1);reset();exited=0;exit_on_peek=2;assert(sync_result(&w,out,&n)&&n==4&&reaped==1);reset();exited=0;exit_on_peek=1;assert(sync_result(&w,out,&n)&&n==4&&reaped==1);reset();exited=0;exit_on_peek=3;assert(!sync_result(&w,out,&n)&&!reaped);return 0;}
