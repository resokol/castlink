import{test}from'node:test';import assert from'node:assert/strict';import{validateReleaseManifest}from'../dist/bundle.js';
const digest='a'.repeat(64);
const manifest=()=>({schemaVersion:1,release:'1.0.0-rc.2',nodeVersion:'22.21.0',architectures:['amd64','arm64'],images:Object.fromEntries(['web','postgres','livekit','caddy'].map(name=>[name,{reference:`example.org/castlink/${name}@sha256:${digest}`,architectures:['amd64','arm64']}]))});
test('accepts a pinned release for the requested architecture without claiming remote verification',()=>{
 const input=manifest();const result=validateReleaseManifest(input,'1.0.0-rc.2','arm64');assert.deepEqual(result,input);assert.notEqual(result,input);
});
test('rejects mutable images and missing digest before any container operation',()=>{
 for(const reference of ['example.org/web:latest','example.org/web:1.0.0','example.org/web@sha256:123']){const m=manifest();m.images.web.reference=reference;assert.throws(()=>validateReleaseManifest(m,'1.0.0-rc.2','amd64'),/digest/i);}
});
test('every required server image must exist',()=>{for(const name of ['web','postgres','livekit','caddy']){const m=manifest();delete m.images[name];assert.throws(()=>validateReleaseManifest(m,'1.0.0-rc.2','amd64'),/image/i);}});
test('rejects release mismatch and unsupported bundled Node runtime',()=>{
 const m=manifest();assert.throws(()=>validateReleaseManifest(m,'1.0.1','amd64'),/release/i);
 for(const version of ['24.0.0','22','latest'])assert.throws(()=>validateReleaseManifest({...m,nodeVersion:version},m.release,'amd64'),/Node/i);
});
test('required architecture must be present in release and every image',()=>{
 const m=manifest();assert.throws(()=>validateReleaseManifest({...m,architectures:['amd64']},m.release,'arm64'),/architecture/i);
 m.images.livekit.architectures=['amd64'];assert.throws(()=>validateReleaseManifest(m,m.release,'arm64'),/architecture/i);
});
test('unexpected nested fields cannot transport credentials or deployment commands',()=>{
 for(const m of [{...manifest(),token:'private-fixture'},{...manifest(),images:{...manifest().images,extra:{reference:'x'}}}])assert.throws(()=>validateReleaseManifest(m,'1.0.0-rc.2','amd64'),/schema|field|image/i);
 const m=manifest();m.images.web.password='private-fixture';assert.throws(()=>validateReleaseManifest(m,m.release,'amd64'),/schema|field/i);
});
