const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const file=require('node:path').resolve(__dirname,'../lib/guest-session-settings.ts');assert.ok(fs.existsSync(file),'guest settings retention is not implemented');
const mod={exports:{}};let now=1000;vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:mod.exports,module:mod,Date:{now:()=>now},Map,Symbol,globalThis:{},structuredClone});const store=mod.exports;
const room={name:'one',creatorAccessId:'creator-one'},metadata={studioImageTransform:{rotation:90,exposure:.75,contrast:1.3},videoRotation:180,videoMaxBitrateKbps:1800,videoHeight:720,cameraCapture:{mode:'custom',resolution:'3840x2160',frameRate:'60'},role:'guest',studioId:'tenant-one'},media={audioProfile:'raw',connectionRoute:'normal',videoCodec:'av1',micGain:75,listenGain:25};
store.rememberGuestSessionSettings('tenant-one',room,'guest-one',metadata,media);
assert.deepEqual(JSON.parse(JSON.stringify(store.readGuestSessionSettings('tenant-one',room,'guest-one'))),{metadata:{studioImageTransform:{rotation:90,exposure:.75,contrast:1.3},videoRotation:180,videoMaxBitrateKbps:1800,videoHeight:720,cameraCapture:metadata.cameraCapture},media});
const altered=store.readGuestSessionSettings('tenant-one',room,'guest-one');altered.metadata.studioImageTransform.exposure=-2;altered.metadata.studioImageTransform.contrast=0;
assert.equal(store.readGuestSessionSettings('tenant-one',room,'guest-one').metadata.studioImageTransform.exposure,.75,'retained correction is isolated from client snapshot mutation');
assert.equal(store.readGuestSessionSettings('tenant-one',room,'guest-one').metadata.studioImageTransform.contrast,1.3);
assert.equal(store.readGuestSessionSettings('tenant-two',room,'guest-one'),undefined);assert.equal(store.readGuestSessionSettings('tenant-one',{...room,creatorAccessId:'recreated'},'guest-one'),undefined);
now+=60_000;store.markGuestSessionDisconnected('tenant-one',room,'guest-one');const disconnected=now;
for(let i=0;i<14;i++){now+=60_000;assert.ok(store.readGuestSessionSettings('tenant-one',room,'guest-one'));store.markGuestSessionDisconnected('tenant-one',room,'guest-one');}
now=disconnected+15*60_000;assert.equal(store.readGuestSessionSettings('tenant-one',room,'guest-one'),undefined,'offline polls must not extend the 15 minute retention');
store.rememberGuestSessionSettings('tenant-one',room,'guest-one',metadata,media);now+=14*60_000;store.rememberGuestSessionSettings('tenant-one',room,'guest-one',metadata);now+=14*60_000;assert.ok(store.readGuestSessionSettings('tenant-one',room,'guest-one'),'live observation retains confirmed media settings');
console.log('PASS: guest metadata/media snapshots scoped by tenant immutable room and identity expire 15min after disconnect without read refresh');
