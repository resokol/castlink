#ifndef CL_BROKER_H
#define CL_BROKER_H
#include <windows.h>
#include "core.h"
int cl_worker_scratch_create(unsigned slot,HANDLE*handle,const WCHAR**path);
void cl_worker_scratch_close(unsigned slot);
int cl_managed_inventory(WCHAR*path,const struct cl_item**item);
int cl_broker_run(HANDLE request,HANDLE reply,HANDLE node,const WCHAR*powershell,HANDLE*guards,unsigned count,const WCHAR*environment);
#endif
