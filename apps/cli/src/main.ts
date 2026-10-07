#!/usr/bin/env node
import {open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {parseStrictJson} from './strict-json.js';
import {prepareConfig,startPreparedServices,preparePreparedDatabase,provisionPreparedImages,preparePreparedOwner,executeSetup} from './setup.js';
import {SshExecutor} from './executors/ssh.js';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { parseArgs } from './args.js';
import { createPlan, validateRequest } from './plan.js';
import { requestFromArgs } from './wizard.js';
import { help, renderPlan, renderUninstallChecks, renderBackupResult, renderColdReleaseResult } from './render.js';
import { CliError, type CliDependencies } from './types.js';
import { FileStateStore } from './state.js';
import { profileRoot } from './profile.js';
import { LocalExecutor } from './executors/local.js';
import {runLifecycle} from './lifecycle.js';
import {getStatus} from './status.js';
import { diagnosePrerequisites } from './doctor.js';
import {createGuardedColdBackup} from './backup.js';
import {uninstall} from './uninstall.js';
import {runColdUpdate,runColdRollback} from './update.js';
import {observeTargetGeneration} from './target-operation-observer.js';
import {validateReleaseManifest} from './bundle.js';
import {windowsLocalPreviewRelease} from './windows-local-preview.js';

export async function runCli(argv: string[], dependencies: CliDependencies): Promise<number> {
  const jsonDoctor=['doctor','status','start','stop','uninstall','backup','update','rollback'].includes(argv[0]??'') && argv.includes('--json');
  try {
    const args = parseArgs(argv);
    if (args.command==='help') { dependencies.write(help); return 0; }
    if (args.command==='version') { dependencies.write('0.1.0-dev\n'); return 0; }
    if(args.command==='start'||args.command==='stop'){
      if(!args.profile)throw new CliError('Lifecycle requires --profile NAME.');
      let profile;try{profile=structuredClone(await dependencies.store.load(args.profile));}catch{throw new CliError('Saved lifecycle profile is invalid or unreadable; diagnose private storage.',4);}
      const checks=await runLifecycle(args.command,profile,dependencies.executor,dependencies.store,{dryRun:args.dryRun});
      dependencies.write(args.json?JSON.stringify(checks,null,2)+'\n':checks.map(x=>`${x.id}: ${x.state}: ${x.message}`).join('\n')+'\n');
      return checks.some(x=>x.state==='fail')?4:3;
    }
    if(args.command==='uninstall'){
      if(!args.profile)throw new CliError('Uninstall requires --profile NAME.');
      let profile;try{profile=structuredClone(await dependencies.store.load(args.profile));}catch{throw new CliError('Saved uninstall profile is invalid or unreadable; retain private storage for diagnosis.',4);}
      if(!profile)throw new CliError('Uninstall profile was not found; check the saved profile name.');
      const checks=await uninstall(profile,{deleteData:args.options['delete-data']==='true',dryRun:args.dryRun,...(args.options['confirm-profile']!==undefined?{confirmation:args.options['confirm-profile']}:{})},dependencies.executor,dependencies.store);
      dependencies.write(renderUninstallChecks(checks,args.json));
      return checks.some(check=>check.state==='fail')?4:args.dryRun?3:checks[0]?.state==='pass'?0:3;
    }
    if(args.command==='backup'){
      if(!args.profile||!args.options['output-directory'])throw new CliError('Backup requires --profile NAME and --output-directory ABSOLUTE_PATH.');
      let profile;try{profile=structuredClone(await dependencies.store.load(args.profile));}catch{throw new CliError('Saved backup profile is invalid or unreadable; retain private storage for diagnosis.',4);}
      if(!profile)throw new CliError('Backup profile was not found; check the saved profile name.');
      if(profile.request?.profile!==args.profile)throw new CliError('Saved backup profile association does not match the requested name; retain private storage for diagnosis.',4);
      const result=await createGuardedColdBackup(profile,{outputDirectory:args.options['output-directory'],dryRun:args.dryRun},dependencies.executor,dependencies.store);
      dependencies.write(renderBackupResult(result,args.json));return result.status==='backup-created'?0:3;
    }
    if(args.command==='update'||args.command==='rollback'){
      const refused='Cold release transaction refused or unverified; retain its private checkpoint and target-operation owner. Before profile commit the profile is unchanged; a lost response after commit is committed-or-unknown. Automatic rollback and retry are not performed.';
      const unsupported='Cold update and rollback preview requires local Unix and a private FileStateStore.';
      const required='Cold release requires an exact --profile/--confirm-profile match and explicit canonical absolute manifest, backup or checkpoint, and new attempt paths.';
      const missing='Cold release profile was not found; check the saved profile name.';
      const invalid='Saved cold release profile is invalid or unreadable; retain private storage for diagnosis.';
      const badManifest='Invalid or unreadable bounded cold release manifest.';
      try{
        const o=args.options,absolute=(p:string|undefined):p is string=>typeof p==='string'&&p.length<=4096&&path.isAbsolute(p)&&path.resolve(p)===p&&p!==path.parse(p).root&&!/[\x00-\x1f\x7f]/.test(p);
        if(!args.profile||o['confirm-profile']!==args.profile||!absolute(o['attempt-directory'])||(args.command==='update'?(!o.release||!absolute(o['release-manifest'])||!absolute(o['backup-directory'])):!absolute(o['checkpoint-directory'])))throw new CliError(required);
        let profile;try{profile=structuredClone(await dependencies.store.load(args.profile));}catch{throw new CliError(invalid,4)}
        if(!profile)throw new CliError(missing);
        try{if(profile.schemaVersion!==1||typeof profile.installationId!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(profile.installationId)||profile.request?.profile!==args.profile||profile.currentRelease!==profile.request.release)throw Error();validateRequest(profile.request);}catch{throw new CliError(invalid,4)}
        if(profile.request.target.kind!=='local'||process.platform==='win32')throw new CliError(unsupported);
        // Freeze before manifest/config/resource reads. The fixed helper rechecks
        // this same epoch under its lease; failures never refresh or replay it.
        const generation=await observeTargetGeneration(dependencies.executor,false);
        let result,expectedRelease:string|undefined;
        if(args.command==='update'){
          let release:import('./bundle.js').ReleaseManifest;
          try{const file=await open(o['release-manifest']!,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0));try{const info=await file.stat();if(!info.isFile()||info.size>65536)throw Error();const bytes=Buffer.alloc(65537);let size=0;while(size<bytes.length){const r=await file.read(bytes,size,bytes.length-size,size);if(!r.bytesRead)break;size+=r.bytesRead;}const raw=parseStrictJson(bytes.subarray(0,size).toString('utf8'),65536) as {architectures?:unknown};release=validateReleaseManifest(raw,o.release!,Array.isArray(raw?.architectures)&&raw.architectures.includes('amd64')?'amd64':'arm64');}finally{await file.close();}}catch{throw new CliError(badManifest)}
          expectedRelease=release.release;
          result=await runColdUpdate(profile,{release,backupDirectory:o['backup-directory']!,attemptDirectory:o['attempt-directory'],targetEpoch:generation.epoch},dependencies.executor,dependencies.store);
        }else result=await runColdRollback(profile,{checkpointDirectory:o['checkpoint-directory']!,attemptDirectory:o['attempt-directory'],targetEpoch:generation.epoch},dependencies.executor,dependencies.store);
        dependencies.write(renderColdReleaseResult(result,args.json,{action:args.command,installationId:profile.installationId,epoch:generation.epoch,attemptDirectory:o['attempt-directory'],release:expectedRelease}));return 0;
      }catch(error){
        // Only these fixed literal diagnostics cross the public boundary.
        if(error instanceof CliError&&Object.getPrototypeOf(error)===CliError.prototype&&[[2,required],[2,missing],[2,badManifest],[2,unsupported],[4,invalid],[4,refused]].some(([code,message])=>error.code===code&&error.message===message))throw error;
        throw new CliError(refused,4);
      }
    }
    if(args.command==='status'){
      if(!args.profile)throw new CliError('Status requires --profile NAME.');
      let profile;try{profile=await dependencies.store.load(args.profile);}catch{throw new CliError('Saved profile is invalid or unreadable; diagnose private profile storage.',4);}
      const checks=await getStatus(profile,dependencies.executor,dependencies.store);
      dependencies.write(args.json?JSON.stringify(checks,null,2)+'\n':checks.map(x=>`${x.id}: ${x.state}: ${x.message}`).join('\n')+'\n');
      return checks.some(x=>x.state==='fail')?4:3;
    }
    if (args.command==='doctor') {
      if(args.options.media)throw new CliError('Реальная media-проверка ещё не подключена; результат не считается проверенным.',3);
      const profile=args.profile?await dependencies.store.load(args.profile):null;
      if(args.profile && !profile)throw new CliError('Профиль не найден. Проверь имя профиля; без --profile doctor проверяет этот компьютер.',2);
      const checks=await diagnosePrerequisites(profile,dependencies.executor);
      dependencies.write(args.json?JSON.stringify(checks,null,2)+'\n':checks.map(x=>`${x.state}: ${x.message}`).join('\n')+'\n');
      return checks.some(x=>x.state==='fail')?3:0;
    }
    if (args.command!=='setup') throw new CliError('Команда обслуживания ещё не реализована в этой developer-сборке.',3);
    const request = await requestFromArgs(args,dependencies,args.dryRun?undefined:async name=>{
      try{return (await dependencies.store.load(name))?.request;}catch{throw new CliError('Не удалось прочитать сохранённую установку. Сохрани её файлы для диагностики.',4);}
    });
    validateRequest(request);
    if(!args.dryRun){
      const partial=['prepare-config','start-services','prepare-database','provision-images','prepare-owner'].some(key=>args.options[key]);
      const o={...args.options};
      let saved;try{saved=await dependencies.store.load(request.profile);}catch{throw new CliError('Saved setup profile is invalid or unreadable; retain private files before retry.',4);}
      const guided=!o.target||o['easy-setup']==='true';
      const localPreset=!partial&&!saved&&guided&&!o.release&&!o['release-manifest']&&process.platform==='win32'&&request.target.kind==='local';
      const remotePreset=!partial&&!saved&&o['easy-setup']==='true'&&!o.release&&!o['release-manifest']&&process.platform==='win32'&&request.target.kind==='remote';
      async function readManifest(filePath:string):Promise<unknown>{
        const file=await open(filePath,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0));
        try{const info=await file.stat();if(!info.isFile()||info.size>65536)throw new CliError('Invalid or unreadable bounded release manifest.');const bytes=Buffer.alloc(65537);let size=0;while(size<bytes.length){const {bytesRead}=await file.read(bytes,size,bytes.length-size,size);if(!bytesRead)break;size+=bytesRead;}return parseStrictJson(bytes.subarray(0,size).toString('utf8'),65536);}finally{await file.close();}
      }
      let packagedManifest:unknown;
      if(remotePreset){
        o['release-manifest']=path.win32.join(path.win32.dirname(process.execPath),'..','..','server','release.json');
        try{packagedManifest=await readManifest(o['release-manifest']);const release=packagedManifest as import('./bundle.js').ReleaseManifest;if(release.schemaVersion!==1)throw Error();validateReleaseManifest(release,release.release,'amd64');o.release=release.release;request.release=release.release;}
        catch{throw new CliError('В этой папке нет проверенного выпуска для VPS. Используй полную папку Easy Setup с server/release.json; локальный Windows-образ не заменяет серверный выпуск.',3);}
        o.architecture='amd64';
        o['journal-directory']??=path.win32.join(profileRoot(),request.profile+'-journal');
        o['remote-scope']??=path.posix.dirname(request.root);
        const defaultBind=request.internet?.publicIPv4??'127.0.0.1';
        o['bind-ipv4']??=(await dependencies.readLine(`IPv4 интерфейса самого VPS [${defaultBind}]: `,false)).trim()||defaultBind;
        dependencies.write('Для публичного сервера направь DNS домена на IPv4 VPS и разреши TCP 80/443/7881, UDP 61000–61100. Закрытые сети могут потребовать TURN; этот отдельный режим пока не включён.\n');
      }
      if(localPreset){
        if(request.network!=='loopback')throw new CliError('Встроенный Windows-выпуск пока предназначен для доступа с этого ПК (loopback). Для другого режима нужен отдельный проверенный выпуск.',3);
        request.release=windowsLocalPreviewRelease.release;
      }
      if(!partial&&!saved&&guided&&!localPreset&&!remotePreset){
        if(!o.release){o.release=(await dependencies.readLine(`Release identifier [${request.release}]: `,false)).trim()||request.release;request.release=o.release;}
        for(const [key,prompt] of [['release-manifest','Private release manifest path: '],['architecture','Linux architecture (amd64/arm64): '],['bind-ipv4','Explicit bind IPv4: '],['journal-directory','Private local journal directory: '],...(request.target.kind==='remote'?[['remote-scope','Private remote scope directory: ']]:[])])if(!o[key!])o[key!]=(await dependencies.readLine(prompt!,false)).trim();
      }
      const plan:import('./types.js').InstallPlan={schemaVersion:1,request,steps:['preflight','runtime','release','config','services','migrations','seed','owner','verify'],blockers:[]};
      const executor=request.target.kind==='remote'?new SshExecutor(request.target,dependencies.executor):dependencies.executor;
      function outputSetup(result:Awaited<ReturnType<typeof executeSetup>>){
        const message='Application setup verified against actual SQL, pinned release, protected owner access and CA-validated target HTTPS. OS/browser CA trust and real media acceptance remain pending.';
        dependencies.write(args.json?JSON.stringify({schemaVersion:1,status:'application-verified',ready:false,applicationReady:result.applicationReady,browserTrust:result.browserTrust,message,checks:result.checks,owner:result.owner})+'\n':`Службы сервера, база данных и HTTPS проверены. ${request.network==='internet'?'Публичная цепочка HTTPS проверена. Проверь вход в браузере и звонок.':'Осталось подтвердить доверие сертификату в браузере и проверить звонок.'}\nАдрес сервера: ${result.owner.origin}\n${request.target.kind==='remote'?'Файл приглашения находится на VPS: '+result.owner.filePath+'\nЗагрузи этот закрытый файл через свой SSH/SFTP и открой ссылку на компьютере.':'Приглашение владельца сохранено в закрытом файле: '+result.owner.filePath+'\nОткрой файл на своём компьютере и перейди по ссылке.'} Не отправляй её другим людям.\nСсылка действует до: ${new Date(result.owner.expiresAt).toISOString()}\nКод 3 означает, что проверка браузера и медиа ещё не завершена.\n`);return 3;
      }
      if(!partial&&saved&&!['release-manifest','architecture','bind-ipv4','journal-directory','remote-scope'].some(key=>o[key]))return outputSetup(await executeSetup(plan,executor,dependencies.store));
      if(localPreset){
        const architecture=o.architecture??'amd64';
        if(architecture!=='amd64')throw new CliError('Встроенный Windows-выпуск рассчитан на amd64.',2);
        if(o['remote-scope'])throw new CliError('Remote scope нельзя использовать для локальной установки.',2);
        const release=validateReleaseManifest(windowsLocalPreviewRelease,request.release,architecture);
        return outputSetup(await executeSetup(plan,executor,dependencies.store,{release,architecture,bindIPv4:o['bind-ipv4']??'127.0.0.1',journalDirectory:o['journal-directory']??path.win32.join(profileRoot(),request.profile+'-journal')}));
      }

      if(!o.release||!o['release-manifest']||!o.architecture||!o['bind-ipv4']||!o['journal-directory']||!['amd64','arm64'].includes(o.architecture))throw new CliError('Setup requires exact --release, --release-manifest, --architecture amd64|arm64, --bind-ipv4 and --journal-directory.',partial?2:3);
      if((request.target.kind==='remote')!==!!o['remote-scope'])throw new CliError('Remote preparation requires --remote-scope; local preparation does not accept it.');
      let manifest:unknown;
      try{manifest=packagedManifest??await readManifest(o['release-manifest']);}catch{throw new CliError('Invalid or unreadable bounded release manifest.');}
      const configOptions={release:manifest as import('./bundle.js').ReleaseManifest,architecture:o.architecture as 'amd64'|'arm64',bindIPv4:o['bind-ipv4'],journalDirectory:o['journal-directory'],...(o['remote-scope']?{remoteScope:o['remote-scope']}:{}) ,...(request.internet?{internet:request.internet}:{})};
      if(!partial)return outputSetup(await executeSetup(plan,executor,dependencies.store,configOptions));
      const stage=o['prepare-owner']?preparePreparedOwner:o['provision-images']?provisionPreparedImages:o['prepare-database']?preparePreparedDatabase:o['start-services']?startPreparedServices:prepareConfig;
      const result=await stage(plan,configOptions,executor,dependencies.store);
      const message=o['prepare-owner']?'Protected initial owner invitation verified against actual SQL and private source and host files; browser setup, accepted HTTPS, API/media and installation readiness remain pending.':o['provision-images']?'Pinned Linux images provisioned and actual engine identities observed; services, SQL, owner and installation readiness remain unverified.':o['prepare-database']?'SQL migration content, actual schema and local seed identity observed; owner access, API/TLS/media and installation readiness remain unverified.':o['start-services']?'Owned pinned services observed running; SQL migrations, seed, owner access, API/TLS/media and installation readiness remain unverified.':'Protected configuration prepared; runtime installation, services, migrations, seed, owner and readiness remain unverified.';
      dependencies.write(args.json?JSON.stringify({schemaVersion:1,status:'partial',ready:false,message,...(result.owner?{owner:result.owner}:{})})+'\n':message+'\n'+(result.owner?`Invitation file: ${result.owner.filePath}\nBrowser origin: ${result.owner.origin}\nExpires: ${new Date(result.owner.expiresAt).toISOString()}\n`:''));return 3;
    }
    const facts = await dependencies.detect(request.target);
    const existing = await dependencies.store.load(request.profile);
    if (existing) facts.existingInstallationId=existing.installationId;
    const plan = createPlan(request,facts);
    dependencies.write(renderPlan(plan,args.json));return plan.blockers.length?4:0;
  } catch(error) {
    const code=error instanceof CliError?error.code:1;
    const message=error instanceof CliError?error.message:'Не удалось выполнить команду. Проверь доступ и конфигурацию установки.';
    dependencies.write(jsonDoctor?JSON.stringify([{id:argv[0]??'lifecycle',state:'fail',message}],null,2)+'\n':message+'\n');return code;
  }
}

export async function entry(argv: string[] = process.argv.slice(2)): Promise<number> {
  let readline: ReturnType<typeof createInterface> | undefined;
  try {
  const dependencies: CliDependencies = {
    readLine: async(prompt,hidden)=>{
      if (!stdin.isTTY || hidden) throw new CliError('Интерактивный терминал необходим; для предварительного плана укажи параметры явно.');
      readline??=createInterface({input:stdin,output:stdout});return readline.question(prompt);
    },
    write: text=>stdout.write(text),
    // Dry-run never contacts SSH or changes known_hosts. Actual target facts belong to execution preflight.
    detect:async target=>target.kind==='remote'?{platform:'linux',arch:'x64',runtimeReady:false}:{platform:process.platform,arch:process.arch,runtimeReady:false},
    executor:new LocalExecutor(),
    store:new FileStateStore(profileRoot()),
  };
  return await runCli(argv,dependencies);
  }catch(error){const message=error instanceof CliError?error.message:'CLI initialization failed; diagnose local configuration.';stdout.write(message+'\n');return error instanceof CliError?error.code:1;}finally {readline?.close();}
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url) {
  process.exitCode=await entry();
}
