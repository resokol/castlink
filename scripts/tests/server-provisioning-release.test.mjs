import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {makeProvisioning} from '../server-provisioning.mjs';
test('old public releases and checksum/commit mismatches refuse before SSH or VPS preparation',async()=>{
 const original=globalThis.fetch;let sshCalls=0;
 const p=makeProvisioning({openVerifiedSsh:async()=>{sshCalls++;throw Error('Must not connect');},executeFixedSsh:async()=>{},requestServerPeer:async()=>{}});
 process.env.STUDIOLINK_INSTALLATION_ID=randomUUID();process.env.STUDIOLINK_TRANSFER_ORIGIN='https://primary.example.com';
 const commit='a'.repeat(40),manifest=JSON.stringify({schemaVersion:1,commit,capabilities:['peer-profile-v1','root-ssh-v1']})+'\n';
 const hash=createHash('sha256').update(manifest).digest('hex');let variant='missing';
 globalThis.fetch=async url=>{
  if(url.endsWith('/latest'))return new Response(JSON.stringify({tag_name:'easy-setup-'+commit.slice(0,12)}));
  if(url.endsWith('SHA256SUMS'))return new Response('b'.repeat(64)+'  CastLink-Linux.tar.gz\n'+(variant==='missing'?'':(variant==='bad-hash'?'c'.repeat(64):variant==='bad-commit'?createHash('sha256').update(manifest.replace(commit,'d'.repeat(40))).digest('hex'):hash)+'  CastLink-Provisioning.json\n'));
  return new Response(variant==='bad-commit'?manifest.replace(commit,'d'.repeat(40)):manifest);
 };
 try{
  for(variant of ['missing','bad-hash','bad-commit']){
   await assert.rejects(p.provisionServer({host:'8.8.8.8',port:22,fingerprint:'SHA256:'+'A'.repeat(43),password:'memory-only',mode:'deploy',label:'Reserve'},{scope:{kind:'room',roomId:randomUUID()},assertAuthorized:async()=>{}}),/публичный выпуск/);
   assert.equal(sshCalls,0);
  }
  variant='valid';const release=await p.currentProvisioningRelease();assert.equal(release.releaseCommit,commit);assert.equal(release.releaseSha256,'b'.repeat(64));
 }finally{globalThis.fetch=original;}
});
