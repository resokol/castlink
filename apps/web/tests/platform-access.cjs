const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path"),ts=require("typescript"),crypto=require("node:crypto");
function load(file,imports) {
 const module={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,file),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:name=>{if (name in imports) return imports[name]; if(name==="node:crypto") return crypto; throw Error("Unexpected import: "+name);},Date,Buffer,console});
 return module.exports;
}
let version="epoch-v2",queries=0;
const records=new Map();
const pool={connect:async()=>({...pool,release(){}}),async query(sql,args=[]) {
 queries++;
 if (["BEGIN","COMMIT","ROLLBACK"].includes(sql)) return {rows:[],rowCount:0};
 if(sql.includes("SELECT access_version")) return {rows:[{access_version:version}],rowCount:1};
 if(sql.includes("INSERT INTO")) {
  const invite=sql.includes("'invite'");
  records.set(args[0],{kind:invite?"invite":"session",principal_id:args[1],version:args[invite?3:2],expires_at:new Date(args[invite?4:3]),consumed:false});
  return {rows:[],rowCount:1};
 }
 const row=records.get(args[0]);
 if(sql.startsWith("UPDATE") && sql.includes("kind='invite'")) {
  if(!row||row.kind!=="invite"||row.consumed||row.expires_at<=new Date()||row.version!==args[1]) return {rows:[],rowCount:0};
  row.consumed=true; return {rows:[{principal_id:row.principal_id}],rowCount:1};
 }
 if(sql.startsWith("UPDATE")) { if(row) row.consumed=true; return {rows:[],rowCount:row?1:0}; }
 if(sql.includes("SELECT c.principal_id")) return {rows:row&&row.kind==="session"&&!row.consumed&&row.version===version&&row.expires_at>new Date()?[row]:[]};
 throw Error("Unhandled SQL");
}};
const credentials=load("../lib/platform-credentials.ts",{"./control-plane-store":{controlPlanePool:()=>pool,superAdminAccessVersion:async()=>version}});
const access=load("../lib/super-admin-access.ts",{"./control-plane-store":{rotateSuperAdminAccessVersion:async()=>{version="revoked";}},"./platform-credentials":credentials});
class NextResponse extends Response { static json(body,init) { const response=new NextResponse(JSON.stringify(body),init); response.cookies={set(){},delete(){}}; return response; } }
const route=load("../app/api/super-admin-access/route.ts",{"next/server":{NextResponse},"../../../lib/access":{isStudio:()=>true,sameOrigin:()=>true},"../../../lib/super-admin-access":access,"../../../lib/server-log":{requestId:()=>"qa",requestHeaders:(_,extra)=>extra,serverLog(){}},"../../../lib/rate-limit":{consumeRateLimit:()=>({ok:true}),rateLimitHeaders:()=>({})}});
const platformRoutes=["studios","servers"].map(name=>load(`../app/api/${name}/route.ts`,{
 "next/server":{NextResponse},"../../../lib/access":{isStudio:()=>true,sameOrigin:()=>true},
 "../../../lib/super-admin-access":access,
 "../../../lib/control-plane-store":{listAllStudios:async()=>[],listControlNodes:async()=>[],createStudio:async()=>({studioId:"test-studio"})},
 "../../../lib/server-registry-client":{listRegisteredServers:async()=>[]},
 "../../../lib/server-log":{requestId:()=>"qa",requestHeaders:(_,extra)=>extra,serverLog(){}},
}));
const request=(role,body={},token)=>({headers:new Headers({origin:"https://castlink.test"}),nextUrl:new URL("https://castlink.test/api/super-admin-access"),cookies:{get:key=>key==="castlink-super-admin-v2"&&token?{value:token}:key.includes(role)?{value:"ordinary-role-cookie"}:undefined},text:async()=>JSON.stringify(body)});
(async()=>{
 for(const role of ["studio","studio-owner","admin","moderator","guest","castlink-super-admin"]) {
  assert.equal(await access.isSuperAdmin(request(role)),false,role+" is not platform access");
  assert.equal((await route.POST(request(role,{action:"bootstrap"}))).status,403,"no browser role can bootstrap");
  assert.equal((await route.POST(request(role,{action:"create-invite"}))).status,403);
  for(const api of platformRoutes) { assert.equal((await api.GET(request(role))).status,403); assert.equal((await api.POST(request(role,{action:"create",name:"test"}))).status,403); }
 }
 const before=queries;
 assert.equal(await credentials.readPlatformSession("legacy-signed-token"),null); assert.equal(queries,before,"legacy credentials never reach the database");
 const invite=await credentials.issuePlatformInvite(crypto.randomUUID());
 assert.equal(await credentials.readPlatformSession(invite.invite),null,"invite is not a session");
 const results=await Promise.all([credentials.redeemPlatformInvite(invite.invite),credentials.redeemPlatformInvite(invite.invite)]);
 assert.equal(results.filter(Boolean).length,1,"exactly one redemption succeeds");
 const session=results.find(Boolean);
 assert.equal(await access.isSuperAdmin(request("",{},session.token)),true);
 for(const api of platformRoutes) assert.equal((await api.GET(request("",{},session.token))).status,200,"a dedicated platform session can read management data");
 await credentials.revokePlatformSession(session.token); assert.equal(await credentials.readPlatformSession(session.token),null,"logout revokes the opaque token");
 const invite2=await credentials.issuePlatformInvite(crypto.randomUUID());
 const session2=await credentials.redeemPlatformInvite(invite2.invite);
 await access.revokeSuperAdminAccess();
 assert.equal(await credentials.readPlatformSession(session2.token),null,"global revoke invalidates active sessions");
 assert.ok(!JSON.stringify([...records]).includes(invite.invite),"only token hashes are persisted");
 console.log("PASS: creator-only bootstrap boundary, rejected tenant roles, legacy invalidation, one-use invitations, logout and global revocation");
})().catch(error=>{console.error(error);process.exitCode=1;});
