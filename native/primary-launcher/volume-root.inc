/* Fixed private-control volume operations. The name, image selector and labels
   come from the native held installation binding, never caller argv. */
static int volume_plan_run(const struct cl_root_ops*ops,struct cl_target_plan*p,unsigned char*out,size_t*bytes){return run_plan(ops,p,out,bytes)&&ops->target.guards(ops->target.ctx);}
static int volume_root(struct cl_root_capture*s,const struct cl_root_ops*ops,const struct cl_target_request*q,size_t*bytes){
 static char volume[64],iid[37],storage[80],project_label[80],format[2048];
 static unsigned char facts[64];
 static const char marker[]="CL_PRIVATE_VOLUME_V1\n";
 struct cl_target_plan p;size_t i,at=0,n=0,line=0;int found=0;
 if(q->opcode!=38&&q->opcode!=39)return 0;
 if(!text_copy(iid,sizeof(iid),q->installation))return 0;
 for(i=0;i<q->project.n;i++)volume[at++]=(char)q->project.p[i];for(i=0;i<sizeof("_private_control");i++)volume[at++]="_private_control"[i];
 at=0;for(i=0;i<sizeof("io.castlink.private-storage=")-1;i++)storage[at++]="io.castlink.private-storage="[i];for(i=0;i<=q->installation.n;i++)storage[at++]=iid[i];
 at=0;for(i=0;i<sizeof("com.docker.compose.project=")-1;i++)project_label[at++]="com.docker.compose.project="[i];for(i=0;i<=q->project.n;i++)project_label[at++]=s->project[i];
 p.opcode=q->opcode;p.argc=0;p.timeout=30000;p.input=0;p.input_bytes=0;p.output_cap=CL_ROOT_OUTPUT_MAX;p.allow_empty=0;
 if(q->opcode==38){
  if(!compose_image_capture(s,ops,q,"livekit",s->reference,sizeof(s->reference)))return 0;n=0;while(s->reference[n])n++;
  if(!same((const unsigned char*)s->reference,n,cl_private_volume_image_id)||!ops->target.current(ops->target.ctx,q,1)||!ops->target.engine(ops->target.ctx,q->engine))return 0;
  p.executable=0;
  p.argc=0;p.allow_empty=1;p.output_cap=262144;docker_prefix(&p,ops);p.argv[p.argc++]="volume";p.argv[p.argc++]="ls";p.argv[p.argc++]="--quiet";
  if(!volume_plan_run(ops,&p,s->output,&n))return 0;
  for(i=0;i<n;i++){unsigned c=s->output[i];if(c=='\n'){if(i==line||i-line>255)return 0;if(same(s->output+line,i-line,volume))found=1;line=i+1;}else if(!((c>='A'&&c<='Z')||(c>='a'&&c<='z')||(c>='0'&&c<='9')||c=='_'||c=='.'||c=='-'))return 0;}
  if(line!=n||found||!ops->target.current(ops->target.ctx,q,1)||!ops->target.engine(ops->target.ctx,q->engine))return 0;
  p.argc=0;p.allow_empty=0;p.output_cap=8192;docker_prefix(&p,ops);p.argv[p.argc++]="volume";p.argv[p.argc++]="create";p.argv[p.argc++]="--driver";p.argv[p.argc++]="local";p.argv[p.argc++]="--label";p.argv[p.argc++]=project_label;p.argv[p.argc++]="--label";p.argv[p.argc++]="com.docker.compose.volume=private_control";p.argv[p.argc++]="--label";p.argv[p.argc++]=storage;p.argv[p.argc++]=volume;
  if(!volume_plan_run(ops,&p,s->output,&n))return 0;
  /* Any lost, malformed or foreign CREATE reply retains uncertainty. */
  {size_t length=0;while(volume[length])length++;if(n!=length+1||s->output[length]!='\n'||!same(s->output,length,volume))return 0;}
 }
 /* Structural own-volume proof precedes exposing the raw inspection. */
 at=0;
#define VTEXT(t) do{const char*v=(t);size_t j;for(j=0;v[j];j++){if(at>=sizeof(format)-1)return 0;format[at++]=v[j];}}while(0)
 VTEXT("{{if and (eq .Name \"");VTEXT(volume);VTEXT("\") (eq .Driver \"local\") (eq .Scope \"local\") (eq (len .Options) 0) (eq (len .Labels) 3) (eq (index .Labels \"com.docker.compose.project\") \"");VTEXT(s->project);VTEXT("\") (eq (index .Labels \"com.docker.compose.volume\") \"private_control\") (eq (index .Labels \"io.castlink.private-storage\") \"");VTEXT(iid);VTEXT("\")}}CL_PRIVATE_VOLUME_V1{{end}}");format[at]=0;
#undef VTEXT
 p.argc=0;p.output_cap=64;p.allow_empty=0;docker_prefix(&p,ops);p.argv[p.argc++]="volume";p.argv[p.argc++]="inspect";p.argv[p.argc++]="--format";p.argv[p.argc++]=format;p.argv[p.argc++]=volume;
 if(!volume_plan_run(ops,&p,s->output,&n)||!same(s->output,n,marker)||!ops->target.current(ops->target.ctx,q,q->opcode==38)||!ops->target.engine(ops->target.ctx,q->engine))return 0;
 if(q->opcode==38){at=0;while(volume[at]){s->output[at]=(unsigned char)volume[at];at++;}s->output[at++]='\n';*bytes=at;return 1;}
 p.argc=0;p.output_cap=CL_ROOT_OUTPUT_MAX;docker_prefix(&p,ops);p.argv[p.argc++]="volume";p.argv[p.argc++]="inspect";p.argv[p.argc++]=volume;
 if(!volume_plan_run(ops,&p,s->output,bytes)||!ops->target.current(ops->target.ctx,q,0)||!ops->target.engine(ops->target.ctx,q->engine))return 0;
 p.argc=0;p.output_cap=sizeof(facts);docker_prefix(&p,ops);p.argv[p.argc++]="volume";p.argv[p.argc++]="inspect";p.argv[p.argc++]="--format";p.argv[p.argc++]=format;p.argv[p.argc++]=volume;
 return volume_plan_run(ops,&p,facts,&n)&&same(facts,n,marker);
}
