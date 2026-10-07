import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {renderPrimaryInventory} from './windows-primary-inventory.mjs';
import {serverManifest as validateServerManifest} from './package-cli.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function launcher(profilesRoot,resumeProfile,vps=false){
 return ['@echo off','setlocal DisableDelayedExpansion','"%SystemRoot%\\System32\\chcp.com" 65001 >nul',
  `set "CASTLINK_PROFILE_ROOT=${profilesRoot}"`,
  `"%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0${vps?'Prepare-VPS':'EasySetup'}.ps1"${resumeProfile?' -Target local -Profile '+resumeProfile:''} %*`,
  'set "CASTLINK_SETUP_EXIT=%ERRORLEVEL%"','echo.',
  'echo Код завершения: %CASTLINK_SETUP_EXIT%. Подробности приведены выше.',
  'echo Это окно можно закрыть после чтения результата.','pause','exit /b %CASTLINK_SETUP_EXIT%',''].join('\r\n');
}
async function checkedFile(source,name,expected){
 let current=source;
 for(const component of name.split('/')){current=path.join(current,component);if((await lstat(current)).isSymbolicLink())throw Error('Package source contains a symbolic link.');}
 const info=await lstat(current);
 if(!info.isFile()||info.size>550*1024*1024||expected.bytes!==undefined&&info.size!==expected.bytes)throw Error('Package file size mismatch.');
 const bytes=await readFile(current);
 if(sha(bytes)!==expected.sha256)throw Error('Package checksum mismatch.');
 return bytes;
}

