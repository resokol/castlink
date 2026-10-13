#include "managed.h"
static int text(uint16_t*out,size_t cap,size_t*at,const char*s){size_t i;for(i=0;s[i];i++){if(*at>=cap-1)return 0;out[(*at)++]=(unsigned char)s[i];}return 1;}
int cl_managed_prefix(uint16_t*out,size_t cap,const uint16_t*path,uint64_t bytes,const unsigned char hash[32],const uint16_t*script){
 static const char hex[]="0123456789abcdef";size_t at=0,i,n=0;unsigned char digits[10];unsigned count=0;uint32_t value;
 if(!out||cap<2||!path||!script||!hash||!bytes||bytes>CL_MANAGED_MAX_BYTES||path[0]<'A'||path[0]>'Z'||path[1]!=':'||path[2]!='\\')return 0;
 if(!text(out,cap,&at,"$ErrorActionPreference='Stop';try{$clFile=[IO.File]::Open('"))return 0;
 for(i=0;path[i];i++){uint16_t c=path[i];if(i>=CL_MAX_PATH-1||c<32||c==127||c=='/'||c=='"'||(i>1&&c==':')||(c>=0xd800&&c<=0xdfff))return 0;if(at>=cap-1)return 0;out[at++]=c;if(c=='\''){if(at>=cap-1)return 0;out[at++]=c;}}
 if(!text(out,cap,&at,"',[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);try{if($clFile.Length -ne "))return 0;
 value=(uint32_t)bytes;do{digits[count++]=(unsigned char)('0'+value%10);value/=10;}while(value);while(count){if(at>=cap-1)return 0;out[at++]=digits[--count];}
 if(!text(out,cap,&at,"){throw 'managed size'};$clBytes=[byte[]]::new([int]$clFile.Length);$clAt=0;while($clAt -lt $clBytes.Length){$clN=$clFile.Read($clBytes,$clAt,$clBytes.Length-$clAt);if($clN -lt 1){throw 'managed read'};$clAt+=$clN};if($clFile.ReadByte() -ne -1){throw 'managed growth'};$clSha=[Security.Cryptography.SHA256]::Create();try{$clHash=[BitConverter]::ToString($clSha.ComputeHash($clBytes)).Replace('-','').ToLowerInvariant()}finally{$clSha.Dispose()};if($clHash -cne '"))return 0;
 for(i=0;i<32;i++){if(at+2>=cap)return 0;out[at++]=hex[hash[i]>>4];out[at++]=hex[hash[i]&15];}
 if(!text(out,cap,&at,"'){throw 'managed hash'};$clAssembly=[Reflection.Assembly]::Load($clBytes);[Array]::Clear($clBytes,0,$clBytes.Length)}finally{$clFile.Dispose()}}catch{exit 4};\n"))return 0;
 while(script[n]){if(n>=28000||at>=cap-1)return 0;out[at++]=script[n++];}out[at]=0;return 1;
}
