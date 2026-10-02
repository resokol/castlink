// Actual PostgreSQL + isolated LiveKit signalling. Never accepts a production database.
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),crypto=require("node:crypto"),{spawn}=require("node:child_process"),ts=require("typescript");
const database=process.env.TEST_DATABASE_URL;
if(!database) throw Error("TEST_DATABASE_URL is required");
const db=new URL(database);
if(!["localhost","127.0.0.1"].includes(db.hostname)||db.pathname!=="/castlink_test") throw Error("Refusing non-test database");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"castlink-node-ops-")),nodeId="node-ops-qa-"+crypto.randomUUID(),room="ops-qa-"+crypto.randomUUID();
const base="http://127.0.0.1:3113",signal="ws://127.0.0.1:17882/rtc",key="devkey",secret="secret";
Object.assign(process.env,{CASTLINK_CONTROL_PLANE_DATABASE_URL:database,CASTLINK_CONTROL_PLANE_URL:"",CASTLINK_NODE_ID:nodeId,CASTLINK_ENFORCE_NODE_ADMISSION:"1",STUDIOLINK_DATA_DIR:dir,CASTLINK_STORAGE_BACKEND:"json",LIVEKIT_SERVER_URL:"http://127.0.0.1:17880",LIVEKIT_API_KEY:key,LIVEKIT_API_SECRET:secret});
require.extensions[".ts"]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {controlPlanePool,closeControlPlanePool}=require("../lib/control-plane-store.ts");
const {issuePlatformInvite,redeemPlatformInvite,revokePlatformSession}=require("../lib/platform-credentials.ts");
const {AccessToken,RoomServiceClient}=require("livekit-server-sdk"),lk=new RoomServiceClient(process.env.LIVEKIT_SERVER_URL,key,secret);
let web,session,principal,sockets=[],stage="setup";
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function join(token){
 const ws=new WebSocket(signal+"?protocol=16&auto_subscribe=1&access_token="+encodeURIComponent(token));sockets.push(ws);
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error("signalling_timeout")),5000);ws.addEventListener("message",()=>{clearTimeout(timer);resolve();},{once:true});ws.addEventListener("error",()=>{clearTimeout(timer);reject(Error("signalling_denied"));},{once:true});});
 return ws;
}
async function post(body){const r=await fetch(base+"/api/super-admin",{method:"POST",headers:{origin:base,"content-type":"application/json",cookie:"castlink-super-admin-v2="+session.token},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});return {status:r.status,data:await r.json()};}
async function participants(){return lk.listParticipants(room).catch(()=>[]);}
(async()=>{
 const pool=controlPlanePool(),migrations=path.resolve(__dirname,"../../../infrastructure/control-plane");
 for(const file of fs.readdirSync(migrations).filter(f=>/^\d+.*\.sql$/.test(f)).sort()) await pool.query(fs.readFileSync(path.join(migrations,file),"utf8"));
 await pool.query("INSERT INTO castlink_control.nodes(node_id,name,region,node_type,state,health) VALUES($1,'Operations QA','test','cloud','active','healthy')",[nodeId]);
 principal=crypto.randomUUID();const invite=await issuePlatformInvite(principal);session=await redeemPlatformInvite(invite.invite);assert.ok(session);
 web=spawn(process.execPath,[require.resolve("next/dist/bin/next"),"start","-H","127.0.0.1","-p","3113"],{cwd:path.resolve(__dirname,".."),env:{...process.env,NODE_ENV:"production"},stdio:["ignore","ignore","ignore"]});
 let ready=false;for(let i=0;i<40;i++){if(web.exitCode!==null)throw Error("QA web exited");try {if((await fetch(base+"/api/version")).ok){ready=true;break;}}catch{}await pause(250);}assert.ok(ready,"QA server starts");
 const jwt=new AccessToken(key,secret,{identity:"guest-ops",name:"QA",ttl:"5m",metadata:JSON.stringify({role:"guest",studioId:"studio-default"})});jwt.addGrant({room,roomJoin:true,canPublish:true,canSubscribe:true});const token=await jwt.toJwt();
 stage="direct-admission";
 const directGate=await fetch(base+"/api/media-admission",{headers:{"x-forwarded-uri":"/rtc","authorization":"Bearer "+token}});
 assert.equal(directGate.status,204,"compiled route admits an active node's signed token");
 stage="proxy-validation";
 const validation=await fetch("http://127.0.0.1:17882/rtc/validate?protocol=16&auto_subscribe=1&access_token="+encodeURIComponent(token));
 console.log("QA_PROXY_VALIDATION",validation.status);
 if(!validation.ok) console.log("QA_PROXY_REASON",(await validation.text()).replaceAll(token,"[TOKEN]").slice(0,400));
 stage="initial-signalling";
 const first=await join(token);assert.ok((await participants()).some(p=>p.identity==="guest-ops"));
 stage="drain";
 let result=await post({action:"node-state",nodeId,state:"draining"});assert.equal(result.status,200);assert.ok(result.data.applied);assert.equal((await participants()).length,1,"drain preserves connected participant");
 result=await post({action:"node-state",nodeId,state:"force_offline"});assert.equal(result.status,400,"force requires explicit confirmation");
 stage="force-offline";
 result=await post({action:"node-state",nodeId,state:"force_offline",confirmForceOffline:true});assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.applied,true);
 assert.equal((await participants()).length,0,"actual LiveKit eviction");
 await assert.rejects(join(token),/signalling_denied/,"same token cannot rejoin through Caddy after Force Offline");
 stage="re-enable";
 result=await post({action:"node-state",nodeId,state:"active"});assert.equal(result.status,200,JSON.stringify(result.data));await join(token);
 let p=(await participants())[0];assert.ok(p);
 result=await post({action:"participant",nodeId,operation:{action:"rename",room,identity:p.identity,sid:p.sid,name:"Renamed QA"}});assert.equal(result.status,200);assert.equal((await participants())[0].name,"Renamed QA");
 result=await post({action:"participant",nodeId,confirmIdentity:p.identity,operation:{action:"kick",room,identity:p.identity,sid:p.sid}});assert.equal(result.status,200);
 await assert.rejects(join(token),/signalling_denied/,"kicked identity cannot reuse its old token");
 const anonymous=await fetch(base+"/api/super-admin/history?nodeId="+nodeId+"&room="+room);assert.equal(anonymous.status,403);
 const row=(await pool.query("SELECT operational_revision,applied_revision FROM castlink_control.nodes WHERE node_id=$1",[nodeId])).rows[0];assert.equal(row.operational_revision,row.applied_revision);
 console.log("PASS: actual PostgreSQL + LiveKit + Caddy: connected participant drain, forced eviction, denied old-token reconnect, re-enable, rename and kick revocation");
})().catch(error=>{console.error("QA_STAGE",stage,error.message);process.exitCode=1;}).finally(async()=>{
 for(const ws of sockets)try{ws.close();}catch{}
 if(web)web.kill();await lk.deleteRoom(room).catch(()=>undefined);
 if(session)await revokePlatformSession(session.token).catch(()=>undefined);
 await controlPlanePool().query("DELETE FROM castlink_control.nodes WHERE node_id=$1",[nodeId]).catch(()=>undefined);
 if(principal)await controlPlanePool().query("DELETE FROM castlink_control.platform_credentials WHERE principal_id=$1",[principal]).catch(()=>undefined);
 await closeControlPlanePool();fs.rmSync(dir,{recursive:true,force:true});
});
