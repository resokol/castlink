import type{CommandResult,Executor,ExecutionRequest,Target}from'../types.js';
import{CliError}from'../types.js';
// Constant remote program; user values and credentials travel only as JSON on stdin.
const helper=`import json,subprocess,sys
r=json.load(sys.stdin)
if not isinstance(r,dict) or set(r)-{'schemaVersion','executable','args','input'} or r.get('schemaVersion')!=1: raise ValueError('Invalid request schema')
allowed={'uname','python3','docker','node','bash','sh','sudo','id','df','test'}
exe=r.get('executable'); args=r.get('args')
if exe not in allowed or not isinstance(args,list) or not all(isinstance(x,str) and '\\x00' not in x for x in args): raise ValueError('Invalid execution request')
text=r.get('input')
if text is not None and not isinstance(text,str): raise ValueError('Invalid stdin')
# Capture bytes: text=True performs universal-newline conversion and breaks raw digests.
p=subprocess.run([exe,*args],input=text.encode('utf-8') if text is not None else None,capture_output=True,timeout=120)
sys.stdout.write(json.dumps({'code':p.returncode,'stdout':p.stdout.decode('utf-8'),'stderr':p.stderr.decode('utf-8')}))
`;
export function sshInvocation(target:Extract<Target,{kind:'remote'}>,request:ExecutionRequest):ExecutionRequest{
 if(!/^[a-zA-Z0-9][a-zA-Z0-9.:-]{0,252}$/.test(target.host)||!/^[a-z_][a-z0-9_-]{0,31}$/.test(target.user)||!Number.isInteger(target.port)||target.port<1||target.port>65535)throw new CliError('Invalid SSH target.');
 const remoteCommand="python3 -c '"+helper.replaceAll("'","'\\''")+"'";
 return{executable:'ssh',args:['-o','StrictHostKeyChecking=yes','-o','BatchMode=yes','-o','PasswordAuthentication=no','-o','KbdInteractiveAuthentication=no','-o','PreferredAuthentications=publickey','-o','UpdateHostKeys=no','-o','CheckHostIP=no','-o','VerifyHostKeyDNS=no','-o','ConnectTimeout=10','-p',String(target.port),'-l',target.user,'--',target.host,remoteCommand],input:Buffer.from(JSON.stringify({schemaVersion:1,executable:request.executable,args:request.args,...(request.input?{input:Buffer.from(request.input).toString('utf8')}:{})})),sensitive:request.sensitive};
}
export class SshExecutor implements Executor{
 constructor(readonly target:Extract<Target,{kind:'remote'}>,readonly transport:Executor){}
 async run(request:ExecutionRequest):Promise<CommandResult>{
  const result=await this.transport.run(sshInvocation(this.target,request));
  if(result.code!==0)throw new CliError('SSH недоступен: проверь OpenSSH, доверенный ключ сервера, SSH-ключ и Python3 на VPS. Проверка ключа сервера не отключается.',3);
  let data:CommandResult;try{data=JSON.parse(result.stdout);}catch{throw new CliError('Некорректный ответ SSH helper.',1);}
  if(!data||!Number.isInteger(data.code)||typeof data.stdout!=='string'||typeof data.stderr!=='string')throw new CliError('Некорректная схема SSH ответа.',1);
  return data;
 }
}
