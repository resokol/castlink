#include <assert.h>
#include <stddef.h>
#include "docker.h"
typedef uint16_t WCHAR;typedef unsigned DWORD;
#define CL_MAX_PATH 1024
#define CSTR_EQUAL 2
#define TRUE 1
static WCHAR docker_config[]={68,58,92,99,102,103,0};
static WCHAR docker_config_file[]={68,58,92,99,102,103,92,99,111,110,102,105,103,46,106,115,111,110,0};
static WCHAR docker_environment[CL_MAX_PATH*4],docker_system_root[CL_MAX_PATH];
static DWORD GetSystemDirectoryW(WCHAR*out,DWORD cap){static const WCHAR v[]={67,58,92,87,105,110,100,111,119,115,92,83,121,115,116,101,109,51,50,0};unsigned i;assert(cap>20);for(i=0;i<20;i++)out[i]=v[i];return 19;}
static int CompareStringOrdinal(const WCHAR*a,int an,const WCHAR*b,int bn,int insensitive){unsigned i;(void)an;(void)bn;(void)insensitive;for(i=0;a[i]&&a[i]==b[i];i++);return a[i]==b[i]?CSTR_EQUAL:0;}
static int anchor(const WCHAR*env,const char*key,const WCHAR*expected){size_t at=0,i,j;while(env[at]){for(i=0;key[i]&&env[at+i]==(unsigned char)key[i];i++);if(!key[i]){for(j=0;expected[j]&&env[at+i+j]==expected[j];j++);return env[at+i+j]==0&&expected[j]==0;}while(env[at])at++;at++;}return 0;}
/* ACTUAL_ENV */
int main(void){assert(docker_config[0]=='D');assert(docker_env());assert(anchor(docker_environment,"ProgramData=",docker_config_file));assert(anchor(docker_environment,"ProgramFiles=",docker_config_file));assert(!anchor(docker_environment,"ProgramData=",docker_config));assert(anchor(docker_environment,"PATH=",(const WCHAR*)L""));return 0;}
