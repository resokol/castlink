import type { InstallPlan } from './types.js';
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
castlink status --profile NAME --json     Текущие private config/images/owned services; готовность не подтверждена\ncastlink start --profile NAME [--json] [--dry-run]  Только четыре существующие owned службы; код 3\ncastlink stop --profile NAME [--json]   STOP отклоняется: private admission barrier не подтверждён\ncastlink doctor --json                    Предпосылки этого компьютера; службы/TLS/media не проверены
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
START сохраняет существующие ресурсы; STOP требует подтверждённый private admission barrier. Остальное обслуживание ещё не подключено; doctor проверяет только предпосылки.
`;
export function renderPlan(plan: InstallPlan, json: boolean): string {
  if (json) return JSON.stringify(plan,null,2)+'\n';
  const target=plan.request.target.kind==='local'?'этот компьютер':'собственный VPS';
  return `Предварительный план: ${plan.request.profile}, ${target}\nДоступ: ${plan.request.network}\nКаталог: ${plan.request.root}\nВерсия: ${plan.request.release}\nШаги: ${plan.steps.join(' → ')}\n` +
    (plan.blockers.length ? `Блокеры:\n${plan.blockers.map(x=>'- '+x).join('\n')}\n` : '') +
    'Службы не установлены. ОС, runtime, TLS и медиасеть должны пройти preflight перед исполнением.\n';
}
