import {parseStrictJson} from './strict-json.js';
import {WindowsNativeTargetError} from './windows-native-target.js';
const record=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const none=(x:unknown)=>x===null||Array.isArray(x)&&x.length===0;
// Necessary structural observation, not provenance or uninterrupted cold proof.
// Bind to the actually admitted publisher image graph and native lease PRE/POST.
// This stricter profile requires explicit fresh rendering; old profiles refuse.
export function admitWindowsTargetContainer(bytes:Buffer,binding:{containerId:string;imageId:string;project:string}):void{
 try{
  if(!Buffer.isBuffer(bytes)||bytes.length<1||bytes.length>262144||! /^[a-f0-9]{64}$/.test(binding.containerId)||! /^sha256:[a-f0-9]{64}$/.test(binding.imageId)||! /^[a-z0-9][a-z0-9_-]{0,127}$/.test(binding.project))throw Error();
  const raw=bytes.toString('utf8');if(!Buffer.from(raw).equals(bytes))throw Error();
  const items=parseStrictJson(raw,262144);if(!Array.isArray(items)||items.length!==1||!record(items[0]))throw Error();const c=items[0],h=c.HostConfig,state=c.State;
  if(c.Id!==binding.containerId||c.Image!==binding.imageId||!record(state)||state.Running!==true||!record(h)||h.ReadonlyRootfs!==true||h.Privileged!==false||!none(h.CapAdd)||!Array.isArray(h.CapDrop)||h.CapDrop.length!==1||h.CapDrop[0]!=='ALL'||!Array.isArray(h.Devices)||h.Devices.length!==0||!none(h.DeviceRequests)||!Array.isArray(h.SecurityOpt)||h.SecurityOpt.length!==1||h.SecurityOpt[0]!=='no-new-privileges:true'||!(h.Tmpfs===null||record(h.Tmpfs)&&Object.keys(h.Tmpfs).length===0))throw Error();
  if(!Array.isArray(c.Mounts)||c.Mounts.length!==1||!record(c.Mounts[0]))throw Error();const m=c.Mounts[0];
  if(m.Type!=='volume'||m.Name!==binding.project+'_web-data'||m.Destination!=='/data'||m.RW!==true||m.Driver!=='local')throw Error();
 }catch{throw new WindowsNativeTargetError();}
}
