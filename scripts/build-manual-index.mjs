#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const target="docs/manual/FILE_MAP_RU.md";
const check=process.argv.includes("--check");
const descriptions=JSON.parse(readFileSync(path.join(root,"docs/manual/descriptions.json"),"utf8"));
const files=execFileSync("git",["ls-files","-z"],{cwd:root,encoding:"utf8"}).split("\0").filter(Boolean).sort();
const known=new Set(files);
const text=new Map(files.map(file=>{
 if(file===target) return [file,""];
 const bytes=readFileSync(path.join(root,file));
 return [file,bytes.includes(0)?"":bytes.toString("utf8")];
}));
const link=file=>`[\`${file}\`](${path.posix.relative("docs/manual",file).split("/").map(encodeURIComponent).join("/")})`;
const resolve=(file,spec)=>{
 const stem=spec.startsWith("@/")?"apps/web/"+spec.slice(2):spec.startsWith(".")?path.posix.normalize(path.posix.join(path.posix.dirname(file),spec)):null;
 if(!stem) return null;
 return [stem,...[".ts",".tsx",".mjs",".cjs",".js",".json","/index.ts","/index.tsx"].map(s=>stem+s)].find(candidate=>known.has(candidate))||null;
};
const imports=new Map(), reverse=new Map();
for(const file of files){
 const source=text.get(file)||"";
 const specs=/\.(?:ts|tsx|js|cjs|mjs)$/.test(file)?[...source.matchAll(/(?:\bfrom\s*|\brequire\s*\(\s*|\bimport\s*\(\s*|\bimport\s*)["']([^"']+)["']/g)].map(m=>m[1]):[];
 const local=[...new Set(specs.map(spec=>resolve(file,spec)).filter(Boolean))].sort();
 const external=[...new Set(specs.filter(spec=>!spec.startsWith(".")&&!spec.startsWith("@/")))].sort();
 imports.set(file,{local,external});
 for(const dep of local){if(!reverse.has(dep)) reverse.set(dep,[]);reverse.get(dep).push(file);}
}
const scriptPurposes={
 "super-admin-owner":"Первая/восстановительная ссылка владельца сервиса. Меняет PG access; пишет bearer только в приватный новый файл.",
 "build-manual-index":"Воспроизводимая карта файлов/импортов/экспортов для этого мануала. Не читает production или Git credentials.",
 "production-preflight":"Предварительная валидация compose/env/image перед установкой; не выводит значения секретов.",
 "production-update":"Backup данных и PostgreSQL, замена web, health gate и попытка image rollback; не мигрирует всю БД автоматически.",
 "production-rollback":"Откат web image из сохранённого manifest; не возврат БД и не гарантия сохранения новой security policy.",
 "postgres-backup":"Создание custom pg_dump, проверка pg_restore --list и контрольной суммы.",
 "postgres-restore":"Явное восстановление PostgreSQL с подтверждением замены. Потенциально разрушительно.",
 "postgres-migrate":"Node-local SQL migrations комнат. Выполнять только в выбранной БД после backup.",
 "postgres-import-rooms":"Перенос legacy JSON-комнат в PostgreSQL с отдельной проверкой результата.",
 "control-plane-migrate":"Последовательное применение central control-plane SQL из infrastructure/control-plane.",
 "control-plane-seed-default":"Создание/согласование default organization, Studio, node и room metadata.",
 "control-plane-register-node":"Регистрация node endpoint, региона и capacity в реестре; не физический запуск сервера.",
 "node-heartbeat":"Однократный сбор LiveKit/loadavg/memory и подписанная отправка heartbeat.",
 "storage-backup":"Backup постоянных файлов и manifest с привязкой к installation identity.",
 "storage-restore":"Контролируемое восстановление файлов постоянных данных; отдельно от image rollback.",
 "support-bundle":"Ограниченный диагностический JSON и TCP/TLS-пробы без полного env/dump.",
 "install-ubuntu":"Начальная установка Linux-окружения и bootstrap-конфигурации; изменяет хост.",
 "install-windows":"Bootstrap Windows/Docker-установки; не нативный media-клиент.",
 "turn-preflight":"Предварительные проверки TURN-схемы.",
 "turn-stage2-preflight":"Предварительная проверка TURN/TLS/SNI stage 2.",
 "turn-stage2-deploy":"Установка TURN stage 2; может затронуть сетевой ingress и активные подключения."
};
function purpose(file,source){
 const basename=path.posix.basename(file).replace(/\.(ts|tsx|mjs|cjs|ps1|sh)$/,""),stem=basename.replace(/\.module\.css$/,"");
 if(file.startsWith("apps/web/lib/")||file.startsWith("apps/web/components/")) return descriptions[basename]||descriptions[stem]||(/\.css$/.test(file)?"Локальные стили интерфейса; цвета, размеры и адаптивная раскладка соответствующего компонента.":"Модуль приложения; публичные символы и прямые зависимости перечислены ниже.");
 if(file.startsWith("apps/web/tests/")){
  const messages=[...source.matchAll(/(?:console\.log|process\.stdout\.write)\(\s*['"`]([^'"`\n]+)['"`]/g)].map(m=>m[1]).filter(s=>s.includes("PASS")||s.toLowerCase().includes("passed"));
  return "Проверка/тестовый инструмент. "+(messages.join("; ")||"Сценарии и утверждения следует читать в исходнике; отсутствие реального браузера/БД нельзя считать end-to-end проверкой.");
 }
 if(file.startsWith("scripts/")) return scriptPurposes[basename]||"Операторский скрипт; перед запуском проверить аргументы и побочные эффекты в исходнике.";
 if(file.endsWith("/route.ts")) return "Серверный HTTP-обработчик "+file.replace(/^apps\/web\/app/,"").replace(/\/route\.ts$/,"")+". Проверяет запросы и вызывает модули ниже; права определяются guard-кодом, не URL.";
 if(file.endsWith("/page.tsx")) return "React-страница "+(file.replace(/^apps\/web\/app/,"").replace(/\/page\.tsx$/,"")||"/")+". Интерфейс и связи с компонентами/API; сама страница не заменяет server-side authorization.";
 if(file.startsWith("docs/")||file.endsWith(".md")) return source.match(/^#\s+(.+)$/m)?.[1]||"Документация/инструкция; сверяйте дату и статус с текущей сборкой.";
 if(file.startsWith(".github/workflows/")) return "GitHub Actions: "+(source.match(/^name:\s*(.+)$/m)?.[1]||"workflow")+". Выполняется runner-ом, а не в браузере.";
 if(file.endsWith(".sql")) return "SQL-структура/миграция: "+(source.match(/^--\s*(.+)$/m)?.[1]||"проверить таблицы, ключи и ограничения перед запуском")+". Может менять БД.";
 if(file.includes(".env")&&file.endsWith(".example")) return "Шаблон переменных окружения. Не реальная конфигурация/секреты установки; значения заполняют вне Git.";
 if(file.includes("docker-compose")) return "Описание контейнерных сервисов, сетей, volumes, портов и healthchecks. Не равняется фактически запущенному compose на VPS.";
 if(file.startsWith("apps/studio-")) return "Нативное отдельное направление: bootstrap/CMake/source, не функционально равнозначная замена web Studio. Текущий статус смотрите в README и главе 03.";
 if(file.startsWith("infrastructure/")) return "Конфигурация инфраструктуры: "+file.split("/")[1]+". Адреса и порты сверяются с конкретной установкой; не применять вслепую.";
 if(file.startsWith(".codex/")||file==="AGENTS.md") return "Правила/роль помощника при работе с кодом. Не browser/API security policy.";
 if(file.startsWith(".vscode/")||file.endsWith(".code-workspace")) return "Настройки редактора и задач разработчика; не production service.";
 const special={"Dockerfile.web":"Рецепт сборки web image, включая зависимости, scripts и control-plane SQL.","package.json":"Версия продукта, команды workspace, pnpm и overrides.","pnpm-lock.yaml":"Зафиксированный граф версий зависимостей; не редактировать вручную ради обновления UI.","pnpm-workspace.yaml":"Список проектов pnpm workspace.",".gitignore":"Какие локальные/секретные/сгенерированные файлы не включаются в Git.",".dockerignore":"Какие файлы исключены из Docker build context.","apps/web/app/globals.css":"Глобальные дизайн-токены, интерфейс CastLink, LiveKit layout и адаптивные правила.","apps/web/next.config.ts":"Версия/build ID, headers безопасности, параметры сборки Next.js.","apps/web/instrumentation.ts":"Startup-валидация persistent storage и room backend.","apps/web/app/layout.tsx":"Общая обёртка страниц, metadata, стили и уведомления версии."};
 return special[file]||(file.endsWith("package.json")?"Зависимости и команды конкретного подпроекта.":file.endsWith("tsconfig.json")?"Параметры проверки TypeScript и разрешения импортов.":"Вспомогательная конфигурация/ресурс; назначение уточняется по исходнику и использующим файлам ниже.");
}
let out="# Полный каталог файлов и прямых связей CastLink\n\n[Оглавление](../MANUAL_RU.md) · [Системы](03_SYSTEMS_RU.md)\n\n";
out+="Генератор: `node scripts/build-manual-index.mjs`; проверка актуальности: `node scripts/build-manual-index.mjs --check`. Новые файлы сначала добавить в Git index. Каталог включает только файлы Git; реальные `.env`, токены, SSH-ключи, node_modules, runtime и временный QA не инвентаризируются.\n\n";
out+="Прямые импорты извлечены статически. Динамические загрузки с вычисляемым именем, HTTP, LiveKit events и SQL-связи не выводятся автоматически и разобраны в главе 03. Экспорт — доступный другим модулям символ, а не обязательно публичный HTTP API. Наличие теста в каталоге не означает, что он запускался.\n\n";
out+=`Всего файлов в Git index: **${files.length}**. Каждый файл ниже имеет отдельную запись.\n\n`;
const groups=new Map();
for(const file of files){const group=file.startsWith("apps/web/")?file.split("/").slice(0,3).join("/"):file.includes("/")?file.split("/")[0]:"Корень";if(!groups.has(group))groups.set(group,[]);groups.get(group).push(file);}
for(const [group,entries] of groups){
 out+=`## ${group} · ${entries.length} файлов\n\n`;
 for(const file of entries){
  const source=text.get(file)||"",{local,external}=imports.get(file);
  out+=`### ${file}\n\n${link(file)}\n\n${purpose(file,source).replaceAll("\r","")}\n\n`;
  const symbols=[...new Set([...source.matchAll(/\bexport\s+(?:async\s+)?(?:function|class|const|type|interface|enum)\s+(\w+)/g)].map(m=>m[1]))];
  if(symbols.length)out+="Экспортируемые символы: "+symbols.map(s=>`\`${s}\``).join(", ")+".\n\n";
  if(local.length)out+="Читает/импортирует: "+local.map(link).join(", ")+".\n\n";
  if(external.length)out+="Библиотеки/Node: "+external.map(s=>`\`${s}\``).join(", ")+".\n\n";
  const users=reverse.get(file)||[];
  if(users.length)out+="Используют: "+users.map(link).join(", ")+".\n\n";
  const env=[...new Set([...source.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)].map(m=>m[1]))];
  if(env.length)out+="Переменные окружения (только имена): "+env.sort().map(s=>`\`${s}\``).join(", ")+".\n\n";
 }
}
if(check){if(!existsSync(path.join(root,target))||readFileSync(path.join(root,target),"utf8")!==out){console.error("Manual file map is stale; run the generator and commit it.");process.exitCode=1;}else console.log(`PASS: manual catalog covers ${files.length} indexed files`);}
else {writeFileSync(path.join(root,target),out,"utf8");console.log(`Generated ${target}: ${files.length} files`);}
