// Fixed same-origin local bootstrap; never prints its setup token.
import http from 'node:http';
async function request(method,body){
 return new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port:3000,path:'/api/setup',method,timeout:10000,
   headers:{Origin:'http://127.0.0.1:3000',Host:'127.0.0.1:3000','Content-Type':'application/json','x-castlink-setup-token':process.env.CASTLINK_SETUP_TOKEN}},res=>{
   let text='';res.on('data',data=>{text+=data;if(text.length>65536)req.destroy(Error());});res.on('end',()=>resolve({status:res.statusCode,text}));
  });req.on('error',reject);req.on('timeout',()=>req.destroy(Error()));req.end(body||'');
 });
}
try{
 const observed=await request('GET');if(observed.status!==200)throw Error();
 if(JSON.parse(observed.text).needsSetup){const result=await request('POST',JSON.stringify({mode:'public',serverName:'CastLink'}));if(![200,409].includes(result.status))throw Error();}
 const complete=await request('GET');if(complete.status!==200||JSON.parse(complete.text).needsSetup!==false)throw Error();
}catch{console.error('CastLink initial setup is not ready');process.exitCode=3;}
