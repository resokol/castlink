#ifndef CL_TARGET_RECORD_H
#define CL_TARGET_RECORD_H
#include "target-catalog.h"
int cl_target_owner_record(const unsigned char*,size_t,const struct cl_target_request*,uint32_t,const char*,const char*);
int cl_target_epoch_record(const unsigned char*,size_t,uint64_t);
#endif
