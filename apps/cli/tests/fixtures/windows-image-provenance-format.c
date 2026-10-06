#include <assert.h>
#include <stdint.h>
#include <stddef.h>
#include <string.h>
typedef void*HANDLE;
#define STD_ERROR_HANDLE 2
#define INVALID_HANDLE_VALUE ((HANDLE)(intptr_t)-1)
static unsigned doctor_stage,capture_reason,capture_code,root_provider_stage,root_capture_reason,root_capture_code;
static struct{unsigned diagnostic_stage,diagnostic_service;}root_capture;
static char observed[129];static size_t observed_bytes;
static HANDLE GetStdHandle(unsigned n){assert(n==2);return(HANDLE)(intptr_t)1;}
static int write_all(HANDLE h,const unsigned char*b,size_t n){assert(h==(HANDLE)(intptr_t)1&&n<=128);memcpy(observed,b,n);observed[n]=0;observed_bytes=n;return 1;}
#include "format.inc"
static void reset(void){observed_bytes=0;observed[0]=0;}
int main(void){doctor_stage=43;capture_reason=9;capture_code=4;reset();doctor_refusal(7,5);assert(strstr(observed,"\"operation\":7")&&strstr(observed,"\"stage\":43")&&strstr(observed,"\"captureReason\":9")&&strstr(observed,"\"captureCode\":4"));
 root_capture.diagnostic_stage=14;root_capture.diagnostic_service=4;root_provider_stage=6;root_capture_reason=9;root_capture_code=2;reset();doctor_refusal(37,5);assert(!strcmp(observed,"{\"schemaVersion\":1,\"operation\":37,\"stage\":14,\"status\":5,\"service\":4,\"providerStage\":6,\"captureReason\":9,\"captureCode\":2}\n"));
 root_capture.diagnostic_stage=6;doctor_stage=43;capture_reason=9;capture_code=256;reset();doctor_refusal(35,5);assert(strstr(observed,"\"providerStage\":43")&&strstr(observed,"\"captureCode\":256"));
 root_capture.diagnostic_stage=1;root_capture.diagnostic_service=0;reset();doctor_refusal(35,4);assert(strstr(observed,"\"providerStage\":0")&&strstr(observed,"\"captureReason\":0")&&strstr(observed,"\"captureCode\":0"));
 reset();doctor_refusal(35,0);assert(!observed_bytes);reset();doctor_refusal(99,5);assert(!observed_bytes);root_capture.diagnostic_stage=99;reset();doctor_refusal(37,5);assert(!observed_bytes);root_capture.diagnostic_stage=14;root_capture.diagnostic_service=9;reset();doctor_refusal(37,5);assert(!observed_bytes);root_capture.diagnostic_service=4;root_capture_reason=99;reset();doctor_refusal(37,5);assert(!observed_bytes);
 doctor_stage=7;capture_reason=1;capture_code=0;reset();doctor_refusal(14,5);assert(strstr(observed,"\"operation\":14")&&strstr(observed,"\"captureReason\":1"));return 0;}
