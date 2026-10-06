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
import { help, renderPlan } from './render.js';
import { CliError, type CliDependencies } from './types.js';
import { FileStateStore } from './state.js';
import { profileRoot } from './profile.js';
import { LocalExecutor } from './executors/local.js';
import {getStatus} from './status.js';
import { diagnosePrerequisites } from './doctor.js';

export async function runCli(argv: string[], dependencies: CliDependencies): Promise<number> {
  const jsonDoctor=['doctor','status'].includes(argv[0]??'') && argv.includes('--json');
  try {
    const args = parseArgs(argv);
    if (args.command==='help') { dependencies.write(help); return 0; }
    if (args.command==='version') { dependencies.write('0.1.0-dev\n'); return 0; }
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
    const request = await requestFromArgs(args,dependencies);
    validateRequest(request);
    if(!args.dryRun){
      const partial=['prepare-config','start-services','prepare-database','provision-images','prepare-owner'].some(key=>args.options[key]);
      const o={...args.options};
      let saved;try{saved=await dependencies.store.load(request.profile);}catch{throw new CliError('Saved setup profile is invalid or unreadable; retain private files before retry.',4);}
      if(!partial&&!saved&&!o.target){
        if(!o.release){o.release=(await dependencies.readLine(`Release identifier [${request.release}]: `,false)).trim()||request.release;request.release=o.release;}
        for(const [key,prompt] of [['release-manifest','Private release manifest path: '],['architecture','Linux architecture (amd64/arm64): '],['bind-ipv4','Explicit bind IPv4: '],['journal-directory','Private local journal directory: '],...(request.target.kind==='remote'?[['remote-scope','Private remote scope directory: ']]:[])])if(!o[key!])o[key!]=(await dependencies.readLine(prompt!,false)).trim();
      }
      const plan:import('./types.js').InstallPlan={schemaVersion:1,request,steps:['preflight','runtime','release','config','services','migrations','seed','owner','verify'],blockers:[]};
      const executor=request.target.kind==='remote'?new SshExecutor(request.target,dependencies.executor):dependencies.executor;
      function outputSetup(result:Awaited<ReturnType<typeof executeSetup>>){
        const message='Application setup verified against actual SQL, pinned release, protected owner access and CA-validated target HTTPS. OS/browser CA trust and real media acceptance remain pending.';
        dependencies.write(args.json?JSON.stringify({schemaVersion:1,status:'application-verified',ready:false,applicationReady:result.applicationReady,browserTrust:result.browserTrust,message,checks:result.checks,owner:result.owner})+'\n':message+'\n'+`Invitation file: ${result.owner.filePath}\nBrowser origin (CA acceptance required): ${result.owner.origin}\nExpires: ${new Date(result.owner.expiresAt).toISOString()}\n`);return 3;
      }
      if(!partial&&saved&&!['release-manifest','architecture','bind-ipv4','journal-directory','remote-scope'].some(key=>o[key]))return outputSetup(await executeSetup(plan,executor,dependencies.store));

      if(!o.release||!o['release-manifest']||!o.architecture||!o['bind-ipv4']||!o['journal-directory']||!['amd64','arm64'].includes(o.architecture))throw new CliError('Setup requires exact --release, --release-manifest, --architecture amd64|arm64, --bind-ipv4 and --journal-directory.',partial?2:3);
      if((request.target.kind==='remote')!==!!o['remote-scope'])throw new CliError('Remote preparation requires --remote-scope; local preparation does not accept it.');
      let manifest:unknown;
      try{const file=await open(o['release-manifest'],constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0));try{const info=await file.stat();if(!info.isFile()||info.size>65536)throw Error();const bytes=Buffer.alloc(65537);let size=0;while(size<bytes.length){const {bytesRead}=await file.read(bytes,size,bytes.length-size,size);if(!bytesRead)break;size+=bytesRead;}manifest=parseStrictJson(bytes.subarray(0,size).toString('utf8'),65536);}finally{await file.close();}}catch{throw new CliError('Invalid or unreadable bounded release manifest.');}
      const configOptions={release:manifest as import('./bundle.js').ReleaseManifest,architecture:o.architecture as 'amd64'|'arm64',bindIPv4:o['bind-ipv4'],journalDirectory:o['journal-directory'],...(o['remote-scope']?{remoteScope:o['remote-scope']}:{})};
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
    dependencies.write(jsonDoctor?JSON.stringify([{id:argv[0]==='status'?'status':'doctor',state:'fail',message}],null,2)+'\n':message+'\n');return code;
  }
}

async function entry(): Promise<number> {
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
  return await runCli(process.argv.slice(2),dependencies);
  }catch(error){const message=error instanceof CliError?error.message:'CLI initialization failed; diagnose local configuration.';stdout.write(message+'\n');return error instanceof CliError?error.code:1;}finally {readline?.close();}
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url) {
  process.exitCode=await entry();
}
