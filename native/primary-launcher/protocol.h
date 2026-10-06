#ifndef CL_PRIMARY_PROTOCOL_H
#define CL_PRIMARY_PROTOCOL_H
#include <stdint.h>
#include <stddef.h>
#define CL_MAX_REQUEST 65536
/* Envelope AFTER length: version=1, opcode, reserved=0, requestId LE32, body.
   Length includes eight envelope bytes. IDs are strictly monotonic per channel.
   Operation IDs 1/2 synchronous, 3 begin, 4 frame, 5 finish, 6 abort, 7 protected engine observation. */
struct cl_request {unsigned opcode;uint32_t id;const unsigned char*body;size_t bytes;};
int cl_parse_request(const unsigned char*bytes,size_t length,uint32_t previous,struct cl_request*out);
/* Flat exact catalog JSON: no executable/script/env fields; duplicate keys refuse. */
int cl_catalog_json(unsigned opcode,const unsigned char*bytes,size_t length,int readonly);

#endif
