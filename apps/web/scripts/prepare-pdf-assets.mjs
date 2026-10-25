import { rm, mkdir, readdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const publicDefault=fileURLToPath(new URL('../public/',import.meta.url));
const vendorDefault=()=>dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'));

// Native PowerPoint helpers remain disabled. Never serve stale downloads.
export async function removePresentationAssets(publicDirectory=publicDefault) {
  await rm(join(publicDirectory,'pdfjs'),{recursive:true,force:true});
  for(const name of ['CastLink-PowerPoint-Windows.ps1','CastLink-PowerPoint-macOS.js'])await rm(join(publicDirectory,'helpers',name),{force:true});
}
export async function preparePdfAssets(publicDirectory=publicDefault,vendorDirectory=vendorDefault()) {
  await removePresentationAssets(publicDirectory);
  const output=join(publicDirectory,'pdfjs');await mkdir(output,{recursive:true});
  const copy=async(source,target)=>{await mkdir(dirname(target),{recursive:true});await copyFile(source,target);};
  await copy(join(vendorDirectory,'build/pdf.worker.min.mjs'),join(output,'pdf.worker.min.mjs'));
  await copy(join(vendorDirectory,'LICENSE'),join(output,'LICENSE'));
  const {version}=JSON.parse(await readFile(join(vendorDirectory,'package.json'),'utf8'));
  await writeFile(join(output,'.version'),version);
  for(const folder of ['cmaps','standard_fonts','wasm']) {
    let files=[];try{files=await readdir(join(vendorDirectory,folder),{withFileTypes:true});}catch(error){if(error.code!=='ENOENT')throw error;}
    for(const file of files){
      const allowed=/^LICENSE(?:_[A-Z0-9_]+)?$/.test(file.name)||folder==='cmaps'&&/^[A-Za-z0-9_-]+\.bcmap$/.test(file.name)||folder==='standard_fonts'&&/^[A-Za-z0-9_-]+\.(pfb|ttf)$/.test(file.name)||folder==='wasm'&&(/^[A-Za-z0-9_-]+\.wasm$/.test(file.name)||['quickjs-eval.js','jbig2_nowasm_fallback.js','openjpeg_nowasm_fallback.js'].includes(file.name));
      if(file.isFile()&&allowed)await copy(join(vendorDirectory,folder,file.name),join(output,folder,file.name));
    }
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await preparePdfAssets();
