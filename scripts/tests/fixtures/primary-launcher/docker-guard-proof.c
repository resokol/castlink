#include <stdint.h>
#include <assert.h>
#include <string.h>
#include "core.h"
#include "docker.h"
typedef uint16_t WCHAR;typedef int HANDLE;
#define CP_UTF8 1
#define MB_ERR_INVALID_CHARS 1
struct held {WCHAR path[CL_MAX_PATH];int directory,inventory,handle,system;};
static struct held held[CL_MAX_GUARDS];static unsigned held_count,guard_calls;static int mutation,wrong_config,wrong_plugin;static WCHAR root[]={68,58,92,80,97,99,107,97,103,101,0};
static size_t len(const WCHAR*s){size_t n=0;while(s[n])n++;return n;}
static int equal(const WCHAR*a,const WCHAR*b){size_t n=0;while(a[n]&&a[n]==b[n])n++;return a[n]==b[n];}
static int copy(WCHAR*a,const WCHAR*b){size_t i,n=len(b);if(n>=CL_MAX_PATH)return 0;for(i=0;i<=n;i++)a[i]=b[i];return 1;}
static int append(WCHAR*a,const WCHAR*b){size_t i,n=len(a),m=len(b);if(n+m>=CL_MAX_PATH)return 0;for(i=0;i<=m;i++)a[n+i]=b[i];return 1;}
int within(const WCHAR*path,const WCHAR*parent){size_t i,n=len(parent);for(i=0;i<n;i++)if(path[i]!=parent[i])return 0;return path[n]==0||path[n]=='\\';}
static int dos(const WCHAR*p){return p[0]>='A'&&p[0]<='Z'&&p[1]==':'&&p[2]=='\\';}
static int MultiByteToWideChar(unsigned a,unsigned b,const char*s,int n,WCHAR*out,int cap){int i;(void)a;(void)b;if(n>cap)return 0;for(i=0;i<n;i++){if((unsigned char)s[i]>127)return 0;out[i]=(unsigned char)s[i];}return n;}
static int add(const WCHAR*p,int directory,int inventory,int system){unsigned i;for(i=0;i<held_count;i++)if(equal(held[i].path,p))return 1;assert(held_count<CL_MAX_GUARDS);copy(held[held_count].path,p);held[held_count].directory=directory;held[held_count].inventory=inventory;held[held_count].system=system;held_count++;return 1;}
static int ancestors(const WCHAR*p,int system){WCHAR q[CL_MAX_PATH];size_t i;for(i=0;p[i];i++){q[i]=p[i];if(i==2||p[i]=='\\'){q[i+(i==2?1:0)]=0;if(!add(q,1,-1,system))return 0;q[i]=p[i];}}return 1;}
static int guard(void*c,unsigned i){(void)c;guard_calls++;held[i].handle=(int)i+1;return 1;}
static int stable(struct held*h){return h->handle>0&&!mutation;}
static void digest(const unsigned char*b,size_t n,unsigned char*out){struct cl_sha s;cl_sha_init(&s);assert(cl_sha_update(&s,b,n));cl_sha_final(&s,out);}
static int hashfile(struct held*h,const struct cl_item*r){const unsigned char*b;size_t n;unsigned char sha[32];assert(h->handle>0);if(h->inventory==-3){b=(const unsigned char*)"signed-desktop";n=14;}else if(h->inventory==-4){b=(const unsigned char*)"signed-docker";n=13;}else if(h->inventory==-7){b=(const unsigned char*)"signed-compose";n=14;}else if(h->inventory==1){b=(const unsigned char*)(wrong_plugin?"tampered\n":"disabled\n");n=9;}else{b=(const unsigned char*)(wrong_config?"{x}":"{}\n");n=3;}digest(b,n,sha);return r->bytes==n&&!memcmp(sha,r->hash,32);}
int complete(void){return 1;}
int env_anchor(const WCHAR*env,const char*key,const WCHAR*expected){size_t at=0,i,j;while(env[at]){for(i=0;key[i]&&env[at+i]==(unsigned char)key[i];i++);if(!key[i]){for(j=0;expected[j]&&env[at+i+j]==expected[j];j++);return env[at+i+j]==0&&expected[j]==0;}while(env[at])at++;at++;}return 0;}
/* ACTUAL_FUNCTION */
static void reset(int config){WCHAR p[CL_MAX_PATH];held_count=guard_calls=0;mutation=wrong_config=wrong_plugin=0;if(config){copy(p,root);append(p,(const WCHAR*)L"\\metadata\\docker-config\\config.json");add(p,0,0,0);held[0].handle=1;copy(p,root);append(p,(const WCHAR*)L"\\metadata\\docker-config");add(p,1,-1,0);held[1].handle=2;copy(p,root);append(p,(const WCHAR*)L"\\metadata\\docker-config\\cli-plugins");add(p,0,1,0);held[2].handle=3;}}
int main(void){const unsigned char base[]="C:\\Program Files";unsigned char ds[32],cs[32],ps[32];struct cl_docker_candidate c;WCHAR exe[CL_MAX_PATH],cfg[CL_MAX_PATH],file_anchor[CL_MAX_PATH];HANDLE handles[CL_MAX_GUARDS];unsigned count,i;digest((const unsigned char*)"signed-desktop",14,ds);digest((const unsigned char*)"signed-docker",13,cs);c.machine=1;c.base=base;c.base_bytes=sizeof(base)-1;c.desktop_bytes=14;c.docker_bytes=13;c.desktop_sha=ds;c.docker_sha=cs;digest((const unsigned char*)"signed-compose",14,ps);c.compose_bytes=14;c.compose_sha=ps;
 reset(1);held_count=2;assert(!cl_admit_docker(&c,exe,cfg,file_anchor,handles,&count));
 reset(1);assert(cl_admit_docker(&c,exe,cfg,file_anchor,handles,&count));assert(equal(exe,(const WCHAR*)L"C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe"));assert(equal(cfg,(const WCHAR*)L"D:\\Package\\metadata\\docker-config"));assert(count==held_count&&guard_calls==held_count-3);{WCHAR env[4096];assert(cl_docker_environment(file_anchor,(const WCHAR*)L"C:\\Windows",env,4096));assert(equal(file_anchor,(const WCHAR*)L"D:\\Package\\metadata\\docker-config\\config.json"));assert(env_anchor(env,"ProgramData=",(const WCHAR*)L"D:\\Package\\metadata\\docker-config\\config.json"));assert(env_anchor(env,"ProgramFiles=",(const WCHAR*)L"D:\\Package\\metadata\\docker-config\\config.json"));assert(env_anchor(env,"PATH=",(const WCHAR*)L""));}for(i=0;i<count;i++)assert(handles[i]==held[i].handle&&handles[i]>0);
 assert(cl_admit_compose(&c,exe,handles,&count));assert(equal(exe,(const WCHAR*)L"C:\\Program Files\\Docker\\Docker\\resources\\cli-plugins\\docker-compose.exe"));ps[0]^=1;assert(!cl_admit_compose(&c,exe,handles,&count));ps[0]^=1;
 reset(1);ds[0]^=1;assert(!cl_admit_docker(&c,exe,cfg,file_anchor,handles,&count));ds[0]^=1;
 reset(1);mutation=1;assert(!cl_admit_docker(&c,exe,cfg,file_anchor,handles,&count));
 reset(0);assert(!cl_admit_docker(&c,exe,cfg,file_anchor,handles,&count));
 reset(1);held[2].directory=1;assert(!cl_admit_docker(&c,exe,cfg,file_anchor,handles,&count));
 reset(1);wrong_plugin=1;assert(!cl_admit_docker(&c,exe,cfg,file_anchor,handles,&count));
 reset(1);wrong_config=1;assert(!cl_admit_docker(&c,exe,cfg,file_anchor,handles,&count));return 0;}
