'use strict';
const isPresenterLaunch=value=>typeof value==='string'&&/^castlink-presenter:/i.test(value);
function parsePresenterLaunch(value){
 try{
  if(typeof value!=='string'||value.length>4096||/[\\\u0000-\u0020\u007f]/.test(value))throw Error();
  const url=new URL(value);
  if(url.protocol!=='castlink-presenter:'||url.hostname!=='connect'||url.username||url.password||url.port||!['','/'].includes(url.pathname)||
     [...url.searchParams.keys()].length!==1||!url.searchParams.has('server')||!/^#cp2_[A-Za-z0-9_-]{43}$/.test(url.hash))throw Error();
  const server=url.searchParams.get('server'),origin=new URL(server);
  if(origin.protocol!=='https:'||origin.username||origin.password||origin.origin!==server)throw Error();
  return{server,code:url.hash.slice(1)};
 }catch{throw Error('Invalid presenter link');}
}
module.exports={isPresenterLaunch,parsePresenterLaunch};
