#include <assert.h>
#include <stdio.h>
#include <string.h>
#include "root-catalog.h"
#include "private-volume-publisher.h"
static struct cl_root_capture state;static unsigned char packet[12289],out[60000];static size_t bytes;static unsigned calls,effects,checks;static int existing,wrong_image,lost_reap,changed_post;static const char*volume="castlink-12345678123412341234123456789abc_private_control";
static int current(void*c,const struct cl_target_request*q,int effect){(void)c;assert(q->opcode==38&&q->kind==3&&!q->readonly&&!q->container.n&&!q->image.n&&effect);checks++;return !changed_post||checks<5;}
static int guards(void*c){(void)c;return 1;}
static int engine(void*c,struct cl_target_string e){(void)c;assert(e.n==6&&!memcmp(e.p,"engine",6));return 1;}
static int run(void*c,const struct cl_target_plan*p,unsigned char*b,size_t cap,struct cl_target_result*r){const char*text;(void)c;calls++;assert(p->opcode==38&&p->timeout==30000&&!p->input_bytes);if(calls==1){assert(p->executable==1&&p->argc==13&&!strcmp(p->argv[12],"livekit"));text=wrong_image?"sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff":cl_private_volume_image_id;}else{assert(p->executable==0&&!strcmp(p->argv[1],"npipe:////./pipe/dockerDesktopLinuxEngine")&&!strcmp(p->argv[3],"D:\\package\\metadata\\docker-config"));if(calls==2){assert(p->argc==7&&!strcmp(p->argv[5],"ls")&&p->allow_empty);text=existing?"castlink-12345678123412341234123456789abc_private_control\n":"";}else if(calls==3){effects++;assert(p->argc==15&&!strcmp(p->argv[5],"create")&&!strcmp(p->argv[7],"local")&&!strcmp(p->argv[9],"com.docker.compose.project=castlink-12345678123412341234123456789abc")&&!strcmp(p->argv[11],"com.docker.compose.volume=private_control")&&!strcmp(p->argv[13],"io.castlink.private-storage=12345678-1234-1234-1234-123456789abc")&&!strcmp(p->argv[14],volume));text="castlink-12345678123412341234123456789abc_private_control\n";}else{assert(calls==4&&p->argc==9&&!strcmp(p->argv[5],"inspect")&&!strcmp(p->argv[8],volume));assert(strstr(p->argv[7],"(eq (len .Labels) 3)")&&strstr(p->argv[7],"io.castlink.private-storage"));text="CL_PRIVATE_VOLUME_V1\n";}}
 r->bytes=strlen(text);assert(r->bytes<=cap);memcpy(b,text,r->bytes);r->reaped=!(lost_reap&&calls==3);r->exit_code=0;r->stderr_bytes=0;return 1;}
static void reset(void){cl_root_abort(&state);calls=effects=checks=0;existing=wrong_image=lost_reap=changed_post=0;}
int main(int argc,char**argv){FILE*f;struct cl_root_ops ops;size_t n;int done;assert(argc==2);f=fopen(argv[1],"rb");assert(f);bytes=fread(packet,1,sizeof(packet),f);fclose(f);ops.target.ctx=0;ops.target.config_directory="D:\\package\\metadata\\docker-config";ops.target.current=current;ops.target.guards=guards;ops.target.engine=engine;ops.target.run=run;ops.empty_env_file="D:\\package\\metadata\\compose-empty.env";
 reset();assert(cl_root_begin(&state,&ops,1,packet,bytes)==0&&calls==4&&effects==1);assert(cl_root_read(&state,1,0,out,sizeof(out),&n,&done)==0&&done&&n==strlen(volume)+1&&!memcmp(out,volume,n-1));
 reset();existing=1;assert(cl_root_begin(&state,&ops,2,packet,bytes)==5&&calls==2&&!effects&&!state.active);
 reset();wrong_image=1;assert(cl_root_begin(&state,&ops,3,packet,bytes)==5&&calls==1&&!effects);
 reset();lost_reap=1;assert(cl_root_begin(&state,&ops,4,packet,bytes)==5&&calls==3&&effects==1&&!state.active);
 reset();changed_post=1;assert(cl_root_begin(&state,&ops,5,packet,bytes)==5&&calls==4&&effects==1&&!state.active);
 reset();packet[9]=4;assert(cl_root_begin(&state,&ops,6,packet,bytes)==4&&!calls);
 puts("fixed volume create controls PASS");return 0;}
