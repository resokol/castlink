import {CliError,type InstallPlan,type CheckResult} from './types.js';
export const help = `CastLink CLI — сервер на своей инфраструктуре, работа в браузере.

castlink setup                             Мастер: этот компьютер или свой VPS
castlink setup --target local --dry-run    Предварительный план без изменений
castlink setup --target remote --host HOST --user USER --domain DOMAIN --dry-run
castlink setup --target local|remote      Последовательная установка (готовность ОС/браузера отдельно)
castlink setup --prepare-config --release VERSION --release-manifest PATH
               --architecture amd64|arm64 --bind-ipv4 IP --journal-directory LOCAL_PATH
               [--remote-scope PRIVATE_REMOTE_PATH]  Только защищённая конфигурация; код 3
castlink setup --provision-images          Проверенная digest-pinned загрузка подготовленного bundle; код 3
               --release VERSION --release-manifest PATH --architecture amd64|arm64
               --bind-ipv4 IP --journal-directory LOCAL_PATH [--remote-scope PATH]
castlink setup --start-services            Только уже подготовленный bundle; код 3
               --release VERSION --release-manifest PATH --architecture amd64|arm64
               --bind-ipv4 IP --journal-directory LOCAL_PATH [--remote-scope PATH]
castlink setup --prepare-database          Только SQL/schema/seed уже работающих служб; код 3
               --release VERSION --release-manifest PATH --architecture amd64|arm64
               --bind-ipv4 IP --journal-directory LOCAL_PATH [--remote-scope PATH]
castlink setup --prepare-owner             Закрытое приглашение после проверенных SQL/seed; код 3
               --release VERSION --release-manifest PATH --architecture amd64|arm64
               --bind-ipv4 IP --journal-directory LOCAL_PATH [--remote-scope PATH]
castlink status --profile NAME --json     Текущие private config/images/owned services; готовность не подтверждена\ncastlink start --profile NAME [--json] [--dry-run]  Только четыре существующие owned службы; код 3\ncastlink stop --profile NAME [--json]   STOP отклоняется: private admission barrier не подтверждён\ncastlink uninstall --profile NAME [--json] [--dry-run]  Четыре остановленные owned службы; данные/config сохраняются\ncastlink uninstall --profile NAME --delete-data --confirm-profile NAME  Явное удаление owned данных; private state сохраняется\ncastlink backup --profile NAME --output-directory ABSOLUTE_PATH [--json] [--dry-run]  Cold capture local Linux; restore не проверен\ncastlink update --profile NAME --confirm-profile NAME --release VERSION --release-manifest ABSOLUTE_PATH\n               --backup-directory ABSOLUTE_PATH --attempt-directory NEW_ABSOLUTE_PATH [--json]\ncastlink rollback --profile NAME --confirm-profile NAME --checkpoint-directory ABSOLUTE_PATH\n               --attempt-directory NEW_ABSOLUTE_PATH [--json]  Cold transaction; службы остаются остановлены\ncastlink doctor --json                    Предпосылки этого компьютера; службы/TLS/media не проверены
castlink doctor --profile NAME --json     Предпосылки цели профиля (local или VPS через SSH)

Параметры: --profile NAME --root PATH --network loopback|lan|internet
           --release VERSION --port PORT --json

CASTLINK_PROFILE_ROOT: абсолютный путь приватного каталога профилей; без override используется каталог ОС.\n\nКоманды обслуживания: status doctor start stop backup update rollback uninstall owner-invite
Подготовка и запуск служб поддерживают loopback/LAN; internet отклоняется. Родители приватных каталогов должны существовать.
Перед запуском --provision-images проверяет registry и загружает pinned Linux images. Runtime должен быть установлен до setup; автоматический runtime installer не реализован.
После --start-services SQL/seed остаются неподтверждёнными; --prepare-database проверяет SQL/seed.
--prepare-owner проверяет приглашение в SQL и закрытых файлах; адрес HTTPS ещё не подтверждает доверие клиента.
setup без stage-флага последовательно выполняет подготовку, pinned images, службы, SQL/seed, owner и защищённую HTTPS/setup-проверку.
Готовность приложения подтверждается фактическими SQL/release/owner/setup/TLS; доверие CA в ОС/браузере и реальные media остаются отдельной приёмкой.
setup --dry-run не читает manifest и не выполняет SSH. setup требует exact manifest/architecture/bind/journal; повтор без этих параметров использует закрытую сохранённую ассоциацию.
START сохраняет существующие ресурсы; STOP требует подтверждённый private admission barrier. Uninstall требует четыре cold owned службы и отсутствие автономного startup controller; native Windows/macOS uninstall недоступен. Update/rollback требуют cold source, private backup/checkpoint и точное подтверждение; Windows/SSH пока недоступны. Остальные команды обслуживания ещё не подключены; doctor проверяет только предпосылки.
`;
export function renderPlan(plan: InstallPlan, json: boolean): string {
  if (json) return JSON.stringify(plan,null,2)+'\n';
  const target=plan.request.target.kind==='local'?'этот компьютер':'собственный VPS';
  return `Предварительный план: ${plan.request.profile}, ${target}\nДоступ: ${plan.request.network}\nКаталог: ${plan.request.root}\nВерсия: ${plan.request.release}\nШаги: ${plan.steps.join(' → ')}\n` +
    (plan.blockers.length ? `Блокеры:\n${plan.blockers.map(x=>'- '+x).join('\n')}\n` : '') +
    'Службы не установлены. ОС, runtime, TLS и медиасеть должны пройти preflight перед исполнением.\n';
}

