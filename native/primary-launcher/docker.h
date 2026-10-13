#ifndef CL_DOCKER_H
#define CL_DOCKER_H
#include <stddef.h>
#include <stdint.h>
struct cl_docker_candidate {unsigned machine;const unsigned char*base;size_t base_bytes;uint32_t desktop_bytes,docker_bytes;const unsigned char*desktop_sha;const unsigned char*docker_sha;uint32_t compose_bytes;const unsigned char*compose_sha;unsigned context_kind;const unsigned char*profile;size_t profile_bytes;uint32_t config_bytes,metadata_bytes;const unsigned char*config_sha;const unsigned char*metadata_sha;};
/* Fixed observation output only; no caller path/argv is admitted by opcode7. */
int cl_parse_docker_candidate(const unsigned char*bytes,size_t length,struct cl_docker_candidate*out);
int cl_docker_preflight_result(const unsigned char*server,size_t server_bytes,const unsigned char*compose,size_t compose_bytes,const unsigned char*docker_sha,const unsigned char*compose_sha,unsigned char*out,size_t capacity,size_t*used);
int cl_docker_engine_result(const unsigned char*bytes,size_t length,unsigned char*out,size_t capacity,size_t*used);
int cl_docker_environment(const uint16_t*file,const uint16_t*system_root,uint16_t*out,size_t capacity);
int cl_compose_environment(const uint16_t*file,const uint16_t*directory,const uint16_t*system_root,uint16_t*out,size_t capacity);
int cl_compose_worker_environment(const uint16_t*file,const uint16_t*directory,const uint16_t*system_root,const uint16_t*scratch,uint16_t*out,size_t capacity);
int cl_match_docker_context_selection(const unsigned char*bytes,size_t length,unsigned kind,const unsigned char*config_sha,const unsigned char*metadata_sha);
#endif
