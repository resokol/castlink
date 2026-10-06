#ifndef CASTLINK_PRIMARY_CORE_H
#define CASTLINK_PRIMARY_CORE_H
#include <stddef.h>
#include <stdint.h>
#define CL_MAX_FILES 512
#define CL_MAX_GUARDS 1024
#define CL_MAX_PATH 1024
#define CL_MAX_COMMAND 32768
struct cl_item {const uint16_t *path;uint64_t bytes;unsigned char hash[32];};
struct cl_sha {uint32_t h[8];uint64_t bytes;unsigned char block[64];unsigned used;};
void cl_sha_init(struct cl_sha *s);
int cl_sha_update(struct cl_sha *s,const unsigned char *bytes,size_t n);
void cl_sha_final(struct cl_sha *s,unsigned char hash[32]);
int cl_quote(uint16_t *out,size_t capacity,size_t *used,const uint16_t *arg);
/* Explicit application-state data only; no ambient executable/environment trust. */
int cl_primary_environment(const uint16_t *profile,const uint16_t *modules,const uint16_t *system_root,uint16_t *output,size_t capacity);
struct cl_ops {
 void *ctx;
 int (*guard)(void *ctx,unsigned index);
 int (*verify)(void *ctx,unsigned index);
 int (*inherit)(void *ctx,unsigned count);
 int (*spawn)(void *ctx);
 int (*wait)(void *ctx,unsigned *status);
 void (*close)(void *ctx,unsigned count);
};
/* Failure before successful spawn closes parent handles; after spawn close only
   after wait confirms exit. A failed wait intentionally retains handles. */
int cl_run(const struct cl_ops *ops,unsigned count,unsigned *status);
#endif
