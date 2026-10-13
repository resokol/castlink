#ifndef CL_TARGET_CATALOG_H
#define CL_TARGET_CATALOG_H
#include <stddef.h>
#include <stdint.h>
#define CL_TARGET_REQUEST_MAX 12288
#define CL_TARGET_INSPECT_MAX 262144
#define CL_TARGET_HELPER_MAX 2048
#define CL_TARGET_INPUT_MAX 8192
#define CL_TARGET_CHUNK_MAX 60000
struct cl_target_string{const unsigned char*p;size_t n;};
struct cl_target_request{unsigned opcode,kind,phase,readonly;uint64_t epoch;struct cl_target_string nonce,active_identity,owner_identity,root_identity,scope_identity,container,image,installation,hashes,config_hash,project,root,scope,sid,engine,origin,name;};
struct cl_target_helper{unsigned opcode;const char*path;unsigned char content_sha[32];};
struct cl_target_plan{unsigned opcode;const char*argv[64];unsigned argc,timeout,executable,allow_empty;const unsigned char*input;size_t input_bytes,output_cap;};
struct cl_target_result{int exit_code;size_t bytes,stderr_bytes;int reaped;};
struct cl_target_ops{
 void*ctx;const char*config_directory;const struct cl_target_helper*helpers;unsigned helper_count;
 /* Must bind actual current SID/root/lease/epoch/files/container/image/labels.
    Mutating helper16/17 additionally require dispatched lease. No adoption. */
 int(*current)(void*,const struct cl_target_request*,int effect);
 int(*guards)(void*);int(*engine)(void*,struct cl_target_string expected);
 /* Must admit actual fixed helper+dependency closure against publisher hash.
    ImageID alone or hash-before-path-import is insufficient. Missing proof refuses. */
 int(*helper)(void*,const struct cl_target_request*,const struct cl_target_helper*);
 /* Native backend uses only its held signed CLI/context/endpoint, explicit
    private handles/environment/job/deadline and confirmed descendant reap. */
 /* Reads DATABASE_URL only from held protected web.env with request file hash. */
 int(*database_url)(void*,const struct cl_target_request*,unsigned char*,size_t,size_t*);
 int(*run)(void*,const struct cl_target_plan*,unsigned char*,size_t,struct cl_target_result*);
};
struct cl_target_capture{unsigned char output[CL_TARGET_INSPECT_MAX],input[CL_TARGET_INPUT_MAX],database_url[4096],helper_request[CL_TARGET_HELPER_MAX];char cid[65],node[37],owner_source[180];size_t used,offset;uint32_t source;int active,busy;};
int cl_target_parse(const unsigned char*,size_t,struct cl_target_request*);
/* 0 capture ready, 4 refused before dispatch, 5 dispatched/unknown. No release. */
int cl_target_begin(struct cl_target_capture*,const struct cl_target_ops*,uint32_t,const unsigned char*,size_t);
int cl_target_read(struct cl_target_capture*,uint32_t,size_t,unsigned char*,size_t,size_t*,int*);
int cl_target_cancel(struct cl_target_capture*,uint32_t);
void cl_target_abort(struct cl_target_capture*);
#endif
