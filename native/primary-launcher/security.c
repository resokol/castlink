#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include "security.h"
static SECURITY_DESCRIPTOR descriptor;
static DECLSPEC_ALIGN(8) unsigned char token_bytes[1024],acl_bytes[1024],system_sid[SECURITY_MAX_SID_SIZE];
static int ready;
int cl_private_security(SECURITY_ATTRIBUTES*out,BOOL inherit){HANDLE token;DWORD size;TOKEN_USER*user;if(!ready){if(!OpenProcessToken(GetCurrentProcess(),TOKEN_QUERY,&token))return 0;if(!GetTokenInformation(token,TokenUser,token_bytes,sizeof(token_bytes),&size)){CloseHandle(token);return 0;}CloseHandle(token);user=(TOKEN_USER*)token_bytes;size=sizeof(system_sid);if(!CreateWellKnownSid(WinLocalSystemSid,0,system_sid,&size)||!InitializeSecurityDescriptor(&descriptor,SECURITY_DESCRIPTOR_REVISION)||!InitializeAcl((PACL)acl_bytes,sizeof(acl_bytes),ACL_REVISION)||!AddAccessAllowedAce((PACL)acl_bytes,ACL_REVISION,GENERIC_ALL,user->User.Sid)||!AddAccessAllowedAce((PACL)acl_bytes,ACL_REVISION,GENERIC_ALL,system_sid)||!SetSecurityDescriptorOwner(&descriptor,user->User.Sid,FALSE)||!SetSecurityDescriptorDacl(&descriptor,TRUE,(PACL)acl_bytes,FALSE)||!SetSecurityDescriptorControl(&descriptor,SE_DACL_PROTECTED,SE_DACL_PROTECTED))return 0;ready=1;}out->nLength=sizeof(*out);out->lpSecurityDescriptor=&descriptor;out->bInheritHandle=inherit;return 1;}
