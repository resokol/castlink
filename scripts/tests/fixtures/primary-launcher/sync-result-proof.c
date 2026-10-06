#include <assert.h>
#include <stdint.h>
#include <stddef.h>
#include <string.h>
typedef unsigned DWORD;typedef unsigned HANDLE;
#define WAIT_OBJECT_0 0
#define WAIT_TIMEOUT 258
#define WAIT_FAILED 0xffffffffu
#ifndef CHECK_CAPTURE
#define CHECK_CAPTURE(reason,code) ((void)0)
#endif
#define ERROR_BROKEN_PIPE 109
struct worker {HANDLE output,error;struct {HANDLE hProcess;} process;uint64_t deadline;};
static DWORD last,exit_code;static int consumed,exited,reaped,failed_reap,stderr_bytes,output_error,stderr_error,exit_on_peek;static uint64_t ticks;static unsigned sleeps;static unsigned declared=4;
static uint64_t now(void){return ticks++;}static int node_alive(void){return exit_on_peek!=8||ticks<200;}static void Sleep(unsigned n){(void)n;ticks+=100;sleeps++;if(exit_on_peek>=4&&exit_on_peek<=7&&sleeps>=3){exited=1;if(exit_on_peek==7)stderr_bytes=1;}}
static DWORD WaitForSingleObject(HANDLE h,unsigned n){assert(h==3);(void)n;last=997;return exit_on_peek==9?WAIT_FAILED:exited?WAIT_OBJECT_0:WAIT_TIMEOUT;}
DWORD GetLastError(void){return last;}
static int PeekNamedPipe(HANDLE h,void*a,unsigned b,void*c,DWORD*n,void*d){(void)a;(void)b;(void)c;(void)d;assert(h==1||h==2);if(h==2){if(exit_on_peek==2&&!exited){exited=1;last=ERROR_BROKEN_PIPE;return 0;}if((exit_on_peek==1||exit_on_peek==3)&&!exited){*n=0;return 1;}if((exit_on_peek==5||exit_on_peek==7)&&!exited){*n=0;return 1;}if(stderr_bytes){*n=1;return 1;}last=stderr_error;return 0;}if(!consumed){*n=declared;return 1;}if(exit_on_peek==6&&!exited){*n=0;return 1;}if(exit_on_peek==1&&!exited)exited=1;if(exit_on_peek==3&&!exited){exited=1;stderr_bytes=1;}last=output_error;return 0;}
static int ReadFile(HANDLE h,void*out,DWORD n,DWORD*got,void*over){assert(h==1);(void)over;if(exit_on_peek==10)return 0;assert(n<=16384);memset(out,'X',n);*got=n;consumed=1;return 1;}
static int GetExitCodeProcess(HANDLE h,DWORD*out){assert(h==3);*out=exit_code;return 1;}
static int reap(struct worker*w,int kill){(void)w;assert(!kill);reaped++;return !failed_reap;}
/* ACTUAL_SYNC_RESULT */
static void reset(void){last=exit_code=0;consumed=reaped=failed_reap=stderr_bytes=exit_on_peek=0;exited=1;output_error=stderr_error=ERROR_BROKEN_PIPE;ticks=sleeps=0;declared=4;}
int main(void){struct worker w={1,2,{3},20000};unsigned char out[16384];size_t n=0;reset();assert(sync_result(&w,out,&n));assert(n==4&&reaped==1);reset();stderr_bytes=1;assert(!sync_result(&w,out,&n)&&!reaped);CHECK_CAPTURE(2,0);reset();stderr_error=5;assert(!sync_result(&w,out,&n)&&!reaped);CHECK_CAPTURE(3,0);reset();output_error=5;assert(!sync_result(&w,out,&n)&&!reaped);CHECK_CAPTURE(6,0);reset();exited=0;assert(!sync_result(&w,out,&n)&&!reaped);assert(ticks>=20000);CHECK_CAPTURE(1,0);reset();exit_code=4;assert(!sync_result(&w,out,&n)&&!reaped);CHECK_CAPTURE(9,4);reset();declared=16385;assert(!sync_result(&w,out,&n)&&!reaped);CHECK_CAPTURE(4,0);reset();failed_reap=1;assert(!sync_result(&w,out,&n)&&reaped==1);CHECK_CAPTURE(11,0);reset();exited=0;exit_on_peek=2;assert(sync_result(&w,out,&n)&&n==4&&reaped==1);reset();exited=0;exit_on_peek=1;assert(sync_result(&w,out,&n)&&n==4&&reaped==1);reset();exited=0;exit_on_peek=3;assert(!sync_result(&w,out,&n)&&!reaped);for(int mode=4;mode<=6;mode++){reset();exited=0;exit_on_peek=mode;assert(sync_result(&w,out,&n)&&n==4&&reaped==1&&sleeps>=3);}reset();exited=0;exit_on_peek=7;assert(!sync_result(&w,out,&n)&&!reaped);reset();exit_on_peek=9;assert(!sync_result(&w,out,&n)&&!reaped);CHECK_CAPTURE(7,0);reset();consumed=1;assert(!sync_result(&w,out,&n)&&!reaped);CHECK_CAPTURE(10,0);reset();exit_code=65536;assert(!sync_result(&w,out,&n)&&!reaped);CHECK_CAPTURE(9,256);reset();exit_on_peek=10;assert(!sync_result(&w,out,&n)&&!reaped);CHECK_CAPTURE(5,0);reset();exited=0;exit_on_peek=8;assert(!sync_result(&w,out,&n)&&!reaped);CHECK_CAPTURE(1,0);reset();exited=0;w.deadline=150;assert(!sync_result(&w,out,&n)&&!reaped&&ticks<1000);CHECK_CAPTURE(1,0);return 0;}
