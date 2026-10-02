import {readFile,writeFile,rename,mkdir,lstat} from "node:fs/promises";
import {randomUUID} from "node:crypto";
import os from "node:os";
import path from "node:path";
export function networkOutRate(before,after) {
  if(!before || !after || after.at<=before.at || after.at-before.at>120000) return null;
  let delta=0,count=0;
  for(const [name,value] of Object.entries(after.bytes || {})) {
    const old=before.bytes?.[name];
    if(Number.isFinite(value) && Number.isFinite(old) && value>=old) {delta+=value-old;count++;}
  }
  return count ? delta*8/(after.at-before.at)/1000 : null;
}
export async function sampleHostNetwork() {
  if(process.platform!=="linux") return null;
  const file=process.env.CASTLINK_HEARTBEAT_COUNTER_FILE || path.join(os.tmpdir(),`castlink-heartbeat-${process.getuid?.() ?? "user"}`,"network.json");
  try {
    const directory=path.dirname(file);await mkdir(directory,{recursive:true,mode:0o700});
    const info=await lstat(directory);
    if(info.isSymbolicLink() || !info.isDirectory() || (info.mode & 0o077)!==0 || process.getuid && info.uid!==process.getuid()) return null;
    const routes=await readFile("/proc/net/route","utf8"),dev=await readFile("/proc/net/dev","utf8");
    const selected=process.env.CASTLINK_NETWORK_INTERFACE?.trim();
    const interfaces=new Set(selected ? [selected] : routes.split("\n").slice(1).map(line=>line.trim().split(/\s+/)).filter(parts=>parts[1]==="00000000").map(parts=>parts[0]));
    const bytes={};
    for(const line of dev.split("\n")) {const index=line.indexOf(":");if(index<0)continue;const name=line.slice(0,index).trim();if(!interfaces.has(name))continue;const fields=line.slice(index+1).trim().split(/\s+/);const tx=Number(fields[8]);if(Number.isFinite(tx))bytes[name]=tx;}
    const sample={at:Date.now(),bytes};
    const previous=await readFile(file,"utf8").then(JSON.parse).catch(()=>null);
    const temp=`${file}.${randomUUID()}.tmp`;await writeFile(temp,JSON.stringify(sample),{mode:0o600,flag:"wx"});await rename(temp,file);
    return networkOutRate(previous,sample);
  } catch {return null;}
}
