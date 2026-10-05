import {CliError} from './types.js';
export type ReleaseImage = {reference:string;architectures:('amd64'|'arm64')[]};
export type ReleaseManifest = {schemaVersion:1;release:string;nodeVersion:string;architectures:('amd64'|'arm64')[];images:Record<'web'|'postgres'|'livekit'|'caddy',ReleaseImage>};
const imageNames=['web','postgres','livekit','caddy'] as const;
const version=/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/;
function fields(value:unknown,keys:readonly string[]):Record<string,unknown>{
 if(!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).length!==keys.length || Object.keys(value).some(key=>!keys.includes(key)))throw new CliError('Invalid release schema fields.');
 return value as Record<string,unknown>;
}
function architectures(value:unknown):('amd64'|'arm64')[]{
 if(!Array.isArray(value) || value.length<1 || value.length>2 || new Set(value).size!==value.length || value.some(x=>x!=='amd64'&&x!=='arm64'))throw new CliError('Invalid release architecture list.');
 return value as ('amd64'|'arm64')[];
}
// This validates manifest claims; pull/index verification still belongs to installation preflight.
export function validateReleaseManifest(value:unknown,release:string,architecture:'amd64'|'arm64'):ReleaseManifest {
 const m=fields(value,['schemaVersion','release','nodeVersion','architectures','images']);
 if(m.schemaVersion!==1)throw new CliError('Unsupported release schema.');
 if(typeof m.release!=='string' || m.release.length>128 || !version.test(m.release) || m.release!==release)throw new CliError('Release version mismatch or invalid release.');
 if(typeof m.nodeVersion!=='string' || !/^22\.\d+\.\d+$/.test(m.nodeVersion))throw new CliError('Release requires an exact Node 22 runtime version.');
 const supported=architectures(m.architectures);
 if(!supported.includes(architecture))throw new CliError('Release does not support requested architecture.');
 if(!m.images || typeof m.images!=='object' || Array.isArray(m.images) || Object.keys(m.images).length!==imageNames.length || imageNames.some(name=>!(name in (m.images as object))))throw new CliError('Required release images are missing or invalid.');
 const images=fields(m.images,imageNames);
 for(const name of imageNames){
  if(!images[name])throw new CliError('Required release image is missing.');
  const image=fields(images[name],['reference','architectures']);
  if(typeof image.reference!=='string' || image.reference.length>512 || !/^[a-z0-9][a-z0-9._:/-]*@sha256:[a-f0-9]{64}$/.test(image.reference))throw new CliError('Every image requires a pinned SHA-256 digest.');
  const imageArchitectures=architectures(image.architectures);
  if(supported.some(arch=>!imageArchitectures.includes(arch)))throw new CliError('Image does not support a declared release architecture.');
 }
 return structuredClone(m) as ReleaseManifest;
}
