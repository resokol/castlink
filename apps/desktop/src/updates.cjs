'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const REPOSITORY='resokol/castlink-releases',API=`https://api.github.com/repos/${REPOSITORY}/releases`;
const VERSION=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
function compareVersions(left,right){
  const a=VERSION.exec(left),b=VERSION.exec(right);if(!a||!b)throw Error('Invalid version');
  for(let i=1;i<=3;i++){const x=BigInt(a[i]),y=BigInt(b[i]);if(x!==y)return x>y?1:-1;}
  if(!a[4]||!b[4])return a[4]===b[4]?0:a[4]?-1:1;
  const x=a[4].split('.'),y=b[4].split('.');
  for(let i=0;i<Math.max(x.length,y.length);i++){
    if(x[i]===y[i])continue;if(x[i]===undefined)return -1;if(y[i]===undefined)return 1;
    const nx=/^\d+$/.test(x[i]),ny=/^\d+$/.test(y[i]);
    if(nx&&ny)return BigInt(x[i])>BigInt(y[i])?1:-1;
    if(nx!==ny)return nx?-1:1;return x[i]>y[i]?1:-1;
  }return 0;
}
function releaseInfo(release,track){
  if(!release||release.draft||!['client','server-setup'].includes(track))return null;
  const match=new RegExp(`^${track}-v(.+)-([a-f0-9]{12})$`).exec(release.tag_name||'');
  if(!match||!VERSION.test(match[1])||!Number.isFinite(Date.parse(release.published_at)))return null;
  return {tag:release.tag_name,version:match[1],commit:match[2],published:Date.parse(release.published_at),assets:release.assets};
}
function releaseAsset(info,name){
  const found=(info.assets||[]).filter(asset=>asset.name===name);
  const expected=[REPOSITORY,'resokol/castlink'].map(repository=>`https://github.com/${repository}/releases/download/${info.tag}/${name}`);
  const url=found[0]?.browser_download_url;
  const maximum=name==='SHA256SUMS'?1024*1024:name.endsWith('-setup.exe')?2*1024*1024*1024:64*1024*1024*1024;
  if(found.length!==1||found[0].state!=='uploaded'||!Number.isSafeInteger(found[0].size)||found[0].size<=0||found[0].size>maximum||!expected.includes(url))throw Error('Release asset is unavailable');
  return {name,url};
}
function selectUpdate(releases,current){
  if(!current||!VERSION.test(current.version)||!['client','server-setup'].includes(current.track))return null;
  const entries=releases.map(release=>releaseInfo(release,current.track)).filter(Boolean);
  const installed=entries.find(entry=>entry.version===current.version&&entry.commit===current.sourceCommit?.slice(0,12));
  const candidates=entries.filter(entry=>{
    const comparison=compareVersions(entry.version,current.version);
    return comparison>0||comparison===0&&installed&&entry.published>installed.published&&entry.commit!==installed.commit;
  }).sort((a,b)=>compareVersions(b.version,a.version)||b.published-a.published);
  for(const latest of candidates)try{
    if(current.track==='client'){
      latest.installer=releaseAsset(latest,`CastLink-Client-${latest.version}-${latest.commit}-setup.exe`);
      latest.checksums=releaseAsset(latest,'SHA256SUMS');
    }else for(const name of ['CastLink-Windows.zip','CastLink-Linux.tar.gz','CastLink-Provisioning.json','manifest.json','SHA256SUMS','CastLink-ThirdParty-Sources.tar.gz','CastLink-ThirdParty-Office-Sources.tar.gz'])releaseAsset(latest,name);
    return latest;
  }catch{}
  return null;
}
function parseChecksum(text,name){
  const matches=text.split(/\r?\n/).map(line=>/^([a-fA-F0-9]{64}) [ *](.+)$/.exec(line)).filter(match=>match&&match[2]===name);
  if(matches.length!==1)throw Error('Release checksum is unavailable');return matches[0][1].toLowerCase();
}
async function boundedText(response,limit){
  if(!response.ok)throw Error('Release request failed');
  const chunks=[];let length=0;for await(const chunk of response.body){length+=chunk.length;if(length>limit)throw Error('Release response is too large');chunks.push(Buffer.from(chunk));}
  return Buffer.concat(chunks).toString('utf8');
}
async function fetchReleases({fetch=globalThis.fetch}={}){
  const releases=[];
  // Independent channels share one repository. Never use releases/latest.
  for(let page=1;page<=10;page++){
    const response=await fetch(`${API}?per_page=100&page=${page}`,{headers:{Accept:'application/vnd.github+json','User-Agent':'CastLink-Client'},signal:AbortSignal.timeout(15000)});
    const batch=JSON.parse(await boundedText(response,4*1024*1024));if(!Array.isArray(batch))throw Error('Invalid release response');
    releases.push(...batch);if(batch.length<100)return releases;
  }return releases;
}
async function downloadInstaller(info,{directory=os.tmpdir(),fetch=globalThis.fetch}={}){
  // Revalidate even if a caller retained an older selection object.
  const installer=releaseAsset(info,info.installer.name),checksums=releaseAsset(info,'SHA256SUMS');
  const signal=AbortSignal.timeout(10*60*1000),options={headers:{'User-Agent':'CastLink-Client'},signal};
  const checksum=parseChecksum(await boundedText(await fetch(checksums.url,options),1024*1024),installer.name);
  fs.mkdirSync(directory,{recursive:true});
  const work=fs.mkdtempSync(path.join(directory,'castlink-client-update-')),file=path.join(work,installer.name);
  const cleanup=()=>fs.rmSync(work,{recursive:true,force:true});
  let handle;
  try{
    const response=await fetch(installer.url,options);if(!response.ok)throw Error('Installer download failed');
    const digest=crypto.createHash('sha256');let length=0;handle=await fs.promises.open(file,'wx',0o600);
    for await(const chunk of response.body){length+=chunk.length;if(length>2*1024*1024*1024)throw Error('Installer is too large');digest.update(chunk);await handle.writeFile(Buffer.from(chunk));}
    await handle.close();handle=undefined;
    if(!length||digest.digest('hex')!==checksum)throw Error('Installer checksum mismatch');
    return {file,cleanup};
  }catch(error){if(handle)await handle.close();cleanup();throw error;}
}
function cleanupDownloads(directory){
  let entries;try{entries=fs.readdirSync(directory,{withFileTypes:true});}catch{return;}
  for(const entry of entries)try{
    if(!entry.isDirectory()||entry.isSymbolicLink()||!/^castlink-client-update-[A-Za-z0-9]{6}$/.test(entry.name))continue;
    const folder=path.join(directory,entry.name),files=fs.readdirSync(folder,{withFileTypes:true});
    if(files.every(file=>file.isFile()&&!file.isSymbolicLink()&&/^CastLink-Client-[0-9A-Za-z.-]+-[a-f0-9]{12}-setup\.exe$/.test(file.name)))fs.rmSync(folder,{recursive:true,force:true});
  }catch{} // Windows retains an installer that is still running; retry next launch.
}
async function launchInstaller(file,{platform=process.platform,spawn=require('node:child_process').spawn,onStarted=()=>{}}={}){
  if(platform!=='win32'||!path.isAbsolute(file)||!file.endsWith('-setup.exe')||!fs.statSync(file).isFile())throw Error('Installer unavailable');
  return new Promise((resolve,reject)=>{
    let child;try{child=spawn(file,[],{shell:false,detached:true,stdio:'ignore'});}catch{reject(Error('Installer could not start'));return;}
    child.once('error',()=>reject(Error('Installer could not start')));
    child.once('spawn',()=>{child.unref();onStarted();resolve();});
  });
}
function readJson(file){if(fs.statSync(file).size>1024*1024)throw Error('State is too large');return JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));}
function readServerBuilds(roots,folders=[]){
  const entries=[];
  for(const root of roots)try{const receipt=readJson(path.join(root,'.castlink-runtime.json'));if(receipt.schemaVersion===1&&Array.isArray(receipt.installations))entries.push(...receipt.installations);}catch{}
  for(const entry of folders)entries.push(typeof entry==='string'?{folder:entry}:entry);
  const result=[],seen=new Set();
  for(const entry of entries)try{
    if(typeof entry.folder!=='string'||!path.isAbsolute(entry.folder)||seen.has(path.resolve(entry.folder)))continue;
    const folder=path.resolve(entry.folder),state=readJson(path.join(folder,'.castlink-install.json')),owned=readJson(path.join(folder,'.castlink-owned.json')),compose=readJson(path.join(folder,'compose.json'));
    if(state.schemaVersion!==1||state.completed!==true||state.stopped||state.target!=='local'||!VERSION.test(state.version)||!/^[a-f0-9]{40}$/.test(state.commit||''))continue;
    if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(state.installationId||'')||entry.installationId&&entry.installationId!==state.installationId)continue;
    if(owned.schemaVersion!==1||owned.installationId!==state.installationId||owned.folder!==folder||compose.services?.web?.image!=='castlink-easy-web:'+state.commit)continue;
    seen.add(folder);result.push({track:'server-setup',version:state.version,sourceCommit:state.commit,folder});
  }catch{}
  return result;
}
async function discoverServerBuilds({roots,indexPath,fetch=globalThis.fetch}){
  const entries=[];
  if(indexPath)try{const index=readJson(indexPath);if(index.schemaVersion===1&&Array.isArray(index.installations))entries.push(...index.installations.slice(0,64));}catch{}
  // Older remote mirrors have a fixed default layout. No recursive disk scan.
  for(const root of roots)try{for(const entry of fs.readdirSync(path.join(root,'Remote'),{withFileTypes:true}))if(entry.isDirectory()&&/^\d{1,3}(?:\.\d{1,3}){3}-\d{1,5}$/.test(entry.name))entries.push({folder:path.join(root,'Remote',entry.name)});}catch{}
  const result=readServerBuilds(roots,entries);
  const seen=new Set();
  const remote=await Promise.all(entries.slice(0,64).map(async entry=>{
    try{
      if(typeof entry.folder!=='string'||!path.isAbsolute(entry.folder))return null;
      const folder=path.resolve(entry.folder);if(seen.has(folder))return null;seen.add(folder);
      const state=readJson(path.join(folder,'.castlink-install.json')),owned=readJson(path.join(folder,'.castlink-owned.json'));
      if(state.schemaVersion!==1||state.target!=='remote'||state.completed!==true||state.stopped||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(state.installationId||'')||entry.installationId&&entry.installationId!==state.installationId)return null;
      if(owned.schemaVersion!==1||owned.folder!==folder||owned.installationId!==state.installationId)return null;
      const origin=new URL(state.network?.publicOrigin||'https://'+state.address);
      if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)return null;
      const response=await fetch(origin.origin+'/api/version',{headers:{Accept:'application/json'},credentials:'omit',redirect:'error',signal:AbortSignal.timeout(5000)});
      const build=JSON.parse(await boundedText(response,16384));
      if(!VERSION.test(build.productVersion))return null;
      const prefix=build.productVersion+'-',identity=build.buildId||build.buildNumber;
      if(typeof identity!=='string'||!identity.startsWith(prefix)||!/^(?:[a-f0-9]{12}|[a-f0-9]{40})$/.test(identity.slice(prefix.length)))return null;
      return {track:'server-setup',version:build.productVersion,sourceCommit:identity.slice(prefix.length),folder,origin:origin.origin};
    }catch{return null;}
  }));
  return result.concat(remote.filter(Boolean));
}
const TEXT={
  ru:{title:'Обновления CastLink',client:'Клиент Windows',server:'Ваш сервер CastLink',available:'Доступна новая версия',stay:'Остаться на текущей',update:'Обновить',disable:'Отключить автоматическую проверку обновлений',current:'Текущая версия',next:'Новая версия',download:'Сначала будет скачан установщик и проверена сумма SHA256. Текущий сеанс продолжится до отдельного подтверждения установки.',serverDetail:'Откроется мастер обновления вашего установленного сервера. Он проверит цель и запросит подтверждение перед изменениями.',ready:'Установщик скачан и проверен',install:'Установить и перезапустить',cancel:'Позже',restart:'Клиент закроется; камера, микрофон и демонстрация остановятся. Откроется пошаговый установщик Windows. После установки запустите клиент из завершающего окна. Пакет не имеет цифровой подписи; SHA256 подтверждает совпадение с опубликованным файлом.',latest:'Новых обновлений не найдено.',unknown:'Сервер: проверены только подтверждённые локальные установки и доступные сохранённые VPS. Другой или недоступный сервер проверьте через «Настройка сервера → Обновить сервер».',error:'Не удалось проверить или установить обновление. Проверьте сеть и повторите ручную проверку.',ok:'Закрыть',check:'Проверить обновления…',automatic:'Проверять обновления при запуске'},
  en:{title:'CastLink updates',client:'Windows client',server:'Your CastLink server',available:'A new version is available',stay:'Stay on current version',update:'Update',disable:'Disable automatic update checks',current:'Current version',next:'New version',download:'The installer will be downloaded and its SHA256 verified first. Your current session continues until you separately confirm installation.',serverDetail:'The update wizard for your installed server will open. It verifies the target and asks for confirmation before changes.',ready:'Installer downloaded and verified',install:'Install and restart',cancel:'Later',restart:'The client will close; camera, microphone and sharing will stop. The Windows setup wizard will open. Launch the client from its final screen after installation. This package is unsigned; SHA256 confirms it matches the published file.',latest:'No newer updates found.',unknown:'Server: only verified local installations and reachable saved VPS targets were checked. For another or unreachable server, use Server setup → Update server.',error:'Could not check or install the update. Check your connection and try a manual check again.',ok:'Close',check:'Check for updates…',automatic:'Check for updates at startup'},
  'zh-CN':{title:'CastLink 更新',client:'Windows 客户端',server:'您的 CastLink 服务器',available:'有可用的新版本',stay:'保留当前版本',update:'更新',disable:'禁用自动更新检查',current:'当前版本',next:'新版本',download:'先下载安装程序并验证 SHA256。在您单独确认安装之前，当前会话将继续。',serverDetail:'将打开已安装服务器的更新向导。向导会验证目标，并在更改前请求确认。',ready:'安装程序已下载并验证',install:'安装并重启',cancel:'稍后',restart:'客户端将关闭，摄像头、麦克风和屏幕共享将停止。Windows 安装向导将打开。安装后请在完成页面启动客户端。此软件包未签名；SHA256 仅确认其与发布文件一致。',latest:'没有发现更新版本。',unknown:'服务器：仅检查已验证的本地安装和可访问的已保存 VPS。其他或无法访问的服务器请使用“服务器设置 → 更新服务器”。',error:'无法检查或安装更新。请检查网络连接，然后手动重试。',ok:'关闭',check:'检查更新…',automatic:'启动时检查更新'}
};
function createUpdateController({userData,current,getServers=()=>[],getLocale=()=> 'ru',showMessage,fetchReleases:discover=fetchReleases,download=downloadInstaller,install,updateServer}){
  const settingsFile=path.join(userData,'updates.json');let automatic=true,busy=false;
  try{automatic=readJson(settingsFile).automatic!==false;}catch{}
  function setAutomatic(value){if(typeof value!=='boolean')throw Error('Invalid update preference');fs.mkdirSync(userData,{recursive:true});const temporary=settingsFile+'.tmp';fs.writeFileSync(temporary,JSON.stringify({automatic:value}),{mode:0o600});fs.renameSync(temporary,settingsFile);automatic=value;}
  return {automatic:()=>automatic,setAutomatic,async check({manual=false,locale}={}){
    if(busy||!manual&&!automatic)return;busy=true;const t=TEXT[locale]||TEXT[getLocale()]||TEXT.ru;let artifact,actionAttempted=false;
    try{
      const releases=await discover(),servers=await getServers(),items=[current,...servers].map(build=>({build,update:selectUpdate(releases,build)})).filter(item=>item.update);
      if(!items.length&&manual){const answer=await showMessage({type:'info',title:t.title,message:t.latest,detail:t.unknown,buttons:[t.ok],checkboxLabel:t.disable,checkboxChecked:!automatic});setAutomatic(!answer.checkboxChecked);}
      for(const {build,update}of items){
        // A choice to disable checks takes effect immediately for both channels.
        if(!manual&&!automatic)break;
        const isClient=build.track==='client';
        const answer=await showMessage({type:'info',title:t.title,message:`${isClient?t.client:t.server}: ${t.available}`,detail:`${t.current}: ${build.version}\n${t.next}: ${update.version} (${update.commit})${build.folder?'\n'+build.folder:''}\n\n${isClient?t.download:t.serverDetail}`,buttons:[t.stay,t.update],defaultId:0,cancelId:0,noLink:true,checkboxLabel:t.disable,checkboxChecked:!automatic});
        setAutomatic(!answer.checkboxChecked);if(answer.response!==1)continue;actionAttempted=true;
        if(!isClient){await updateServer(build);continue;}
        artifact=await download(update);
        const confirm=await showMessage({type:'warning',title:t.title,message:t.ready,detail:t.restart,buttons:[t.cancel,t.install],defaultId:0,cancelId:0,noLink:true});
        if(confirm.response!==1){artifact.cleanup();artifact=undefined;continue;}
        await install(artifact.file);artifact=undefined;break;
      }
    }catch{
      artifact?.cleanup();
      // Startup network failures stay silent; explicit checks/actions report failure.
      if(manual||actionAttempted)await showMessage({type:'warning',title:t.title,message:t.error,buttons:[t.ok]});
    }finally{busy=false;}
  }};
}
module.exports={compareVersions,selectUpdate,parseChecksum,fetchReleases,downloadInstaller,cleanupDownloads,launchInstaller,readServerBuilds,discoverServerBuilds,createUpdateController,TEXT};
