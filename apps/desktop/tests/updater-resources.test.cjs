'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const modulePath=path.join(__dirname,'../scripts/updater-resources.cjs');
test('client installer includes exact BOM-preserving bootstrap bytes without downloading or touching products',()=>{
 assert.ok(fs.existsSync(modulePath),'updater bootstrap resource staging required');
 const {stageUpdaterResources}=require(modulePath),root=fs.mkdtempSync(path.join(os.tmpdir(),'client-updater-resource-'));
 try{
  const source=path.join(root,'scripts/updater/castlink-updater.ps1');fs.mkdirSync(path.dirname(source),{recursive:true});const bytes=Buffer.from('\ufeff# 更新 Обновление\r\n');fs.writeFileSync(source,bytes);
  const result=stageUpdaterResources(root,path.join(root,'resources'));
  assert.deepEqual(fs.readFileSync(result.file),bytes);assert.equal(result.sha256,crypto.createHash('sha256').update(bytes).digest('hex'));assert.equal(path.basename(result.file),'castlink-updater.ps1');
  assert.throws(()=>stageUpdaterResources(root,path.join(root,'resources')),/exist/i);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('client installer refuses unsafe or unparseable resource encoding',()=>{
 assert.ok(fs.existsSync(modulePath),'updater bootstrap resource staging required');
 const {stageUpdaterResources}=require(modulePath),root=fs.mkdtempSync(path.join(os.tmpdir(),'client-updater-resource-'));
 try{
  const source=path.join(root,'scripts/updater/castlink-updater.ps1');fs.mkdirSync(path.dirname(source),{recursive:true});fs.writeFileSync(source,'# no UTF8 BOM');
  assert.throws(()=>stageUpdaterResources(root,path.join(root,'resources')),/BOM/i);
  fs.unlinkSync(source);fs.writeFileSync(path.join(root,'other'),'\ufeff#text');fs.symlinkSync(path.join(root,'other'),source);
  assert.throws(()=>stageUpdaterResources(root,path.join(root,'resources')),/file/i);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
