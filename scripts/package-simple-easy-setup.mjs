import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
export const stockReferences = {
 postgres:'docker.io/library/postgres@sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea',
 livekit:'docker.io/livekit/livekit-server@sha256:6fd3b7088874c4d119160dd688798dfec852bc014786d392caad15f6f63912a3',
 caddy:'docker.io/library/caddy@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d'
};
export const turnTlsBaseReference='docker.io/library/haproxy@sha256:5d97434a423c2533cfeb42874d45cf6d69a840b60334582dfbfd5008e94c80be';
export function imageReferences(commit) {
 if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('actual commit required');
 return Object.fromEntries(['web','postgres','livekit','caddy','turntls'].map(name=>[name,`castlink-easy-${name}:${commit}`]));
}
export async function assemble({root=process.cwd(),output,image,commit,imageId,officialImageIds,launcher}) {
 if (!/^[a-f0-9]{40}$/.test(commit)||!/^sha256:[a-f0-9]{64}$/.test(imageId)) throw new Error('actual commit and Docker image ID required');
 for(const key of Object.keys(stockReferences)) if(!/^sha256:[a-f0-9]{64}$/.test(officialImageIds?.[key]??'')) throw new Error('actual official Docker image IDs required');
 if(!/^sha256:[a-f0-9]{64}$/.test(officialImageIds?.turntls??'')) throw new Error('actual TURN TLS Docker image ID required');
 if(!launcher || (await fs.readFile(launcher)).subarray(0,2).toString()!=='MZ') throw new Error('compiled Windows launcher required');
 const images=imageReferences(commit);
 const manifest=JSON.parse(execFileSync('tar',['-xOzf',image,'manifest.json'],{encoding:'utf8'}));
 const archiveTags=new Set(manifest.flatMap(entry=>entry.RepoTags??[]));
 if(Object.values(images).some(tag=>!archiveTags.has(tag))) throw new Error('image archive is missing current release tags');
 await fs.mkdir(output,{recursive:true});
 const stage=path.join(output,'stage'); await fs.mkdir(path.join(stage,'scripts'),{recursive:true}); await fs.mkdir(path.join(stage,'payload'),{recursive:true});
 const scripts=['windows-simple-easy-setup.ps1','simple-easy-setup-deploy.ps1','simple-easy-setup-runtime.ps1','simple-easy-setup-ssh.ps1','simple-easy-setup-cleanup.ps1','simple-easy-setup-trust.ps1','simple-easy-setup-download.ps1','simple-easy-setup-gui.ps1','simple-easy-setup-window.xaml','simple-easy-setup-release.json','simple-easy-setup-reserves.ps1','ubuntu-easy-setup-bootstrap.sh'];
 for(const name of scripts){let bytes=await fs.readFile(path.join(root,'scripts',name));if(name.endsWith('.ps1'))bytes=Buffer.from('\ufeff'+bytes.toString('utf8').replace(/^\ufeff/,'').replace(/\r?\n/g,'\r\n'));await fs.writeFile(path.join(stage,'scripts',name),bytes);}
 await fs.copyFile(image,path.join(stage,'payload','images.tar.gz'));
 const distribution=JSON.parse(await fs.readFile(path.join(root,'scripts','simple-easy-setup-release.json'),'utf8'));
 if(!/^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(distribution.repository??'')) throw new Error('valid distribution repository required');
 await fs.copyFile(path.join(root,'LICENSE'),path.join(stage,'LICENSE'));
 const bundleFiles={};for(const name of scripts)bundleFiles['scripts/'+name]=createHash('sha256').update(await fs.readFile(path.join(stage,'scripts',name))).digest('hex');
 bundleFiles.LICENSE=createHash('sha256').update(await fs.readFile(path.join(stage,'LICENSE'))).digest('hex');
 const capabilities=['peer-profile-v1','root-ssh-v1'];
 const release={imageArchiveSha256:createHash('sha256').update(await fs.readFile(image)).digest('hex'),bundleFiles,distributionRepository:distribution.repository,schemaVersion:1,version:'1.0.0-rc.2',commit,imageArchive:'images.tar.gz',images,imageIdentities:{web:imageId,...officialImageIds},sourceReferences:{...stockReferences,turntls:turnTlsBaseReference},capabilities};
 await fs.writeFile(path.join(stage,'payload','release.json'),JSON.stringify(release,null,2)+'\n');
 await fs.copyFile(launcher,path.join(stage,'EasySetup.exe'));
 await fs.writeFile(path.join(stage,'EasySetup.cmd'),'@echo off\r\nstart "" "%~dp0EasySetup.exe"\r\n');
 await fs.writeFile(path.join(stage,'EasySetup-Console.cmd'),'@echo off\r\nchcp 65001 >nul\r\n"%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\\windows-simple-easy-setup.ps1"\r\npause\r\n');
 await fs.writeFile(path.join(stage,'README.txt'),'CastLink Easy Setup\nРаспакуй всю папку и открой EasySetup.exe (или EasySetup.cmd). Графический мастер использует штатные PowerShell5 и WPF; консольный вариант — EasySetup-Console.cmd. Загрузки показывают реальные байты и скорость; неизвестная длительность операции показана ожиданием. Один мастер установит текущую версию с GitHub на ПК или Linux VPS. Для удаления выбери «Удалить»: внешний сервер мастер найдёт сам после SSH-подключения, Windows-папку знать не нужно; данные сохраняются по умолчанию; полное удаление комнат и настроек требует отдельного выбора и ввода DELETE. Мастер очищает собственные файлы/образы и доказанно неиспользуемые зависимости; прежние и общие компоненты сохраняются с пояснением. SSH пароль не сохраняется. Локальному HTTPS требуется доверие собственному сертификату. VPS: Ubuntu22.04/24.04 amd64, root; домен необязателен, можно использовать публичный IPv4. Домен можно добавить позже к той же установке.\n');
 execFileSync('tar',['-czf',path.join(output,'CastLink-Linux.tar.gz'),'-C',stage,'LICENSE','payload','scripts/ubuntu-easy-setup-bootstrap.sh']);
 if(process.platform==='win32'){
  execFileSync(process.env.CASTLINK_PYTHON??'python',['-c',`import os,sys,zipfile
with zipfile.ZipFile(sys.argv[2], 'w', compression=zipfile.ZIP_STORED) as z:
 for base,dirs,files in os.walk(sys.argv[1]):
  for name in sorted(files):
   file=os.path.join(base,name);z.write(file,os.path.relpath(file,sys.argv[1]).replace(os.sep,'/'))`,stage,path.join(output,'CastLink-Windows.zip')]);
 }else{execFileSync('zip',['-q','-0','-r',path.join(output,'CastLink-Windows.zip'),'.'],{cwd:stage});}
 await fs.writeFile(path.join(output,'CastLink-Provisioning.json'),JSON.stringify({schemaVersion:1,commit,capabilities})+'\n');
 const sums=[];for(const name of ['CastLink-Windows.zip','CastLink-Linux.tar.gz','CastLink-Provisioning.json'])sums.push(createHash('sha256').update(await fs.readFile(path.join(output,name))).digest('hex')+'  '+name);
 await fs.writeFile(path.join(output,'SHA256SUMS'),sums.join('\n')+'\n'); return release;
}
if(import.meta.url===new URL('file://'+process.argv[1]).href){ const [output,image,commit,imageId,idsFile,launcher]=process.argv.slice(2); await assemble({output:path.resolve(output),image:path.resolve(image),commit,imageId,officialImageIds:JSON.parse(await fs.readFile(idsFile,'utf8')),launcher}); }
