#!/usr/bin/env node
import {open} from 'node:fs/promises';
import {parseStrictJson} from './strict-json.js';
import {prepareConfig,startPreparedServices,preparePreparedDatabase,provisionPreparedImages,preparePreparedOwner} from './setup.js';
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
import { diagnosePrerequisites } from './doctor.js';

export async function runCli(argv: string[], dependencies: CliDependencies): Promise<number> {
  const jsonDoctor=argv[0]==='doctor' && argv.includes('--json');
  try {
    const args = parseArgs(argv);
    if (args.command==='help') { dependencies.write(help); return 0; }
    if (args.command==='version') { dependencies.write('0.1.0-dev\n'); return 0; }
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
    if((args.options['prepare-config']||args.options['start-services']||args.options['prepare-database']||args.options['provision-images']||args.options['prepare-owner'])&&!args.dryRun){
      const o=args.options;
      if(!o.release||!o['release-manifest']||!o.architecture||!o['bind-ipv4']||!o['journal-directory']||!['amd64','arm64'].includes(o.architecture))throw new CliError('Preparation requires exact --release, --release-manifest, --architecture amd64|arm64, --bind-ipv4 and --journal-directory.');
      if((request.target.kind==='remote')!==!!o['remote-scope'])throw new CliError('Remote preparation requires --remote-scope; local preparation does not accept it.');
      let manifest:unknown;
      try{const file=await open(o['release-manifest'],'r');try{const info=await file.stat();if(!info.isFile()||info.size>65536)throw Error();const bytes=Buffer.alloc(65537);let size=0;while(size<bytes.length){const {bytesRead}=await file.read(bytes,size,bytes.length-size,size);if(!bytesRead)break;size+=bytesRead;}manifest=parseStrictJson(bytes.subarray(0,size).toString('utf8'),65536);}finally{await file.close();}}catch{throw new CliError('Invalid or unreadable bounded release manifest.');}
      const executor=request.target.kind==='remote'?new SshExecutor(request.target,dependencies.executor):dependencies.executor;
      const stage=o['prepare-owner']?preparePreparedOwner:o['provision-images']?provisionPreparedImages:o['prepare-database']?preparePreparedDatabase:o['start-services']?startPreparedServices:prepareConfig;
      const result=await stage({schemaVersion:1,request,steps:['preflight','runtime','release','config','services','migrations','seed','owner','verify'],blockers:[]},{release:manifest as import('./bundle.js').ReleaseManifest,architecture:o.architecture as 'amd64'|'arm64',bindIPv4:o['bind-ipv4'],journalDirectory:o['journal-directory'],...(o['remote-scope']?{remoteScope:o['remote-scope']}:{})},executor,dependencies.store);
      const message=o['prepare-owner']?'Protected initial owner invitation verified against actual SQL and private source and host files; browser setup, accepted HTTPS, API/media and installation readiness remain pending.':o['provision-images']?'Pinned Linux images provisioned and actual engine identities observed; services, SQL, owner and installation readiness remain unverified.':o['prepare-database']?'SQL migration content, actual schema and local seed identity observed; owner access, API/TLS/media and installation readiness remain unverified.':o['start-services']?'Owned pinned services observed running; SQL migrations, seed, owner access, API/TLS/media and installation readiness remain unverified.':'Protected configuration prepared; runtime installation, services, migrations, seed, owner and readiness remain unverified.';
      dependencies.write(args.json?JSON.stringify({schemaVersion:1,status:'partial',ready:false,message,...(result.owner?{owner:result.owner}:{})})+'\n':message+'\n'+(result.owner?`Invitation file: ${result.owner.filePath}\nBrowser origin: ${result.owner.origin}\nExpires: ${new Date(result.owner.expiresAt).toISOString()}\n`:''));return 3;
    }
    const facts = await dependencies.detect(request.target);
    const existing = await dependencies.store.load(request.profile);
    if (existing) facts.existingInstallationId=existing.installationId;
    const plan = createPlan(request,facts);
    if (args.dryRun) { dependencies.write(renderPlan(plan,args.json)); return plan.blockers.length?4:0; }
    if (plan.blockers.length) { dependencies.write(renderPlan(plan,args.json)); return 4; }
    throw new CliError('Исполнитель установки ещё не подключён. Используй setup --dry-run для предварительного плана.',3);
  } catch(error) {
    const code=error instanceof CliError?error.code:1;
    const message=error instanceof CliError?error.message:'Не удалось выполнить команду. Проверь доступ и конфигурацию установки.';
    dependencies.write(jsonDoctor?JSON.stringify([{id:'doctor',state:'fail',message}],null,2)+'\n':message+'\n');return code;
  }
}

async function entry(): Promise<number> {
  let readline: ReturnType<typeof createInterface> | undefined;
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
  try {return await runCli(process.argv.slice(2),dependencies);} finally {readline?.close();}
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url) {
  process.exitCode=await entry();
}
