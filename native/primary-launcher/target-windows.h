#ifndef CL_TARGET_WINDOWS_H
#define CL_TARGET_WINDOWS_H
#include <windows.h>
#include "target-catalog.h"
int cl_target_windows_prepare(const struct cl_target_request*,HANDLE);
int cl_target_windows_current(const struct cl_target_request*);
int cl_target_windows_database_url(unsigned char*,size_t,size_t*);
int cl_target_windows_guards(HANDLE*,unsigned,unsigned*);
int cl_target_windows_close(void);
#endif
