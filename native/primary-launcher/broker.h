#ifndef CL_BROKER_H
#define CL_BROKER_H
#include <windows.h>
int cl_broker_run(HANDLE request,HANDLE reply,HANDLE node,const WCHAR*powershell,HANDLE*guards,unsigned count,const WCHAR*environment);
#endif
