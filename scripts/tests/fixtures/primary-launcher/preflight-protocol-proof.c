#include <assert.h>
#include <string.h>
#include "protocol.h"
#include "docker.h"
int main(void){struct cl_request r;unsigned char f[64]={1,14,0,0,1,0,0,0};const char*observe="{\"action\":\"observe\"}";memcpy(f+8,observe,strlen(observe));assert(cl_parse_request(f,8+strlen(observe),0,&r));assert(r.opcode==14);assert(cl_catalog_json(14,r.body,r.bytes,0));assert(cl_catalog_json(14,r.body,r.bytes,1));assert(!cl_catalog_json(14,(const unsigned char*)"{\"action\":\"observe\",\"path\":\"evil\"}",34,0));f[1]=13;assert(!cl_parse_request(f,8+strlen(observe),0,&r));return 0;}
