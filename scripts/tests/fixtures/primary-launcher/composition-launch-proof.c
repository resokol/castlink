#include <assert.h>
#include <stddef.h>
#include "core.h"
#include "target-catalog.h"
#include <string.h>
typedef uint16_t WCHAR;typedef unsigned HANDLE;
#define STARTF_USESTDHANDLES 256
#define CP_UTF8 65001
#define MB_ERR_INVALID_CHARS 8
static const struct cl_target_plan *target_plan;
static WCHAR target_argument[CL_MAX_COMMAND];
/* The fixture uses ASCII target arguments. Exercise the conversion contract,
   reject unsupported input, and let the production fragment do the quoting. */
static int MultiByteToWideChar(unsigned cp, unsigned flags, const char *s, int n, WCHAR *out, int cap) {
    size_t length = strlen(s);
    assert(cp == CP_UTF8 && flags == MB_ERR_INVALID_CHARS && n == -1);
    if (length >= (size_t)cap) return 0;
    for (size_t i = 0; i <= length; i++) {
        if ((unsigned char)s[i] > 127) return 0;
        out[i] = (unsigned char)s[i];
    }
    return (int)length + 1;
}
struct startup {unsigned cb,dwFlags;HANDLE hStdInput,hStdOutput,hStdError;};struct startup_ex {struct startup StartupInfo;void*lpAttributeList;};typedef void*LPPROC_THREAD_ATTRIBUTE_LIST;
static WCHAR command_line[CL_MAX_COMMAND];static WCHAR docker_config[]={68,58,92,99,102,103,0};static HANDLE inherited[10]={100,101,102,103,104,105,106,107,108,109};static unsigned char attributes[10];static unsigned docker_command;
static int contains(const char*s){unsigned i,j;for(i=0;command_line[i];i++){for(j=0;s[j]&&command_line[i+j]==(unsigned char)s[j];j++);if(!s[j])return 1;}return 0;}
static int run(const WCHAR*exe,const WCHAR*script,unsigned count,unsigned scratch){struct startup_ex start;unsigned i,stdio_index=count+scratch;size_t used=0;
/* ACTUAL_LAUNCH_FRAGMENT */
 assert(start.StartupInfo.hStdInput==inherited[stdio_index]);assert(start.StartupInfo.hStdOutput==inherited[stdio_index+1]);assert(start.StartupInfo.hStdError==inherited[stdio_index+2]);return 1;
 done:return 0;}
int main(void){static const WCHAR docker[]={67,58,92,68,111,99,107,101,114,92,100,111,99,107,101,114,46,101,120,101,0};docker_command=1;assert(run(docker,0,2,0));assert(contains("--host"));assert(contains("npipe:////./pipe/dockerDesktopLinuxEngine"));assert(contains("--config"));assert(contains("D:\\cfg"));assert(contains("{{.ID}}|{{.OSType}}|{{.Architecture}}|{{.ServerVersion}}"));assert(!contains("--context"));docker_command=2;assert(run(docker,0,2,0));assert(contains("version"));assert(contains("--short"));assert(!contains("--config"));assert(!contains("info"));docker_command=0;assert(run(docker,(const WCHAR*)L"fixed-managed-script",2,1));assert(contains("-NoProfile"));assert(contains("fixed-managed-script"));assert(!contains("--host"));docker_command=3;assert(!run(docker,0,2,0));
 struct cl_target_plan plan={0};plan.argc=1;plan.argv[0]="target with space";target_plan=&plan;
 assert(run(docker,0,2,0));assert(contains("\"target with space\""));assert(!contains("--host"));
 return 0;}
