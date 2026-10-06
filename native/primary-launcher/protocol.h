#ifndef CL_PRIMARY_PROTOCOL_H
#define CL_PRIMARY_PROTOCOL_H
#include <stdint.h>
#include <stddef.h>
#define CL_MAX_REQUEST 65536
/* Envelope AFTER length: version=1, opcode, reserved=0, requestId LE32, body.
   Length includes eight envelope bytes. IDs are strictly monotonic per channel.
   Operation IDs 1/2 synchronous, 3 begin, 4 frame, 5 finish, 6 abort, 7 protected engine observation, 8 closed context finalize; 9/10/11 bounded CONFIG write begin/chunk/finalize; 12 fixed setup private directory inspect/create. */
struct cl_request {unsigned opcode;uint32_t id;const unsigned char*body;size_t bytes;};
int cl_parse_request(const unsigned char*bytes,size_t length,uint32_t previous,struct cl_request*out);
/* Flat exact catalog JSON: no executable/script/env fields; duplicate keys refuse. */
int cl_catalog_json(unsigned opcode,const unsigned char*bytes,size_t length,int readonly);

struct cl_config_write {uint32_t declared,used;unsigned char body[131072];};
void cl_config_write_reset(struct cl_config_write*state);
/* 0 rejects and wipes; 1 bounded empty ACK; 2 exact validated write ready.
   Caller must wipe after fixed helper completion/abort. Never grants a lease. */
int cl_config_write_step(struct cl_config_write*state,unsigned opcode,const unsigned char*bytes,size_t length,int readonly);
#endif
