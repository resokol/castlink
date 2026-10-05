import type { InstallPlan } from './types.js';
export const help = `CastLink CLI — сервер на своей инфраструктуре, работа в браузере.

castlink setup                             Мастер: этот компьютер или свой VPS
castlink setup --target local --dry-run    Предварительный план без изменений
castlink setup --target remote --host HOST --user USER --domain DOMAIN --dry-run
castlink doctor --json                    Предпосылки этого компьютера; службы/TLS/media не проверены
castlink doctor --profile NAME --json     Предпосылки цели профиля (local или VPS через SSH)

Параметры: --profile NAME --root PATH --network loopback|lan|internet
           --release VERSION --port PORT --json

Команды обслуживания: status doctor start stop backup update rollback uninstall owner-invite
В текущей developer-сборке установка и обслуживание ещё не подключены; doctor проверяет только предпосылки.
`;
export function renderPlan(plan: InstallPlan, json: boolean): string {
  if (json) return JSON.stringify(plan,null,2)+'\n';
  const target=plan.request.target.kind==='local'?'этот компьютер':'собственный VPS';
  return `Предварительный план: ${plan.request.profile}, ${target}\nДоступ: ${plan.request.network}\nКаталог: ${plan.request.root}\nВерсия: ${plan.request.release}\nШаги: ${plan.steps.join(' → ')}\n` +
    (plan.blockers.length ? `Блокеры:\n${plan.blockers.map(x=>'- '+x).join('\n')}\n` : '') +
    'Службы не установлены. ОС, runtime, TLS и медиасеть должны пройти preflight перед исполнением.\n';
}
