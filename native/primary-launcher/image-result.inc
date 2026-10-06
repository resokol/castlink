/* Only fixed native cache-probe opcode37 calls this collector. No error bytes
   leave the private stream. Known absence requires exact reference association,
   two fully drained EOFs, signaled child and confirmed job/process reap. */
static int cache_image_result(struct worker*w,const char*reference,unsigned char*out,size_t cap,size_t*length){
 static unsigned char error_bytes[1152];static const char prefix[]="Error response from daemon: No such image: ";static const char missing[]="{\"cache\":\"missing\"}\n";
 size_t used=0,error_used=0,reference_bytes=0,i;DWORD n,got,code,pipe_error,state;int out_eof=0,error_eof=0,result=0,reaped;
 if(!w||!reference||!out||!length||!w->live)goto done;
 while(reference_bytes<1025&&reference[reference_bytes])reference_bytes++;if(!reference_bytes||reference_bytes>1024)goto done;
 while(now()<w->deadline&&node_alive()){
  if(!error_eof){if(PeekNamedPipe(w->error,0,0,0,&n,0)){if(n){if(n>sizeof(error_bytes)-error_used||!ReadFile(w->error,error_bytes+error_used,n,&got,0)||!got)goto done;error_used+=got;}}
   else{pipe_error=GetLastError();if(pipe_error!=ERROR_BROKEN_PIPE)goto done;error_eof=1;}}
  if(!out_eof){if(PeekNamedPipe(w->output,0,0,0,&n,0)){if(n){if(n>cap-used||!ReadFile(w->output,out+used,n,&got,0)||!got)goto done;used+=got;}}
   else{pipe_error=GetLastError();if(pipe_error!=ERROR_BROKEN_PIPE)goto done;out_eof=1;}}
  state=WaitForSingleObject(w->process.hProcess,0);if(state!=WAIT_OBJECT_0&&state!=WAIT_TIMEOUT)goto done;
  if(out_eof&&error_eof&&state==WAIT_OBJECT_0){if(!GetExitCodeProcess(w->process.hProcess,&code))goto done;
   if(code==0){if(!used||error_used)goto done;reaped=reap(w,0);if(!reaped||w->live)goto done;*length=used;result=1;goto done;}
   if(code!=1||used||error_used!=sizeof(prefix)-1+reference_bytes+1)goto done;
   for(i=0;i<sizeof(prefix)-1;i++)if(error_bytes[i]!=(unsigned char)prefix[i])goto done;
   for(i=0;i<reference_bytes;i++)if(error_bytes[sizeof(prefix)-1+i]!=(unsigned char)reference[i])goto done;
   if(error_bytes[error_used-1]!='\n'||cap<sizeof(missing)-1)goto done;
   /* reap(false) returns false for confirmed exit1 after dispose; its live flag
      remains true for every failed wait/accounting/reap path. */
   reaped=reap(w,0);if(reaped||w->live)goto done;for(i=0;i<sizeof(missing)-1;i++)out[i]=(unsigned char)missing[i];*length=sizeof(missing)-1;result=2;goto done;
  }Sleep(2);
 }
 done:for(i=0;i<sizeof(error_bytes);i++){volatile unsigned char*p=error_bytes;p[i]=0;}return result;
}
