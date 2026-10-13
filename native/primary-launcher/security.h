#ifndef CL_PRIVATE_SECURITY_H
#define CL_PRIVATE_SECURITY_H
#include <windows.h>
int cl_private_security(SECURITY_ATTRIBUTES*out,BOOL inherit);
int cl_private_directory_security(SECURITY_ATTRIBUTES*out);
#endif
