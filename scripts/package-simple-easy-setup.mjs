import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
export const stockReferences = {
 postgres:'docker.io/library/postgres@sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea',
 livekit:'docker.io/livekit/livekit-server@sha256:6fd3b7088874c4d119160dd688798dfec852bc014786d392caad15f6f63912a3',
 caddy:'docker.io/library/caddy@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d'
};
export function imageReferences(commit) {
 if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('actual commit required');
 return Object.fromEntries(['web','postgres','livekit','caddy'].map(name=>[name,`castlink-easy-${name}:${commit}`]));
}
export async function assemble({root=process.cwd(),output,image,commit,imageId,officialImageIds}) {
 if (!/^[a-f0-9]{40}$/.test(commit)||!/^sha256:[a-f0-9]{64}$/.test(imageId)) throw new Error('actual commit and Docker image ID required');
 for(const key of Object.keys(stockReferences)) if(!/^sha256:[a-f0-9]{64}$/.test(officialImageIds?.[key]??'')) throw new Error('actual official Docker image IDs required');
 const images=imageReferences(commit);
 const manifest=JSON.parse(execFileSync('tar',['-xOzf',image,'manifest.json'],{encoding:'utf8'}));
 const archiveTags=new Set(manifest.flatMap(entry=>entry.RepoTags??[]));
 if(Object.values(images).some(tag=>!archiveTags.has(tag))) throw new Error('image archive is missing current release tags');
 await fs.mkdir(output,{recursive:true});
 const stage=path.join(output,'stage'); await fs.mkdir(path.join(stage,'scripts'),{recursive:true}); await fs.mkdir(path.join(stage,'payload'),{recursive:true});
 const scripts=['windows-simple-easy-setup.ps1','simple-easy-setup-deploy.ps1','simple-easy-setup-runtime.ps1','simple-easy-setup-ssh.ps1','ubuntu-easy-setup-bootstrap.sh'];
 for(const name of scripts){let bytes=await fs.readFile(path.join(root,'scripts',name));if(name.endsWith('.ps1'))bytes=Buffer.from('\ufeff'+bytes.toString('utf8').replace(/^\ufeff/,'').replace(/\r?\n/g,'\r\n'));await fs.writeFile(path.join(stage,'scripts',name),bytes);}
 await fs.copyFile(image,path.join(stage,'payload','images.tar.gz'));
 const release={schemaVersion:1,version:'1.0.0-rc.2',commit,imageArchive:'images.tar.gz',images,imageIdentities:{web:imageId,...officialImageIds},sourceReferences:stockReferences};
 await fs.writeFile(path.join(stage,'payload','release.json'),JSON.stringify(release,null,2)+'\n');
 await fs.writeFile(path.join(stage,'EasySetup.cmd'),'@echo off\r\nchcp 65001 >nul\r\n"%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\\windows-simple-easy-setup.ps1"\r\npause\r\n');
 await fs.writeFile(path.join(stage,'README.txt'),'CastLink Easy Setup\nРаспакуй всю папку и открой EasySetup.cmd. Один мастер установит текущую версию с GitHub на ПК или Linux VPS. Для удаления выбери «Удалить»: данные сохраняются по умолчанию; полное удаление комнат и настроек требует отдельного выбора и подтверждения сервера. Docker/WSL и общие образы не удаляются. SSH пароль не сохраняется. Локальному HTTPS требуется доверие собственному сертификату. VPS: Ubuntu22.04/24.04 amd64, root, домен.\n');
 execFileSync('tar',['-czf',path.join(output,'CastLink-Linux.tar.gz'),'-C',stage,'payload','scripts/ubuntu-easy-setup-bootstrap.sh']);
 execFileSync('zip',['-q','-0','-r',path.join(output,'CastLink-Windows.zip'),'.'],{cwd:stage});
 const sums=[];for(const name of ['CastLink-Windows.zip','CastLink-Linux.tar.gz'])sums.push(createHash('sha256').update(await fs.readFile(path.join(output,name))).digest('hex')+'  '+name);
 await fs.writeFile(path.join(output,'SHA256SUMS'),sums.join('\n')+'\n'); return release;
}
if(import.meta.url===new URL('file://'+process.argv[1]).href){ const [output,image,commit,imageId,idsFile]=process.argv.slice(2); await assemble({output:path.resolve(output),image:path.resolve(image),commit,imageId,officialImageIds:JSON.parse(await fs.readFile(idsFile,'utf8'))}); }
