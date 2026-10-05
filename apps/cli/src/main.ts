#!/usr/bin/env node
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
