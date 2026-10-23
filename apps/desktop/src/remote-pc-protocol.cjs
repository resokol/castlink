'use strict';
const isRemoteLaunch=value=>typeof value==='string'&&/^castlink-(?:remote|share):/i.test(value);
function parseRemoteLaunch(value,{allowLoopback=false,scheme}={}){
 try{
  if(typeof value!=='string'||value.length>4096||/[\\\u0000-\u0020\u007f]/.test(value))throw Error();
  const url=new URL(value);
  if(!['castlink-remote:','castlink-share:'].includes(url.protocol)||scheme!==undefined&&(!['castlink-remote:','castlink-share:'].includes(scheme)||url.protocol!==scheme)||url.hostname!=='connect'||url.username||url.password||url.port||!['','/'].includes(url.pathname)||[...url.searchParams.keys()].length!==1||!url.searchParams.has('server')||!/^#rp1_[A-Za-z0-9_-]{43}$/.test(url.hash))throw Error();
  const server=url.searchParams.get('server'),origin=new URL(server);
  if(!(origin.protocol==='https:'||allowLoopback&&origin.protocol==='http:'&&origin.hostname==='127.0.0.1')||origin.username||origin.password||origin.origin!==server)throw Error();
  return {server,ticket:url.hash.slice(1)};
 }catch{throw Error('Invalid remote PC link');}
}
function windowHandle(id){const m=typeof id==='string'&&/^window:([1-9][0-9]{0,18}):(0|[1-9][0-9]{0,9})$/.exec(id);return m&&BigInt(m[1])<=9223372036854775807n?m[1]:null;}
module.exports={isRemoteLaunch,parseRemoteLaunch,windowHandle};
