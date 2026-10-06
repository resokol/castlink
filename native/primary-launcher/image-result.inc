/* Only fixed native cache-probe opcode37 calls this collector. No error bytes
   leave the private stream. Known absence requires exact reference association,
   two fully drained EOFs, signaled child and confirmed job/process reap. */
static int cache_image_result(struct worker*w,const char*reference,unsigned char*out,size_t cap,size_t*length){
 static unsigned char error_bytes[1152];static const char prefix[]="Error response from daemon: No such image: ";static const char missing[]="{\"cache\":\"missing\"}\n";
 size_t used=0,error_used=0,reference_bytes=0,i;DWORD n,got,code,pipe_error,state;int out_eof=0,error_eof=0,result=0,reaped;
 capture_reason=1;capture_code=0;
 if(!w||!reference||!out||!length||!w->live)goto done;
 while(reference_bytes<1025&&reference[reference_bytes])reference_bytes++;if(!reference_bytes||reference_bytes>1024)goto done;
 while(now()<w->deadline&&node_alive()){
  if(!error_eof){if(PeekNamedPipe(w->error,0,0,0,&n,0)){if(n){if(n>sizeof(error_bytes)-error_used||!ReadFile(w->error,error_bytes+error_used,n,&got,0)||!got){capture_reason=3;goto done;}error_used+=got;}}
   else{pipe_error=GetLastError();if(pipe_error!=ERROR_BROKEN_PIPE){capture_reason=3;goto done;}error_eof=1;}}
  if(!out_eof){if(PeekNamedPipe(w->output,0,0,0,&n,0)){if(n){if(n>cap-used){capture_reason=4;goto done;}if(!ReadFile(w->output,out+used,n,&got,0)||!got){capture_reason=5;goto done;}used+=got;}}
   else{pipe_error=GetLastError();if(pipe_error!=ERROR_BROKEN_PIPE){capture_reason=6;goto done;}out_eof=1;}}
  state=WaitForSingleObject(w->process.hProcess,0);if(state!=WAIT_OBJECT_0&&state!=WAIT_TIMEOUT){capture_reason=7;goto done;}
  if(out_eof&&error_eof&&state==WAIT_OBJECT_0){if(!GetExitCodeProcess(w->process.hProcess,&code)){capture_reason=8;goto done;}
   if(code==0){if(!used){capture_reason=10;goto done;}if(error_used){capture_reason=2;goto done;}reaped=reap(w,0);if(!reaped||w->live){capture_reason=11;goto done;}*length=used;result=1;goto done;}
   if(code!=1){capture_reason=9;capture_code=code>255?256:(unsigned)code;goto done;}if(used&&!(used==1&&out[0]=='\n')){capture_reason=10;goto done;}capture_reason=2;if(error_used<sizeof(prefix)||error_bytes[error_used-1]!='\n')goto done;
   for(i=0;i<sizeof(prefix)-1;i++)if(error_bytes[i]!=(unsigned char)prefix[i])goto done;
   /* Docker canonicalizes the two official library names in missing-image
      errors. Only their exact requested digest may survive normalization;
      other registries, names and error bodies retain the full-ref policy. */
   {static const size_t offsets[3]={0,10,18};size_t count=1,k,error_reference_bytes=error_used-(sizeof(prefix)-1)-1;int matched=0;
    static const char caddy[]="docker.io/library/caddy@sha256:",postgres[]="docker.io/library/postgres@sha256:";
    const char*official=reference_bytes==sizeof(caddy)-1+64?caddy:reference_bytes==sizeof(postgres)-1+64?postgres:0;
    if(official){size_t prefix_bytes=reference_bytes-64;for(i=0;i<prefix_bytes;i++)if(reference[i]!=official[i])break;if(i==prefix_bytes)count=3;}
    for(k=0;k<count;k++){size_t offset=offsets[k];if(error_reference_bytes!=reference_bytes-offset)continue;
     for(i=0;i<error_reference_bytes;i++)if(error_bytes[sizeof(prefix)-1+i]!=(unsigned char)reference[offset+i])break;
     if(i==error_reference_bytes){matched=1;break;}}
    if(!matched)goto done;
   }
   if(cap<sizeof(missing)-1){capture_reason=4;goto done;}
   /* reap(false) returns false for confirmed exit1 after dispose; its live flag
      remains true for every failed wait/accounting/reap path. */
   reaped=reap(w,0);if(reaped||w->live){capture_reason=11;goto done;}for(i=0;i<sizeof(missing)-1;i++)out[i]=(unsigned char)missing[i];*length=sizeof(missing)-1;result=2;goto done;
  }Sleep(2);
 }
 done:if(result)capture_reason=capture_code=0;for(i=0;i<sizeof(error_bytes);i++){volatile unsigned char*p=error_bytes;p[i]=0;}return result;
}
