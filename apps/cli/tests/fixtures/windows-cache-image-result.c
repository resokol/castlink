#include <assert.h>
#include <stdint.h>
#include <stddef.h>
#include <string.h>
typedef unsigned DWORD;typedef unsigned HANDLE;
#define ERROR_BROKEN_PIPE 109
#define WAIT_OBJECT_0 0
#define WAIT_TIMEOUT 258
#define WAIT_FAILED 0xffffffffu
struct worker{uint64_t deadline;HANDLE error,output;struct{HANDLE hProcess;}process;int live;};
static unsigned clock_tick,mode,step,out_offset,err_offset,reaps;static DWORD last_error;static const char*stdout_bytes,*stderr_bytes;static const char*reference="example.org/web@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
static uint64_t now(void){return clock_tick++;}static int node_alive(void){return mode!=8;}static DWORD GetLastError(void){return last_error;}
static DWORD WaitForSingleObject(HANDLE h,unsigned timeout){assert(h==3&&!timeout);last_error=222;return mode==13?WAIT_FAILED:mode==7||((mode==11||mode==12)&&step<3)?WAIT_TIMEOUT:WAIT_OBJECT_0;}
static int PeekNamedPipe(HANDLE h,void*a,unsigned b,void*c,DWORD*n,void*d){unsigned offset=h==1?err_offset:out_offset;const char*s=h==1?stderr_bytes:stdout_bytes;(void)a;(void)b;(void)c;(void)d;assert(h==1||h==2);if(mode==9&&h==1&&step==0){*n=0;return 1;}if(mode==10&&h==1){*n=0;return 1;}*n=(DWORD)(strlen(s)-offset);if(*n)return 1;last_error=ERROR_BROKEN_PIPE;return 0;}
static int ReadFile(HANDLE h,void*p,DWORD n,DWORD*got,void*overlapped){unsigned*offset=h==1?&err_offset:&out_offset;const char*s=h==1?stderr_bytes:stdout_bytes;assert(!overlapped);memcpy(p,s+*offset,n);*offset+=n;*got=n;return 1;}
static void Sleep(unsigned n){assert(n==2);step++;}static int GetExitCodeProcess(HANDLE h,DWORD*c){assert(h==3);*c=mode==2?2:mode==0||mode==9||mode==11?0:1;return 1;}
static int reap(struct worker*w,int terminate){assert(!terminate);reaps++;if(mode==6)return 0;w->live=0;return mode==0||mode==9||mode==11;}
#include "collector.inc"
static void setup(unsigned m,struct worker*w){mode=m;clock_tick=step=out_offset=err_offset=reaps=0;w->deadline=30;w->error=1;w->output=2;w->process.hProcess=3;w->live=1;stdout_bytes="";stderr_bytes="Error response from daemon: No such image: example.org/web@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n";if(m==0||m==11){stdout_bytes="{\"Id\":\"known\"}\n";stderr_bytes="";}if(m==3)stderr_bytes="Error response from daemon: No such image: example.org/foreign@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n";if(m==4)stdout_bytes="warning";if(m==5)stderr_bytes="Error response from daemon: No such image: example.org/web@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";if(m==9){stdout_bytes="{\"Id\":\"known\"}\n";stderr_bytes="late warning\n";}}
int main(void){struct worker w;unsigned char out[65536];size_t n;unsigned m;setup(1,&w);n=0;assert(cache_image_result(&w,reference,out,sizeof(out),&n)==2&&!w.live&&reaps==1&&n==20&&!memcmp(out,"{\"cache\":\"missing\"}\n",20));setup(0,&w);n=0;assert(cache_image_result(&w,reference,out,sizeof(out),&n)==1&&!w.live&&reaps==1&&n==15);for(m=2;m<=10;m++){setup(m,&w);n=0;assert(cache_image_result(&w,reference,out,sizeof(out),&n)==0);if(m!=6)assert(!reaps);if(m==6)assert(w.live&&reaps==1);}setup(11,&w);n=0;assert(cache_image_result(&w,reference,out,sizeof(out),&n)==1&&!w.live&&reaps==1&&step>=3);setup(12,&w);n=0;assert(cache_image_result(&w,reference,out,sizeof(out),&n)==2&&!w.live&&reaps==1&&step>=3);setup(13,&w);n=0;assert(!cache_image_result(&w,reference,out,sizeof(out),&n)&&!reaps);return 0;}
