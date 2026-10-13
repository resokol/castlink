import type{ExecutionRequest,Executor,HostFacts,CheckResult}from'./types.js';
export function runtimeActions(platform:string):ExecutionRequest[]{
 if(platform!=='win32')return[];
 return[
  {executable:'winget',args:['install','--id','Docker.DockerDesktop','--exact','--source','winget'],sensitive:false},
  {executable:'powershell.exe',args:['-NoProfile','-Command','Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0'],sensitive:false},
 ];
}
export async function ensureRuntime(executor:Executor,facts:HostFacts,consent:()=>Promise<boolean>):Promise<CheckResult[]>{
 if(facts.runtimeReady)return[{id:'runtime',state:'pass',message:'Runtime уже готов; установка зависимостей не требуется.'}];
 if(!(await consent()))return[{id:'runtime',state:'fail',message:'Установка runtime отклонена; системные настройки не изменены.'}];
 const actions=runtimeActions(facts.platform);
 if(!actions.length)return[{id:'runtime',state:'fail',message:'Для macOS нужен проверенный подписанный Docker Desktop installer под архитектуру компьютера. Автоматическая установка ещё не проверена.'}];
 for(const action of actions){
  try{const result=await executor.run(action);if(result.code!==0)return[{id:'runtime',state:'fail',message:'Runtime installer не завершился. Проверь права, условия пакета и необходимость перезагрузки; не повторяй настройку сервера до успешного doctor.'}];}
  catch{return[{id:'runtime',state:'fail',message:'Не удалось запустить runtime installer; проверь winget и права администратора.'}];}
 }
 return[{id:'runtime',state:'unverified',message:'Installer завершён; запусти Docker Desktop, при необходимости перезагрузи компьютер и повтори doctor. Готовность Docker не подтверждена.'}];
}
