#include <assert.h>
#include <stdio.h>
#include <string.h>
#include "root-catalog.c"
static char out[1025],deep[512];
static int select_image(const char*model,const char*service){return compose_service_image((const unsigned char*)model,strlen(model),service,out,sizeof(out));}
int main(void){size_t i,at;const char*good="{\"name\":\"own\",\"services\":{\"postgres\":{\"image\":\"pg\"},\"web\":{\"depends_on\":{\"postgres\":{\"condition\":\"service_healthy\"}},\"environment\":{\"quote\\\"key\":\"value\\n\"},\"image\":\"web\"},\"livekit\":{\"image\":\"lk\"},\"caddy\":{\"image\":\"ca\"}},\"extension\":[null,true,false,-1.5e+2]}";
 assert(select_image(good,"web")&&!strcmp(out,"web"));assert(select_image(good,"postgres")&&!strcmp(out,"pg"));assert(select_image(good,"livekit")&&!strcmp(out,"lk"));assert(select_image(good,"caddy")&&!strcmp(out,"ca"));
 assert(select_image("{\"services\":{\"web\":{\"image\":\"right\"},\"postgres\":{\"image\":\"wrong\"}}}","web")&&!strcmp(out,"right"));
 assert(!select_image("{\"nested\":{\"services\":{\"web\":{\"image\":\"decoy\"}}}}","web"));assert(!select_image("{\"services\":{\"postgres\":{\"image\":\"decoy\"}}}","web"));assert(!select_image("{\"services\":{\"web\":{\"nested\":{\"image\":\"decoy\"}}}}","web"));
 assert(!select_image("{\"services\":{},\"services\":{\"web\":{\"image\":\"bad\"}}}","web"));assert(!select_image("{\"services\":{\"web\":{\"image\":\"one\"},\"web\":{\"image\":\"two\"}}}","web"));assert(!select_image("{\"services\":{\"web\":{\"image\":\"one\",\"image\":\"two\"}}}","web"));
 assert(!select_image("{\"serv\\u0069ces\":{\"web\":{\"image\":\"bad\"}}}","web"));assert(!select_image("{\"services\":{\"web\":{\"image\":\"escaped\\/ref\"}}}","web"));assert(!select_image("{\"services\":{\"web\":{\"image\":null}}}","web"));assert(!select_image("{\"services\":{\"web\":{\"image\":\"\"}}}","web"));
 assert(!select_image("{\"services\":{\"web\":{\"image\":\"x\"}}} trailing","web"));assert(!select_image("{\"services\":{\"web\":{\"image\":\"x\"}},\"invalid\":01}","web"));assert(!select_image("{\"services\":{\"web\":{\"image\":\"x\"}},\"invalid\":[true,]}","web"));assert(!select_image("{\"services\":{\"web\":{\"image\":\"x\"}}","web"));
 assert(!compose_service_image((const unsigned char*)good,CL_ROOT_OUTPUT_MAX+1,"web",out,sizeof(out)));assert(!compose_service_image((const unsigned char*)good,strlen(good),"web",out,3));
 at=0;memcpy(deep,"{\"other\":",9);at=9;for(i=0;i<66;i++)deep[at++]='[';deep[at++]='0';for(i=0;i<66;i++)deep[at++]=']';deep[at++]='}';deep[at]=0;assert(!select_image(deep,"web"));
 puts("actual Compose JSON service selection controls PASS");return 0;
}
