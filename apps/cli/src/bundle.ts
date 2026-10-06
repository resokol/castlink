import {CliError} from './types.js';
import {lstat, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {protectPath, writeSecretFile} from './secrets.js';
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

// Pure candidate rendering only: the caller supplies protected artifacts and verifies readiness.
import {validateBundleNetwork} from './network.js';
import type {CheckResult, NetworkMode} from './types.js';
export type BundleInput = {
 release:ReleaseManifest;installationId:string;architecture:'amd64'|'arm64';network:NetworkMode;bindIPv4:string;
 secretFiles:{webEnv:string;postgresEnv:string;livekitConfig:string};
};
type Mount = {type:'volume'|'bind';source:string;target:string;read_only?:boolean;bind?:{create_host_path:false}};
type PublishedPort = {host_ip:string;published:string;target:number;protocol:'tcp'|'udp'};
type Service = {image:string;platform:string;restart:'unless-stopped';networks:string[];env_file?:string[];environment?:Record<string,string>;volumes?:Mount[];ports?:PublishedPort[];command?:string[];configs?:{source:string;target:string;mode:number}[];depends_on?:Record<string,{condition:'service_healthy'}>;healthcheck?:{test:string[];interval:string;timeout:string;retries:number}};
export type ComposeModel = {name:string;services:Record<'web'|'postgres'|'livekit'|'caddy',Service>;volumes:Record<string,Record<string,never>>;networks:{castlink:{driver:'bridge'}};configs:{caddy:{content:string}}};
export type RenderedBundle = {projectName:string;nodeId:string;composeModel:ComposeModel;composeText:string;caddyText:string;requirements:{composeMinimumVersion:'2.23.1'};checks:CheckResult[]};
const caddyTemplate=`{
    admin off
    auto_https disable_redirects
    skip_install_trust
    default_sni {{BIND_IPV4}}
    log default {
        exclude http.log.error http.log.access
    }
    servers {
        protocols h1 h2
    }
}

https://{{BIND_IPV4}} {
    tls internal
    @rtc path /rtc /rtc/*
    route @rtc {
        forward_auth web:3000 {
            uri /api/media-admission
            header_up -Upgrade
            header_up -Connection
        }
        reverse_proxy livekit:7880
    }
    reverse_proxy web:3000
}
`;
export function renderBundle(input:BundleInput):RenderedBundle {
 if(!input || typeof input!=='object')throw new CliError('Invalid bundle input.');
 if(typeof input.installationId!=='string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(input.installationId))throw new CliError('A valid installation UUID is required.');
 if(input.architecture!=='amd64' && input.architecture!=='arm64')throw new CliError('Unsupported bundle architecture.');
 if(!input.release || typeof input.release.release!=='string')throw new CliError('Invalid release manifest.');
 const release=validateReleaseManifest(input.release,input.release.release,input.architecture);
 const network=validateBundleNetwork(input.network,input.bindIPv4);
 const secretFiles=fields(input.secretFiles,['webEnv','postgresEnv','livekitConfig']);
 for(const value of Object.values(secretFiles))if(typeof value!=='string' || value.length<1 || value.length>4096 || /[\x00-\x1f\x7f]/.test(value))throw new CliError('Invalid protected config reference.');
 const files=input.secretFiles;
 const identity=input.installationId.toLowerCase();
 const suffix=identity.replaceAll('-','');
 const projectName=`castlink-${suffix}`,nodeId=`srv-${suffix}`;
 const caddyText=caddyTemplate.replaceAll('{{BIND_IPV4}}',network.bindIPv4);
 const base=(name:typeof imageNames[number]):Service=>({image:release.images[name].reference,platform:`linux/${input.architecture}`,restart:'unless-stopped',networks:['castlink']});
 const port=(published:string,target:number,protocol:'tcp'|'udp'):PublishedPort=>({host_ip:network.bindIPv4,published,target,protocol});
 const composeModel:ComposeModel={
  name:projectName,
  services:{
   postgres:{...base('postgres'),env_file:[files.postgresEnv],volumes:[{type:'volume',source:'postgres-data',target:'/var/lib/postgresql/data'}],healthcheck:{test:['CMD-SHELL','pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'],interval:'5s',timeout:'5s',retries:12}},
   web:{...base('web'),env_file:[files.webEnv],environment:{CASTLINK_DEPLOYMENT_MODEL:'self-hosted',CASTLINK_ENFORCE_NODE_ADMISSION:'1',LIVEKIT_SERVER_URL:'http://livekit:7880',CASTLINK_CONTROL_PLANE_URL:'',CASTLINK_LICENSE_SERVICE_URL:'',CASTLINK_LICENSE_ENFORCE:'0',STUDIOLINK_DATA_DIR:'/data',STUDIOLINK_INSTALLATION_ID:identity,CASTLINK_NODE_ID:nodeId},volumes:[{type:'volume',source:'web-data',target:'/data'}],depends_on:{postgres:{condition:'service_healthy'}}},
   livekit:{...base('livekit'),command:['--config','/etc/livekit.yaml'],volumes:[{type:'bind',source:files.livekitConfig,target:'/etc/livekit.yaml',read_only:true,bind:{create_host_path:false}}],ports:[port(String(network.iceTcpPort),network.iceTcpPort,'tcp'),...Array.from({length:101},(_,index)=>port(String(61000+index),61000+index,'udp'))]},
   caddy:{...base('caddy'),configs:[{source:'caddy',target:'/etc/caddy/Caddyfile',mode:0o444}],volumes:[{type:'volume',source:'caddy-data',target:'/data'},{type:'volume',source:'caddy-config',target:'/config'}],ports:[port(String(network.httpsPort),network.httpsPort,'tcp')]},
  },
  volumes:{'postgres-data':{},'web-data':{},'caddy-data':{},'caddy-config':{}},
  networks:{castlink:{driver:'bridge'}},configs:{caddy:{content:caddyText}},
 };
 // JSON is valid Compose YAML. Escape every dollar before Compose interpolation, including paths.
 const composeText=JSON.stringify(composeModel,null,2).replaceAll('$',()=> '$$')+'\n';
 const checks:CheckResult[]=[
  {id:'compose-compatibility',state:'unverified',message:'Docker Compose 2.23.1 or newer must be verified before materializing configs.content.'},
  {id:'network-bind',state:'unverified',message:'The selected host IPv4 interface must exist and fixed HTTPS/ICE ports must be available before materialization; no network probes were run.'},
  {id:'protected-config',state:'unverified',message:'Protected file existence, permissions, database credentials and matching LiveKit keys require preflight; no files were read.'},
  {id:'seed',state:'unverified',message:'Local migrations and seed must use the returned installation and node identities before admission can work.'},
  {id:'tls',state:'unverified',message:'The project CA is private; client certificate trust has not been verified.'},
  {id:'media',state:'unverified',message:'Opaque LiveKit config must match fixed ICE ports and the selected host address; candidate advertisement, desktop networking and real media are unverified.'},
  {id:'http-diagnostics',state:'unverified',message:'Request-containing HTTP error and access logs are disabled to avoid URI/token disclosure; startup/system diagnostics remain available, safe HTTP diagnostics require separate work.'},
  {id:'release-images',state:'unverified',message:'Digest and architecture claims were validated; registry image availability and multiarch manifests were not verified.'},
 ];
 return {projectName,nodeId,composeModel,composeText,caddyText,requirements:{composeMinimumVersion:'2.23.1'},checks};
}

export type BundleCredentials = {postgresPassword:string;livekitKey:string;livekitSecret:string;sessionSecret:string;dataEncryptionKey:string;setupToken:string;nodeSecret:string};
// Internal pure shared schema; values are generated locally or substituted by the fixed remote helper.
export function bundleContents(input:BundleInput,credentials:BundleCredentials):Record<'postgres.env'|'web.env'|'livekit.yaml'|'compose.yaml',string> {
 const rendered=renderBundle(input),network=validateBundleNetwork(input.network,input.bindIPv4);
  const postgresEnv=`POSTGRES_USER=castlink\nPOSTGRES_DB=castlink\nPOSTGRES_PASSWORD=${credentials.postgresPassword}\n`;
  const webEnv=Object.entries({
   NODE_ENV:'production',CASTLINK_DEPLOYMENT_MODEL:'self-hosted',CASTLINK_STORAGE_BACKEND:'json',
   DATABASE_URL:`postgresql://castlink:${credentials.postgresPassword}@postgres:5432/castlink`,
   LIVEKIT_SERVER_URL:'http://livekit:7880',LIVEKIT_API_KEY:credentials.livekitKey,LIVEKIT_API_SECRET:credentials.livekitSecret,
   CASTLINK_SESSION_SECRET:credentials.sessionSecret,CASTLINK_DATA_ENCRYPTION_KEY:credentials.dataEncryptionKey,CASTLINK_SETUP_TOKEN:credentials.setupToken,
   STUDIOLINK_DATA_DIR:'/data',STUDIOLINK_INSTALLATION_ID:rendered.composeModel.services.web.environment!.STUDIOLINK_INSTALLATION_ID!,
   STUDIOLINK_DEFAULT_STUDIO_ID:'studio-default',CASTLINK_NODE_ID:rendered.nodeId,CASTLINK_SERVER_ID:rendered.nodeId,
   CASTLINK_NODE_SECRET:credentials.nodeSecret,CASTLINK_NODE_TYPE:'self-hosted',CASTLINK_ENFORCE_NODE_ADMISSION:'1',
   CASTLINK_LICENSE_ENFORCE:'0',CASTLINK_CONTROL_PLANE_URL:'',CASTLINK_LICENSE_SERVICE_URL:'',
  }).map(([key,value])=>`${key}=${value}`).join('\n')+'\n';
  // JSON is valid YAML and avoids interpolating credentials into YAML syntax.
  const livekitConfig=JSON.stringify({port:7880,log_level:'info',rtc:{
   tcp_port:network.iceTcpPort,port_range_start:61000,port_range_end:61100,
   use_external_ip:false,node_ip:network.bindIPv4,enable_loopback_candidate:network.bindIPv4==='127.0.0.1',
  },keys:{[credentials.livekitKey]:credentials.livekitSecret}},null,2)+'\n';
 return {'postgres.env':postgresEnv,'web.env':webEnv,'livekit.yaml':livekitConfig,'compose.yaml':rendered.composeText};
}

export type MaterializedBundle = {
 composePath:string;secretFiles:BundleInput['secretFiles'];projectName:string;nodeId:string;
 requirements:RenderedBundle['requirements'];checks:CheckResult[];
};
// Local candidate artifacts only. Never starts services or treats disk state as readiness.
// Existing/partial directories require diagnosis; retries cannot regenerate their credentials.
export async function materializeBundle(input:Omit<BundleInput,'secretFiles'>,directory:string):Promise<MaterializedBundle> {
 if(typeof directory!=='string' || !path.isAbsolute(directory) || /[\x00-\x1f\x7f]/.test(directory))throw new CliError('An absolute bundle directory is required.');
 const destination=path.resolve(directory);
 const secretFiles={webEnv:path.join(destination,'web.env'),postgresEnv:path.join(destination,'postgres.env'),livekitConfig:path.join(destination,'livekit.yaml')};
 // Validate and snapshot all candidate data before touching the filesystem.
 const candidate=structuredClone(input);
 const rendered=renderBundle({...candidate,secretFiles});
 try {
  let ancestor=path.dirname(destination);
  for(;;){
   const info=await lstat(ancestor);
   if(info.isSymbolicLink())throw new CliError('Refusing symbolic link in bundle ancestors.',4);
   if(!info.isDirectory())throw new CliError('Bundle parent must be an existing directory.',4);
   const parent=path.dirname(ancestor);if(parent===ancestor)break;ancestor=parent;
  }
 }catch(error){if(error instanceof CliError)throw error;throw new CliError('Cannot verify bundle parent directory.',4);}
 try {await mkdir(destination,{mode:0o700});}
 catch(error){if((error as NodeJS.ErrnoException).code==='EEXIST')throw new CliError('Bundle path already exists; refusing overwrite or credential regeneration.',4);throw new CliError('Cannot create private bundle directory.',1);}
 try {
  await protectPath(destination,true);
  const hex=()=>randomBytes(32).toString('hex');
  const contents=bundleContents({...candidate,secretFiles},{postgresPassword:hex(),livekitKey:`lk_${randomBytes(16).toString('hex')}`,livekitSecret:hex(),sessionSecret:hex(),dataEncryptionKey:hex(),setupToken:hex(),nodeSecret:hex()});
  await writeSecretFile(secretFiles.postgresEnv,contents['postgres.env']);
  await writeSecretFile(secretFiles.webEnv,contents['web.env']);
  await writeSecretFile(secretFiles.livekitConfig,contents['livekit.yaml']);
  const composePath=path.join(destination,'compose.yaml');
  await writeSecretFile(composePath,rendered.composeText);
  return {composePath,secretFiles,projectName:rendered.projectName,nodeId:rendered.nodeId,requirements:rendered.requirements,checks:rendered.checks};
 }catch{
  // Keep incomplete private artifacts for diagnosis. Never return raw OS/ACL errors or secrets.
  throw new CliError('Bundle materialization failed; private partial artifacts require diagnosis before retry.',1);
 }
}
