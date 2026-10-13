const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-hosted-'));
process.env.CASTLINK_HOSTED_ACCESS='1';process.env.CASTLINK_SESSION_SECRET='isolated-hosted-test-secret';process.env.CASTLINK_HOSTED_TOKEN_FILE=path.join(dir,'tokens.json');
const location=path.resolve(__dirname,'../lib/hosted-access.ts');
assert.ok(fs.existsSync(location),'Hosted access verifier must be implemented');
const gate=require(location),token='clt_'+crypto.randomBytes(32).toString('base64url');
const record={id:crypto.randomBytes(16).toString('hex'),tokenHash:crypto.createHash('sha256').update(token).digest('hex'),expiresAt:Date.now()+86400000};
const write=(tokens=[record])=>fs.writeFileSync(process.env.CASTLINK_HOSTED_TOKEN_FILE,JSON.stringify({schemaVersion:1,tokens}));
const req=value=>({cookies:{get:name=>name===gate.hostedCookieName&&value?{value}:undefined}});
try {
 assert.equal(gate.hasHostedAccess(req()),false);assert.equal(gate.verifyHostedToken(token),null);
 write();assert.equal(gate.verifyHostedToken(token).id,record.id);assert.equal(gate.verifyHostedToken(token).id,record.id,'token reusable');
 const cookie=gate.signHostedSession(record);assert.equal(gate.hasHostedAccess(req(cookie)),true);assert.equal(gate.hasHostedAccess(req(cookie+'x')),false);
 const {NextRequest}=require('next/server');
 const access=require('../lib/access.ts');
 process.env.STUDIOLINK_STUDIO_PASSWORD_HASH=access.hashPassword('isolated-password');
 const owner=access.signAccess({kind:'studio',version:access.roomVersion(process.env.STUDIOLINK_STUDIO_PASSWORD_HASH)});
 const ownReq=(extra='')=>new NextRequest('https://example.test/studio',{headers:{cookie:'studiolink-studio='+owner+extra}});
 assert.equal(access.isStudio(ownReq()),false,'legacy owner cannot bypass hosted token');
 assert.equal(access.isStudio(ownReq('; '+gate.hostedCookieName+'='+cookie)),true);
 delete require.cache[location];assert.equal(require(location).hasHostedAccess(req(cookie)),true,'restart preserves authorization');
 write([{...record,revokedAt:Date.now()}]);assert.equal(gate.hasHostedAccess(req(cookie)),false,'revocation live');assert.equal(gate.verifyHostedToken(token),null);
 write([{...record,expiresAt:Date.now()-1}]);assert.equal(gate.hasHostedAccess(req(cookie)),false,'expiry live');
 for(const data of ['broken','{}',JSON.stringify({schemaVersion:1,tokens:[record,record]}),' '.repeat(524289)]) {fs.writeFileSync(process.env.CASTLINK_HOSTED_TOKEN_FILE,data);assert.equal(gate.hasHostedAccess(req(cookie)),false,'bad registry closes gate');}
 fs.unlinkSync(process.env.CASTLINK_HOSTED_TOKEN_FILE);assert.equal(gate.hasHostedAccess(req(cookie)),false);
 process.env.CASTLINK_HOSTED_ACCESS='0';assert.equal(gate.hasHostedAccess(req()),true,'self-hosted default unchanged');
 console.log('PASS: hosted reusable tokens, signed sessions, live expiry/revoke, restart and fail-closed registry');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