// Assemble an already admitted native package. This does not build, execute or
// claim platform acceptance, download images, or modify a server/profile.
export async function packageEasySetup(options){
 const {profilesRoot,resumeProfile}=options;
 if(typeof profilesRoot!=='string'||!path.win32.isAbsolute(profilesRoot)||!(/^[A-Za-z]:\\/.test(profilesRoot))||/[\x00-\x1f\x7f"%]/.test(profilesRoot)||profilesRoot.split(/[\\/]/).includes('..'))throw Error('An explicit Windows profile directory is required.');
 if(resumeProfile!==undefined&&!/^[a-z][a-z0-9-]{0,31}$/.test(resumeProfile))throw Error('Invalid resume profile.');
 if(!/^[a-f0-9]{64}$/.test(options.launcherSHA256??''))throw Error('Expected native launcher checksum is required.');
 const source=path.resolve(options.source),output=path.resolve(options.output);
 const sourceInfo=await lstat(source);if(!sourceInfo.isDirectory()||sourceInfo.isSymbolicLink())throw Error('Invalid native package directory.');
 const inventoryBytes=await readFile(options.inventory);if(inventoryBytes.length>1024*1024)throw Error('Inventory is too large.');
 const inventory=renderPrimaryInventory(JSON.parse(inventoryBytes.toString('utf8')));
 const contents=new Map();
 for(const file of inventory.files)contents.set(file.path,await checkedFile(source,file.path,file));
  contents.set('bin/castlink.exe',await checkedFile(source,'bin/castlink.exe',{sha256:options.launcherSHA256}));
  let serverBytes;
  if(options.serverManifest!==undefined||options.serverManifestSHA256!==undefined){
    if(typeof options.serverManifest!=='string'||!/^[a-f0-9]{64}$/.test(options.serverManifestSHA256??''))throw Error('Server manifest and its expected checksum are required together.');
    serverBytes=await readFile(options.serverManifest);
    if(serverBytes.length>65536||sha(serverBytes)!==options.serverManifestSHA256)throw Error('Server manifest checksum mismatch.');
    validateServerManifest(JSON.parse(serverBytes.toString('utf8')),'amd64');
  }
 // All source hashes pass before the new destination is created. Never replace
 // a previous user package or copy unlisted files from the source directory.
 await mkdir(output);
 const app=path.join(output,'app');await mkdir(app);
  for(const [name,bytes] of contents){const target=path.join(app,name);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes,{flag:'wx'});}
  if(serverBytes){await mkdir(path.join(output,'server'));await writeFile(path.join(output,'server/release.json'),serverBytes,{flag:'wx'});}
  await writeFile(path.join(output,'EasySetup.cmd'),launcher(profilesRoot),{flag:'wx'});
  if(resumeProfile)await writeFile(path.join(output,'Continue-local.cmd'),launcher(profilesRoot,resumeProfile),{flag:'wx'});
  await writeFile(path.join(output,'Prepare-VPS.cmd'),launcher(profilesRoot,undefined,true),{flag:'wx'});
  for(const [sourceName,targetName] of [['windows-easy-setup.ps1','EasySetup.ps1'],['windows-prepare-vps.ps1','Prepare-VPS.ps1']]){
    const script=await readFile(new URL(sourceName,import.meta.url),'utf8');
    await writeFile(path.join(output,targetName),'\ufeff'+script.replace(/\r?\n/g,'\r\n'),{flag:'wx'});
  }
  await writeFile(path.join(output,'ubuntu-easy-setup-bootstrap.sh'),await readFile(new URL('ubuntu-easy-setup-bootstrap.sh',import.meta.url)),{flag:'wx'});
 const readme=`CastLink Easy Setup — Windows\n\nЗапуск\n1. Полностью распакуй папку. Встроенный Node.js уже включён; npm устанавливать не нужно.\n2. Запусти EasySetup.cmd двойным щелчком. Мастер спросит, где установить сервер.\n3. Прочитай итоговый результат. При ошибке окно останется открытым.\n\n${resumeProfile?'Для продолжения сохранённой локальной установки запусти Continue-local.cmd. Новое имя создаёт отдельную установку; порт 443 должен быть свободен.\n\n':''}Каталог профилей: ${profilesRoot}\nЭта личная сборка использует указанный существующий закрытый каталог. Не переноси и не удаляй его при обновлении программы.\n\nЭтот компьютер\nМастер сам запускает установленный Docker Desktop и ждёт готовности Linux containers. Если Docker отсутствует, мастер предложит установить его; могут понадобиться подтверждение Windows, принятие условий и перезагрузка. Самим участникам звонка Docker не нужен: они открывают сервер в браузере. В режиме loopback белый IP не требуется, доступ возможен только с этого ПК.\n\nСвой VPS\nСначала запусти Prepare-VPS.cmd: он создаст отдельный SSH-ключ на D:, покажет публичную часть для добавления через панель провайдера и проверит вход. Этот выпуск поддерживает Ubuntu 22.04/24.04 x86_64 и подготовку от root. При необходимости он предложит установку/запуск Docker Engine и Compose. Для приватного выпуска нужен вход VPS в ghcr.io: GitHub username и PAT classic с read:packages и доступом к resokol/castlink-easy-web вводятся в стандартном SSH-терминале Docker, а не в чате. Уже работающие службы и существующий /opt/castlink не перезаписываются. Затем выбери «Свой VPS» в EasySetup.cmd. Нужен собственный домен с DNS A на публичный IPv4 VPS. Открой в панели провайдера TCP 80/443/7881 и UDP 61000–61100; SSH-порт должен оставаться доступным. Удали неверную AAAA-запись, если IPv6 сервера не настроен. Этот выпуск использует прямое медиасоединение без TURN; сети, блокирующие прямой доступ, требуют отдельной настройки TURN. Docker на Windows не является условием удалённого сервера. Мастер должен подтвердить поддержку выбранного режима и его предпосылки до установки. Не считай успешную сборку программы подтверждением готовности VPS.\n\nДоступ владельца\nОдноразовая ссылка сохраняется в закрытом файле; путь будет показан мастером. Открой файл на своём ПК. Не отправляй ссылку и содержимое файла другим людям. Локальный HTTPS требует явного доверия сертификату в браузере.\n\nПроверка результата\nПроверка служб, браузерного HTTPS и реального звонка — отдельные результаты. Следуй подсказкам текущего запуска. Упаковка сама по себе не подтверждает успешную установку или работу медиа.\n\nИз терминала: app\\bin\\castlink.exe --help\nДля работы с этими профилями сначала задай CASTLINK_PROFILE_ROOT указанному выше каталогу.\n`;
 await writeFile(path.join(output,'README_RU.txt'),'\ufeff'+readme.replaceAll('\n','\r\n'),{flag:'wx'});
 const result={schemaVersion:1,files:contents.size,nodeBundled:true,launcherSHA256:options.launcherSHA256,inventorySHA256:sha(inventoryBytes),...(serverBytes?{serverManifestSHA256:sha(serverBytes)}:{}),executionVerifiedByPackaging:false};
 await writeFile(path.join(output,'PACKAGE.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 return result;
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 const mapping={'--source':'source','--output':'output','--inventory':'inventory','--launcher-sha256':'launcherSHA256','--profiles-root':'profilesRoot','--resume-profile':'resumeProfile','--server-manifest':'serverManifest','--server-manifest-sha256':'serverManifestSHA256'};
 try{
  const options={};for(let i=2;i<process.argv.length;i+=2){const key=mapping[process.argv[i]],value=process.argv[i+1];if(!key||options[key]!==undefined||!value)throw Error('Invalid packaging arguments.');options[key]=value;}
  for(const key of ['source','output','inventory','launcherSHA256','profilesRoot'])if(!options[key])throw Error('Missing packaging argument.');
  console.log(JSON.stringify(await packageEasySetup(options)));
 }catch{console.error('Easy Setup packaging failed. Check the admitted source, checksums, profile directory and a new output path.');process.exitCode=1;}
}