export function renderUninstallChecks(checks:CheckResult[],json:boolean):string{
  if(!Array.isArray(checks)||checks.length<1||checks.length>8||checks.some(check=>!check||Object.keys(check).sort().join(',')!=='id,message,state'||typeof check.id!=='string'||!/^[a-z][a-z0-9-]{0,63}$/.test(check.id)||!['pass','fail','warning','unverified'].includes(check.state)||typeof check.message!=='string'||check.message.length>2048||/[\x00-\x1f\x7f]/.test(check.message))||new Set(checks.map(check=>check.id)).size!==checks.length)throw new CliError('Uninstall result is invalid or exceeds the bounded diagnostic contract; retain private state for diagnosis.',4);
  return json?JSON.stringify(checks,null,2)+'\n':checks.map(check=>`${check.id}: ${check.state}: ${check.message}`).join('\n')+'\n';
}

export function renderBackupResult(result:unknown,json:boolean):string{
 if(!result||typeof result!=='object'||Array.isArray(result)||Object.keys(result).sort().join(',')!=='restoreVerified,schemaVersion,status')throw new CliError('Backup result is unverified; retain private output and target state for diagnosis.',4);
 const r=result as {schemaVersion:unknown;status:unknown;restoreVerified:unknown};if(r.schemaVersion!==1||r.restoreVerified!==false||!['backup-created','backup-planned'].includes(r.status as string))throw new CliError('Backup result is unverified; retain private output and target state for diagnosis.',4);
 return json?JSON.stringify(r)+'\n':r.status==='backup-created'?'Cold backup captured and private checksums verified; restoration remains unverified.\n':'Backup plan only: output privacy, cold source and content remain unverified; no target contact or output write ran.\n';
}

export function renderColdReleaseResult(result:unknown,json:boolean,expected:{action:'update'|'rollback';installationId:string;epoch:number;attemptDirectory:string;release?:string}):string{
 const failure=()=>new CliError('Cold release transaction refused or unverified; retain its private checkpoint and target-operation owner. Before profile commit the profile is unchanged; a lost response after commit is committed-or-unknown. Automatic rollback and retry are not performed.',4);
 if(!result||typeof result!=='object'||Array.isArray(result)||Object.keys(result).sort().join(',')!=='authPreserved,checkpointDirectory,contract,installationId,release,schemaVersion,servicesStopped,status,targetEpoch')throw failure();
 const r=result as import('./update.js').ColdReleaseResult;
 if(r.schemaVersion!==1||r.contract!=='castlink-cold-release-v1'||r.status!==(expected.action==='update'?'updated-cold':'rolled-back-cold')||typeof r.installationId!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(r.installationId)||r.installationId!==expected.installationId||typeof r.release!=='string'||r.release.length>128||!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(r.release)||(expected.release!==undefined&&r.release!==expected.release)||r.authPreserved!==true||r.servicesStopped!==true||!Number.isSafeInteger(r.targetEpoch)||r.targetEpoch!==expected.epoch+1||r.checkpointDirectory!==expected.attemptDirectory)throw failure();
 return json?JSON.stringify({...r,ready:false})+'\n':`Cold ${expected.action} verified; services remain stopped and application readiness remains unverified. Private checkpoint: ${r.checkpointDirectory}\n`;
}
