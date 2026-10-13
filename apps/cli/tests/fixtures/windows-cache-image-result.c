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
static unsigned clock_tick,mode,step,out_offset,err_offset,reaps,capture_reason,capture_code;static DWORD last_error;static const char*stdout_bytes,*stderr_bytes;static const char*reference="example.org/web@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
static uint64_t now(void){return clock_tick++;}static int node_alive(void){return mode!=8;}static DWORD GetLastError(void){return last_error;}
static DWORD WaitForSingleObject(HANDLE h,unsigned timeout){assert(h==3&&!timeout);last_error=222;return mode==13?WAIT_FAILED:mode==7||((mode==11||mode==12)&&step<3)?WAIT_TIMEOUT:WAIT_OBJECT_0;}
static int PeekNamedPipe(HANDLE h,void*a,unsigned b,void*c,DWORD*n,void*d){unsigned offset=h==1?err_offset:out_offset;const char*s=h==1?stderr_bytes:stdout_bytes;(void)a;(void)b;(void)c;(void)d;assert(h==1||h==2);if(mode==9&&h==1&&step==0){*n=0;return 1;}if(mode==10&&h==1){*n=0;return 1;}*n=(DWORD)(strlen(s)-offset);if(*n)return 1;last_error=ERROR_BROKEN_PIPE;return 0;}
static int ReadFile(HANDLE h,void*p,DWORD n,DWORD*got,void*overlapped){unsigned*offset=h==1?&err_offset:&out_offset;const char*s=h==1?stderr_bytes:stdout_bytes;assert(!overlapped);memcpy(p,s+*offset,n);*offset+=n;*got=n;return 1;}
static void Sleep(unsigned n){assert(n==2);step++;}static int GetExitCodeProcess(HANDLE h,DWORD*c){assert(h==3);*c=mode==2?2:mode==0||mode==9||mode==11?0:1;return 1;}
static int reap(struct worker*w,int terminate){assert(!terminate);reaps++;if(mode==6)return 0;w->live=0;return mode==0||mode==9||mode==11;}
#include "collector.inc"
static void setup(unsigned m,struct worker*w){mode=m;clock_tick=step=out_offset=err_offset=reaps=0;w->deadline=30;w->error=1;w->output=2;w->process.hProcess=3;w->live=1;stdout_bytes="";stderr_bytes="Error response from daemon: No such image: example.org/web@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n";if(m==0||m==11){stdout_bytes="{\"Id\":\"known\"}\n";stderr_bytes="";}if(m==3)stderr_bytes="Error response from daemon: No such image: example.org/foreign@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n";if(m==4)stdout_bytes="warning";if(m==5)stderr_bytes="Error response from daemon: No such image: example.org/web@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";if(m==9){stdout_bytes="{\"Id\":\"known\"}\n";stderr_bytes="late warning\n";}}
/* Actual Docker Desktop: requested docker.io/library/caddy pin, exit1,
   stdout LF and short official-name stderr121B SHA7e142784d9dfe856fedbd0931af196ede066509aee2526f3246172d2196cf121. */
static void official_missing_cases(void){
 static const char caddy[]="docker.io/library/caddy@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d";
 static const char short_error[]="Error response from daemon: No such image: caddy@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d\n";
 static const char library_error[]="Error response from daemon: No such image: library/caddy@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d\n";
 struct worker w;unsigned char out[65536];size_t n;unsigned i;
 reference=caddy;setup(12,&w);stdout_bytes="\n";stderr_bytes=short_error;n=0;
 assert(strlen(stderr_bytes)==121&&cache_image_result(&w,reference,out,sizeof(out),&n)==2&&!w.live&&reaps==1&&n==20&&step>=3&&!memcmp(out,"{\"cache\":\"missing\"}\n",20));
 setup(1,&w);stderr_bytes=library_error;n=0;assert(cache_image_result(&w,reference,out,sizeof(out),&n)==2&&!w.live&&reaps==1);
 setup(1,&w);stdout_bytes="\n";stderr_bytes="Error response from daemon: No such image: docker.io/library/caddy@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d\n";n=0;assert(cache_image_result(&w,reference,out,sizeof(out),&n)==2);
 reference="docker.io/library/postgres@sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea";setup(1,&w);stdout_bytes="\n";stderr_bytes="Error response from daemon: No such image: postgres@sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea\n";n=0;assert(cache_image_result(&w,reference,out,sizeof(out),&n)==2);
 for(i=0;i<11;i++){reference=caddy;setup(1,&w);stdout_bytes="\n";stderr_bytes=short_error;
  if(i==0)stdout_bytes="\n\n";if(i==1)stdout_bytes="warning\n";
  if(i==2)stderr_bytes="Error response from daemon: No such image: caddy@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530e\n";
  if(i==3)stderr_bytes="Error response from daemon: No such image: postgres@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d\n";
  if(i==4)stderr_bytes="Error response from daemon: No such image: caddy@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d";
  if(i==5)stderr_bytes="Error response from daemon: No such image: caddy@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d\nwarning\n";
  if(i==6)reference="example.org/library/caddy@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d";
  if(i==7)mode=2;if(i==8)mode=6;if(i==9)stdout_bytes="\r\n";if(i==10)reference="docker.io/library/other@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d";n=0;assert(cache_image_result(&w,reference,out,sizeof(out),&n)==0);assert(i==8?reaps==1&&w.live:!reaps);
 }
}
int main(void){struct worker w;unsigned char out[65536];size_t n;unsigned m;setup(1,&w);n=0;assert(cache_image_result(&w,reference,out,sizeof(out),&n)==2&&!w.live&&reaps==1&&n==20&&!memcmp(out,"{\"cache\":\"missing\"}\n",20));setup(0,&w);n=0;assert(cache_image_result(&w,reference,out,sizeof(out),&n)==1&&!w.live&&reaps==1&&n==15);for(m=2;m<=10;m++){static const unsigned reasons[]={9,2,10,2,11,1,1,2,1};setup(m,&w);n=0;assert(cache_image_result(&w,reference,out,sizeof(out),&n)==0);assert(capture_reason==reasons[m-2]&&capture_code==(m==2?2:0));if(m!=6)assert(!reaps);if(m==6)assert(w.live&&reaps==1);}setup(11,&w);n=0;assert(cache_image_result(&w,reference,out,sizeof(out),&n)==1&&!w.live&&reaps==1&&step>=3&&!capture_reason&&!capture_code);setup(12,&w);n=0;assert(cache_image_result(&w,reference,out,sizeof(out),&n)==2&&!w.live&&reaps==1&&step>=3&&!capture_reason&&!capture_code);setup(13,&w);n=0;assert(!cache_image_result(&w,reference,out,sizeof(out),&n)&&!reaps&&capture_reason==7);official_missing_cases();return 0;}
