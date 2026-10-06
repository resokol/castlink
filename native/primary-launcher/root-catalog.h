#ifndef CL_ROOT_CATALOG_H
#define CL_ROOT_CATALOG_H
#include "target-catalog.h"
/* Same held principal/root/scope/config binding as fixed target families;
   no container identity exists before CREATE/UP. No generic command schema. */
int cl_root_parse(const unsigned char*,size_t,struct cl_target_request*);
#define CL_ROOT_OUTPUT_MAX 1048576
struct cl_root_ops{struct cl_target_ops target;const char*empty_env_file;int(*random)(void*,unsigned char*,size_t);};
struct cl_root_capture{unsigned char output[CL_ROOT_OUTPUT_MAX],resolved[CL_ROOT_OUTPUT_MAX],packet[CL_TARGET_REQUEST_MAX];size_t used,offset,resolved_bytes,packet_bytes;uint32_t source;int active,busy;char project[129],root[3073],compose[3087],name[256],reference[1025];};
int cl_root_begin(struct cl_root_capture*,const struct cl_root_ops*,uint32_t,const unsigned char*,size_t);
int cl_root_read(struct cl_root_capture*,uint32_t,size_t,unsigned char*,size_t,size_t*,int*);
int cl_root_cancel(struct cl_root_capture*,uint32_t);
void cl_root_abort(struct cl_root_capture*);
#endif
