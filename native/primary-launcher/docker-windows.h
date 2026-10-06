#ifndef CL_DOCKER_WINDOWS_H
#define CL_DOCKER_WINDOWS_H
#include <windows.h>
#include "docker.h"
#include "core.h"
/* Called only with the fixed catalog's result, never an operation request path. */
int cl_admit_docker(const struct cl_docker_candidate*c,WCHAR*exe,WCHAR*config,HANDLE*out,unsigned*count);
struct cl_native_context {unsigned kind;WCHAR config_path[CL_MAX_PATH],metadata_path[CL_MAX_PATH];uint32_t config_bytes,metadata_bytes;unsigned char config_sha[32],metadata_sha[32];};
int cl_admit_context(const struct cl_docker_candidate*c,struct cl_native_context*out,HANDLE*guards,unsigned*count);
#endif
