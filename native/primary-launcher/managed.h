#ifndef CL_MANAGED_H
#define CL_MANAGED_H
#include "core.h"
#define CL_MANAGED_MAX_BYTES 1048576
/* Pure fixed-loader renderer, no caller assembly/script authority. */
int cl_managed_prefix(uint16_t*out,size_t capacity,const uint16_t*path,uint64_t bytes,const unsigned char hash[32],const uint16_t*script);
#endif
