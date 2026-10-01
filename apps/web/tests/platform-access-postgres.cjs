const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),crypto=require("node:crypto"),{spawnSync}=require("node:child_process"),ts=require("typescript");
const value=process.env.TEST_DATABASE_URL;
if(!value) throw Error("TEST_DATABASE_URL is required; this is an integration test, not a production command");
const url=new URL(value);
if(!["127.0.0.1","localhost"].includes(url.hostname)||url.pathname!=="/castlink_test") throw Error("Refusing anything except the explicit local castlink_test database");
process.env.CASTLINK_CONTROL_PLANE_DATABASE_URL=value;
require.extensions[".ts"]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const {controlPlanePool,closeControlPlanePool,rotateSuperAdminAccessVersion}=require("../lib/control-plane-store.ts");
const {issuePlatformInvite,redeemPlatformInvite,readPlatformSession,revokePlatformSession,platformTokenHash}=require("../lib/platform-credentials.ts");
const repo=path.resolve(__dirname,"../../.."),temp=fs.mkdtempSync(path.join(os.tmpdir(),"castlink-platform-test-"));
const principalIds=[];
(async()=>{
 const pool=controlPlanePool();
 for(const name of fs.readdirSync(path.join(repo,"infrastructure/control-plane")).filter(n=>/^\d+.*\.sql$/.test(n)).sort()) await pool.query(fs.readFileSync(path.join(repo,"infrastructure/control-plane",name),"utf8"));
 const creator=crypto.randomUUID();
 const invitation=await issuePlatformInvite(creator);
 const results=await Promise.all(Array.from({length:5},()=>redeemPlatformInvite(invitation.invite)));
 assert.equal(results.filter(Boolean).length,1,"PostgreSQL allows only one concurrent redemption");
 const session=results.find(Boolean);principalIds.push(session.principalId);
 assert.ok(await readPlatformSession(session.token));
 assert.equal(await readPlatformSession(invitation.invite),null);
 assert.equal(await redeemPlatformInvite(invitation.invite),null);
 await revokePlatformSession(session.token);assert.equal(await readPlatformSession(session.token),null);
 const expiring=await issuePlatformInvite(creator);
 const expired=await pool.query("UPDATE castlink_control.platform_credentials SET expires_at=now()-interval '1 second' WHERE token_hash=$1 RETURNING principal_id",[platformTokenHash(expiring.invite)]);
 principalIds.push(expired.rows[0].principal_id);
 assert.equal(await redeemPlatformInvite(expiring.invite),null,"expired invitation cannot log in");
 const file=path.join(temp,"owner.txt");
 const cli=spawnSync(process.execPath,["scripts/super-admin-owner.mjs","--origin","https://qa.invalid","--output",file],{cwd:repo,env:process.env,encoding:"utf8",timeout:15000});
 assert.equal(cli.status,0,cli.stderr);assert.ok(!/csa2\./.test(cli.stdout+cli.stderr),"CLI must not print access tokens");
 const ownerToken=new URLSearchParams(new URL(fs.readFileSync(file,"utf8").trim()).hash.slice(1)).get("access");
 const ownerSession=await redeemPlatformInvite(ownerToken);assert.ok(ownerSession);principalIds.push(ownerSession.principalId);
 if(process.platform!=="win32") assert.equal(fs.statSync(file).mode&0o777,0o600,"owner link file is private");
 await rotateSuperAdminAccessVersion();assert.equal(await readPlatformSession(ownerSession.token),null,"epoch rotation revokes active sessions");
 const rows=await pool.query("SELECT token_hash FROM castlink_control.platform_credentials WHERE principal_id=ANY($1::uuid[])",[principalIds]);
 assert.ok(rows.rows.every(row=>/^[a-f0-9]{64}$/.test(row.token_hash)));
 console.log("PASS: migration 004, actual PostgreSQL concurrent one-use redemption, expiry, logout, global revoke, and private owner CLI output");
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
 try { if(principalIds.length) await controlPlanePool().query("DELETE FROM castlink_control.platform_credentials WHERE principal_id=ANY($1::uuid[])",[principalIds]); }
 finally {await closeControlPlanePool();fs.rmSync(temp,{recursive:true,force:true});}
});
