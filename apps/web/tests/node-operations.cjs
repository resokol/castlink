const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),ts=require("typescript");
const {NextRequest}=require("next/server");
const sdk=require("livekit-server-sdk");
function load(file,mocks) {
 const module={exports:{}};
 const js=ts.transpileModule(fs.readFileSync(path.resolve(__dirname,file),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(js,{module,exports:module.exports,require:name=>{if(name in mocks)return mocks[name];throw Error("Unexpected import: "+name);},process:{env:{LIVEKIT_API_KEY:"qa-key",LIVEKIT_API_SECRET:"qa-secret-with-more-than-32-characters",CASTLINK_NODE_ID:"node-qa-ops"}},Buffer,URL,URLSearchParams,Date,console,AbortSignal});
 return module.exports;
}
let state="active",revision=1,configured=true,rooms=new Map(),acks=[],blocked=[],removed=[],renames=[];
class RoomServiceClient {
 async listRooms(){return [...rooms.keys()].map(name=>({name}));}
 async listParticipants(room){return rooms.get(room)||[];}
 async deleteRoom(room){rooms.delete(room);}
 async getParticipant(room,identity){const p=(rooms.get(room)||[]).find(p=>p.identity===identity);if(!p)throw Error("not_found");return p;}
 async updateParticipant(room,identity,patch){renames.push({room,identity,patch});}
 async removeParticipant(room,identity){assert.ok(blocked.includes(identity),"block is committed before disconnect");removed.push(identity);rooms.set(room,(rooms.get(room)||[]).filter(p=>p.identity!==identity));}
}
const admission={admissionConfigured:()=>configured,localNodeAdmission:async()=>({state,revision}),rememberLocalKick:async(_room,id)=>blocked.push(id),acknowledgeLocalOperation:async r=>acks.push(r)};
const ops=load("../lib/node-operations.ts",{"livekit-server-sdk":{RoomServiceClient},"./node-admission":admission,"./node-request":{ownNodeId:()=>"node-qa-ops"}});
(async()=>{
 rooms.set("qa-room",[{identity:"guest-a",sid:"PA_A"},{identity:"studio-panel-main",sid:"PA_B"}]);
 await ops.executeLocalNodeOperation({action:"enforce-state",revision});assert.equal(rooms.size,1,"Enabled keeps sessions");
 state="draining";await ops.executeLocalNodeOperation({action:"enforce-state",revision});assert.equal(rooms.get("qa-room").length,2,"Draining preserves existing participants");
 state="disabled";await assert.rejects(ops.executeLocalNodeOperation({action:"enforce-state",revision}),/node_not_drained/);assert.equal(rooms.size,1);
 state="force_offline";await assert.rejects(ops.executeLocalNodeOperation({action:"enforce-state",revision:0}),/stale/);assert.equal(rooms.size,1);
 configured=false;await assert.rejects(ops.executeLocalNodeOperation({action:"enforce-state",revision}),/not_configured/);assert.equal(rooms.size,1);
 configured=true;const forced=await ops.executeLocalNodeOperation({action:"enforce-state",revision});assert.equal(forced.disconnected,2);assert.equal(rooms.size,0);assert.equal(acks.at(-1),revision);
 rooms.set("qa-room",[{identity:"guest-a",sid:"PA_A"}]);
 await assert.rejects(ops.executeLocalNodeOperation({action:"rename",room:"qa-room",identity:"guest-a",sid:"PA_OLD",name:"New"}),/session_changed/);assert.equal(renames.length,0);
 await ops.executeLocalNodeOperation({action:"rename",room:"qa-room",identity:"guest-a",sid:"PA_A",name:"New"});assert.deepEqual(JSON.parse(JSON.stringify(renames[0].patch)),{name:"New"});
 await ops.executeLocalNodeOperation({action:"kick",room:"qa-room",identity:"guest-a",sid:"PA_A"});assert.deepEqual(removed,["guest-a"]);
 for(const bad of [{action:"rename",room:"r",identity:"x",sid:"a",name:""},{action:"rename",room:"r",identity:"x",sid:"a",name:"x".repeat(121)},{action:"enforce-state",revision:-1},{action:"delete-all"}]) assert.equal(ops.validNodeOperation(bad),false);
 const crypto=require("node:crypto"),auth=load("../lib/node-control-auth.ts",{"node:crypto":crypto});
 const proof=load("../lib/node-request.ts",{"node:crypto":crypto,"./node-heartbeat-auth":{heartbeatSecretForNode:()=>"qa-node-secret"},"./node-control-auth":auth});
 const body=JSON.stringify({action:"kick",room:"r",identity:"a",sid:"PA_A"}),at=String(Date.now()),uri="/v1/node/operations";
 const signature=auth.signNodeControlRequest("qa-node-secret",at,"POST",`${uri}:${crypto.createHash("sha256").update(body).digest("hex")}`);
 const req=new NextRequest("https://qa.test"+uri,{method:"POST",headers:{"x-castlink-node-id":"node-qa-ops","x-castlink-node-time":at,"x-castlink-node-signature":signature}});
 assert.equal(proof.verifiedNodeRequest(req,body),"node-qa-ops");assert.equal(proof.verifiedNodeRequest(req,body+" "),null,"body tampering is denied");
 let allowed=true,fail=false;
 const gate=load("../app/api/media-admission/route.ts",{"next/server":require("next/server"),"livekit-server-sdk":sdk,"../../../lib/node-admission":{admissionConfigured:()=>true,localNodeAdmission:async(room,id)=>{assert.equal(room,"qa-room");assert.equal(id,"guest-a");if(fail)throw Error("database_down");return {allowed};}}});
 const jwt=new sdk.AccessToken("qa-key","qa-secret-with-more-than-32-characters",{identity:"guest-a",ttl:"5m"});jwt.addGrant({room:"qa-room",roomJoin:true});const token=await jwt.toJwt();
 const handshake=()=>new NextRequest("http://localhost/api/media-admission",{headers:{"x-forwarded-uri":"/rtc","authorization":"Bearer "+token}});
 assert.equal((await gate.GET(handshake())).status,204);
 const mismatch=new NextRequest("http://localhost/api/media-admission",{headers:{"x-forwarded-uri":"/rtc?access_token=another-token","authorization":"Bearer "+token}});
 assert.equal((await gate.GET(mismatch)).status,403,"mismatched header/query tokens cannot smuggle a blocked identity");
 allowed=false;assert.equal((await gate.GET(handshake())).status,403,"same previously issued token rejected after node disable/kick");
 allowed=true;fail=true;assert.equal((await gate.GET(handshake())).status,503,"admission fails closed without changing existing RTP sessions");
 assert.equal((await gate.GET(new NextRequest("http://localhost/api/media-admission"))).status,401,"a platform cookie is not a media grant");
 console.log("PASS: node lifecycle/acknowledgement, session-bound mutation, block-before-kick, body HMAC and same-token admission denial");
})().catch(error=>{console.error(error);process.exitCode=1;});
