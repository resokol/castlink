import path from 'node:path';
export type StartupRegistrationInput={platform:'windows'|'macos'|'ubuntu';installationId:string;privateRoot:string;packageRoot:string;profileFile:string;nodeRelativePath:string;controllerRelativePath:string;principal:string};
export type StartupRegistrationTemplate={kind:'task-scheduler'|'launch-agent'|'systemd';name:string;content:string;argv:string[];companion?:{name:string;content:string};installable:false;assurance:'registration-template-only';blockedBy:'fixed-runner-entrypoint-and-native-validation'};
function fail():never{throw Error('host-startup-registration-unverified')}
function text(s:unknown):s is string{return typeof s==='string'&&s.length>0&&s.length<=4096&&!/[\x00-\x1f\x7f]/.test(s)}
const xml=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
function windowsArgument(s:string):string{return'"'+s.replace(/(\\*)"/g,'$1$1\\"').replace(/(\\+)$/g,'$1$1')+'"'}
function systemdArgument(s:string):string{return'"'+s.replaceAll('\\','\\\\').replaceAll('"','\\"').replaceAll('%','%%').replaceAll('$',()=> '$$')+'"'}
// Directory settings expand specifiers but not ExecStart environment variables.
function systemdDirectory(s:string):string{return '"'+s.replaceAll('\\','\\\\').replaceAll('"','\\"').replaceAll('%','%%')+'"'}
// Pure templates only; no service installation, global runtime, Docker access,
// reboot or claim that a controller entrypoint/fixed native runner exists.
export function renderHostStartupRegistration(input:StartupRegistrationInput):StartupRegistrationTemplate{
 const r=structuredClone(input);if(Object.keys(r).sort().join(',')!=='controllerRelativePath,installationId,nodeRelativePath,packageRoot,platform,principal,privateRoot,profileFile'||!['windows','macos','ubuntu'].includes(r.platform)||!/^([a-f0-9]{8})(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(r.installationId))fail();
 const p=r.platform==='windows'?path.win32:path.posix;
 for(const root of [r.privateRoot,r.packageRoot,r.profileFile])if(!text(root)||!p.isAbsolute(root)||p.normalize(root)!==root||root===p.parse(root).root||r.platform==='windows'&&(!/^D:\\/i.test(root)||/[<>"|?*]/.test(root)))fail();
 const within=(parent:string,child:string)=>{const rel=p.relative(parent,child);return rel.length>0&&!rel.startsWith('..'+p.sep)&&rel!=='..'&&!p.isAbsolute(rel)};
 if(!within(r.privateRoot,r.packageRoot)||!within(r.privateRoot,r.profileFile))fail();
 for(const relative of [r.nodeRelativePath,r.controllerRelativePath])if(!text(relative)||p.isAbsolute(relative)||p.normalize(relative)!==relative||relative==='.'||relative.split(p.sep).includes('..')||r.platform==='windows'&&/[<>:"|?*]/.test(relative))fail();
 const node=p.resolve(r.packageRoot,r.nodeRelativePath),controller=p.resolve(r.packageRoot,r.controllerRelativePath);if(!within(r.packageRoot,node)||!within(r.packageRoot,controller)||!/^node(?:\.exe)?$/.test(p.basename(node))||!/[.](?:mjs|js)$/.test(controller))fail();
 const argv=[node,controller,'--profile-file',r.profileFile],name='castlink-controller-'+r.installationId;
 const base={name,argv,installable:false as const,assurance:'registration-template-only' as const,blockedBy:'fixed-runner-entrypoint-and-native-validation' as const};
 if(r.platform==='windows'){
  if(!/^S-1-[0-9-]+$/.test(r.principal)||p.basename(node)!=='node.exe')fail();
  const args=argv.slice(1).map(windowsArgument).join(' ');
  return{...base,kind:'task-scheduler',content:`<?xml version="1.0" encoding="UTF-8"?>\n<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task"><RegistrationInfo><URI>\\CastLink\\${name}</URI></RegistrationInfo><Triggers><LogonTrigger><Repetition><Interval>PT1M</Interval><StopAtDurationEnd>false</StopAtDurationEnd></Repetition><Enabled>true</Enabled><UserId>${xml(r.principal)}</UserId></LogonTrigger></Triggers><Principals><Principal id="controller"><UserId>${xml(r.principal)}</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals><Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><StartWhenAvailable>true</StartWhenAvailable><ExecutionTimeLimit>PT0S</ExecutionTimeLimit><RestartOnFailure><Interval>PT1M</Interval><Count>3</Count></RestartOnFailure></Settings><Actions Context="controller"><Exec><Command>${xml(node)}</Command><Arguments>${xml(args)}</Arguments><WorkingDirectory>${xml(r.privateRoot)}</WorkingDirectory></Exec></Actions></Task>\n`};
 }
 if(!/^uid:[0-9]+$/.test(r.principal)&&r.platform==='macos'||r.platform==='ubuntu'&&!/^[a-z_][a-z0-9_-]{0,31}$/.test(r.principal))fail();
 if(r.platform==='macos')return{...base,kind:'launch-agent',content:`<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>com.castlink.${name}</string><key>ProgramArguments</key><array>${argv.map(a=>'<string>'+xml(a)+'</string>').join('')}</array><key>WorkingDirectory</key><string>${xml(r.privateRoot)}</string><key>RunAtLoad</key><true/><key>StartInterval</key><integer>30</integer><key>ThrottleInterval</key><integer>30</integer></dict></plist>\n`};
 return{...base,name:name+'.service',kind:'systemd',companion:{name:name+'.timer',content:`[Unit]\nDescription=CastLink scoped startup reconciliation timer ${r.installationId}\n\n[Timer]\nOnBootSec=30\nOnUnitInactiveSec=30\nUnit=${name}.service\n\n[Install]\nWantedBy=timers.target\n`},content:`[Unit]\nDescription=CastLink scoped startup controller ${r.installationId}\nAfter=docker.service\nWants=docker.service\n\n[Service]\nType=oneshot\nUser=${r.principal}\nWorkingDirectory=${systemdDirectory(r.privateRoot)}\nExecStart=${argv.map(systemdArgument).join(' ')}\n`};
}
