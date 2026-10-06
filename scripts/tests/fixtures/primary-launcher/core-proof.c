#include <assert.h>
#include <string.h>
#include <stdio.h>
#include "core.h"
static void hashproof(void){
 struct cl_sha s;unsigned char h[32];unsigned i;const char*hex="ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
 cl_sha_init(&s);assert(cl_sha_update(&s,(const unsigned char*)"a",1));assert(cl_sha_update(&s,(const unsigned char*)"bc",2));cl_sha_final(&s,h);
 for(i=0;i<32;i++){char x[3]="00";const char*d="0123456789abcdef";x[0]=d[h[i]>>4];x[1]=d[h[i]&15];assert(x[0]==hex[i*2]&&x[1]==hex[i*2+1]);}
}
struct model{unsigned step,fail,live,spawned,closed,waited;};
static int event(struct model*m){return ++m->step!=m->fail;}
static int guard(void*x,unsigned i){struct model*m=x;assert(i==m->live);if(!event(m))return 0;m->live++;return 1;}
static int verify(void*x,unsigned i){struct model*m=x;assert(m->live==3&&i<3);return event(m);}
static int inherit(void*x,unsigned n){struct model*m=x;assert(n==m->live&&n==3);return event(m);}
static int spawn(void*x){struct model*m=x;if(!event(m))return 0;m->spawned=1;return 1;}
static int waitchild(void*x,unsigned*s){struct model*m=x;assert(m->spawned&&m->live==3);if(!event(m))return 0;m->waited=1;*s=7;return 1;}
static void closeguards(void*x,unsigned n){struct model*m=x;assert(n==m->live);assert(!m->spawned||m->waited);m->closed=n;m->live=0;}
static void orderproof(unsigned fail){struct model m={0};unsigned status=99;struct cl_ops o={&m,guard,verify,inherit,spawn,waitchild,closeguards};m.fail=fail;
 int ok=cl_run(&o,3,&status);if(!fail){assert(ok&&status==7&&m.closed==3&&m.waited);}else{assert(!ok);if(fail<=8)assert(!m.spawned&&m.live==0);else assert(m.spawned&&m.live==3&&!m.closed);}
}
static void quoteproof(void){uint16_t out[64]={0};size_t n=0;const uint16_t a[]={'a',' ','b','\\','"','c','\\',0};const uint16_t want[]={'"','a',' ','b','\\','\\','\\','"','c','\\','\\','"',0};assert(cl_quote(out,64,&n,a));assert(n==12&&!memcmp(out,want,sizeof(want)));n=0;assert(!cl_quote(out,4,&n,a));}
static void differential(const char*name,const char*hex){FILE*f=fopen(name,"rb");struct cl_sha s;unsigned char b[17],hash[32];size_t n;unsigned i;const char*d="0123456789abcdef";assert(f);cl_sha_init(&s);while((n=fread(b,1,sizeof(b),f)))assert(cl_sha_update(&s,b,n));assert(!ferror(f));fclose(f);cl_sha_final(&s,hash);for(i=0;i<32;i++)assert(d[hash[i]>>4]==hex[i*2]&&d[hash[i]&15]==hex[i*2+1]);}
int main(int argc,char**argv){unsigned i;assert(argc==2||argc==4);if(argv[1][0]=='d'){assert(argc==4);differential(argv[2],argv[3]);return 0;}if(argv[1][0]=='h')hashproof();else if(argv[1][0]=='q')quoteproof();else{orderproof(0);for(i=1;i<=9;i++)orderproof(i);}return 0;}
