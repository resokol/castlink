/* Only fixed native opcode43 control-status exec calls this collector. No raw
   error bytes leave the private stream. Known startup pending requires exact
   fixed error bytes, exit1, no stdout,
   two fully drained EOFs, signaled child and confirmed job/process reap. */
static int private_control_result(struct worker*w,unsigned char*out,size_t cap,size_t*length){
 static unsigned char error_bytes[1152];static const char prefix[]="CONTROL_REQUEST_FAILED\n";static const char missing[]="{\"privateControl\":\"startup-pending\"}\n";
 size_t used=0,error_used=0,i;DWORD n,got,code,pipe_error;int out_eof=0,error_eof=0,result=0,reaped;
 if(!w||!out||!length||!w->live)goto done;
 while(now()<w->deadline&&node_alive()){
  if(!error_eof){if(PeekNamedPipe(w->error,0,0,0,&n,0)){if(n){if(n>sizeof(error_bytes)-error_used||!ReadFile(w->error,error_bytes+error_used,n,&got,0)||!got)goto done;error_used+=got;}}
   else{pipe_error=GetLastError();if(pipe_error!=ERROR_BROKEN_PIPE||WaitForSingleObject(w->process.hProcess,0)!=WAIT_OBJECT_0)goto done;error_eof=1;}}
  if(!out_eof){if(PeekNamedPipe(w->output,0,0,0,&n,0)){if(n){if(n>cap-used||!ReadFile(w->output,out+used,n,&got,0)||!got)goto done;used+=got;}}
   else{pipe_error=GetLastError();if(pipe_error!=ERROR_BROKEN_PIPE||WaitForSingleObject(w->process.hProcess,0)!=WAIT_OBJECT_0)goto done;out_eof=1;}}
  if(out_eof&&error_eof){if(WaitForSingleObject(w->process.hProcess,0)!=WAIT_OBJECT_0||!GetExitCodeProcess(w->process.hProcess,&code))goto done;
   if(code==0){if(!used||error_used)goto done;reaped=reap(w,0);if(!reaped||w->live)goto done;*length=used;result=1;goto done;}
   if(code!=1||used||error_used!=sizeof(prefix)-1)goto done;
   for(i=0;i<sizeof(prefix)-1;i++)if(error_bytes[i]!=(unsigned char)prefix[i])goto done;
   if(cap<sizeof(missing)-1)goto done;
   /* reap(false) returns false for confirmed exit1 after dispose; its live flag
      remains true for every failed wait/accounting/reap path. */
   reaped=reap(w,0);if(reaped||w->live)goto done;for(i=0;i<sizeof(missing)-1;i++)out[i]=(unsigned char)missing[i];*length=sizeof(missing)-1;result=2;goto done;
  }Sleep(2);
 }
 done:for(i=0;i<sizeof(error_bytes);i++){volatile unsigned char*p=error_bytes;p[i]=0;}return result;
}
