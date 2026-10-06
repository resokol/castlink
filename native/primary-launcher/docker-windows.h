#ifndef CL_DOCKER_WINDOWS_H
#define CL_DOCKER_WINDOWS_H
#include <windows.h>
#include "docker.h"
/* Called only with the fixed catalog's result, never an operation request path. */
int cl_admit_docker(const struct cl_docker_candidate*c,WCHAR*exe,WCHAR*config,HANDLE*out,unsigned*count);
#endif
