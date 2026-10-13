import {StringDecoder} from 'node:string_decoder';
import {spawn} from 'node:child_process';
import {CliError,type ExecutionRequest,type CommandResult,type Executor} from '../types.js';
export class LocalExecutor implements Executor {
 constructor(readonly timeoutMs=30_000){}
 async run(request:ExecutionRequest):Promise<CommandResult>{
  if(!request.executable || request.executable.includes('\0') || request.args.some(arg=>arg.includes('\0')))throw new CliError('Invalid process arguments.');
  return new Promise((resolve,reject)=>{
   const child=spawn(request.executable,request.args,{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});
   const decoders={stdout:new StringDecoder('utf8'),stderr:new StringDecoder('utf8')};
   let stdout='',stderr='',size=0,overflow=false,timedOut=false;
   const collect=(stream:'stdout'|'stderr',chunk:Buffer)=>{size+=chunk.length;if(size>1024*1024){overflow=true;child.kill();return;}if(stream==='stdout')stdout+=decoders.stdout.write(chunk);else stderr+=decoders.stderr.write(chunk);};
   child.stdout.on('data',(chunk:Buffer)=>collect('stdout',chunk));child.stderr.on('data',(chunk:Buffer)=>collect('stderr',chunk));
   const timer=setTimeout(()=>{timedOut=true;child.kill();},this.timeoutMs);
   child.once('error',error=>{clearTimeout(timer);reject(new CliError((error as NodeJS.ErrnoException).code==='ENOENT'?'Не найден необходимый исполняемый файл.':'Не удалось запустить процесс.',3));});
   child.once('close',code=>{clearTimeout(timer);if(timedOut)reject(new CliError('Истекло время ожидания процесса.',3));else if(overflow)reject(new CliError('Процесс вернул слишком большой ответ.',1));else resolve({code:code??1,stdout:stdout+decoders.stdout.end(),stderr:stderr+decoders.stderr.end()});});
   child.stdin.on('error',()=>{});child.stdin.end(request.input);
  });
 }
}
