#include <assert.h>
#include <stdio.h>
#include "root-catalog.h"
static unsigned char bytes[12289];
int main(int argc,char**argv){struct cl_target_request q;FILE*f;size_t n;assert(argc==2);f=fopen(argv[1],"rb");assert(f);n=fread(bytes,1,sizeof(bytes),f);assert(!ferror(f));fclose(f);assert(cl_root_parse(bytes,n,&q));if(q.opcode==34){assert(q.container.n==64&&q.image.n==64&&q.config_hash.n==64&&q.container.p[0]=='a'&&q.image.p[0]=='b'&&q.config_hash.p[0]=='c');}else assert(!q.container.n&&!q.image.n&&!q.config_hash.n);assert(q.kind==3||q.kind==4);if(q.readonly)assert(!q.nonce.n&&!q.owner_identity.n&&!q.active_identity.n&&(q.opcode<31||q.opcode==34));else assert(q.nonce.n==64&&q.owner_identity.n==25&&q.active_identity.n==25);assert(!cl_root_parse(bytes,n-1,&q));bytes[10]=99;assert(!cl_root_parse(bytes,n,&q));puts("fixed root envelope PASS");return 0;}
