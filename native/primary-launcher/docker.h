#ifndef CL_DOCKER_H
#define CL_DOCKER_H
#include <stddef.h>
#include <stdint.h>
struct cl_docker_candidate {unsigned machine;const unsigned char*base;size_t base_bytes;uint32_t desktop_bytes,docker_bytes;const unsigned char*desktop_sha;const unsigned char*docker_sha;};
/* Fixed observation output only; no caller path/argv is admitted by opcode7. */
int cl_parse_docker_candidate(const unsigned char*bytes,size_t length,struct cl_docker_candidate*out);
int cl_docker_engine_result(const unsigned char*bytes,size_t length,unsigned char*out,size_t capacity,size_t*used);
int cl_docker_environment(const uint16_t*file,const uint16_t*system_root,uint16_t*out,size_t capacity);
#endif
