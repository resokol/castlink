'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {stagePreview,previewConfiguration}=require('../scripts/package-client-preview.cjs');
test('one combined preview package has isolated client identity, internal presenter and remote PC schemes and no private credentials',()=>{
 const root=path.resolve(__dirname,'../../..'),stage=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-preview-test-'));
 try{const info=stagePreview(root,stage,'a'.repeat(40)),config=previewConfiguration(path.join(root,'apps/desktop'),stage,'out',[]);
 assert.equal(info.presenterBuild,true);assert.equal(info.testBuild,false);assert.equal(info.serverSetup,false);assert.equal(info.updateChecks,false);
 assert.equal(info.powerPointBridge,4);assert.equal(info.browserControl,true);
 assert.equal(config.appId,'ru.castlink.client.preview');assert.equal(config.productName,'CastLink Client Preview');assert.deepEqual(config.protocols,[{name:'CastLink presentation component',schemes:['castlink-presenter']},{name:'CastLink remote PC component',schemes:['castlink-remote']}]);assert.equal(config.publish,null);assert.equal(config.nsis.allowElevation,false);assert.equal(config.nsis.perMachine,false);assert.equal(config.nsis.artifactName,'CastLink-Client-Preview-Setup.exe');
 for(const relative of ['src/main.cjs','src/presentation-helper.cjs','src/window-slides.cjs','src/window-slides-picker.cjs','ui/window-slides-picker.html'])assert.ok(fs.existsSync(path.join(stage,relative)),relative);
 assert.deepEqual(fs.readdirSync(stage).filter(n=>/auth|private|owner|launch|helper/i.test(n)),[],'no auth sidecar, owner file or separate helper launcher');
 }finally{fs.rmSync(stage,{recursive:true,force:true});}
});
