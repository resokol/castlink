const assert = require('node:assert/strict');
const {EventEmitter}=require('node:events');
const fs=require('node:fs'),ts=require('typescript'),Module=require('node:module');
Module._extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {RoomEvent,Track}=require('livekit-client');
const {bindPrivateTalkbackAudio}=require('../lib/private-talkback-audio.ts');
const room=new EventEmitter();room.remoteParticipants=new Map();let started=0;room.startAudio=async()=>{started++;};
const outputRoom=new EventEmitter(),outputs=[];room.switchActiveDevice=async(kind,id)=>outputs.push([kind,id]);
const attached=new Set();global.document={body:{appendChild:el=>attached.add(el)}};
function audio(){const elements=[];return Object.assign(new EventEmitter(),{kind:Track.Kind.Audio,elements,setVolume(value){this.volume=value;},attach(){const el={remove:()=>attached.delete(el)};elements.push(el);return el;},detach(el){elements.splice(elements.indexOf(el),1);}});}
(async()=>{
 const track=audio();room.remoteParticipants.set('guest',{trackPublications:new Map([['one',{track}]])});
 const dispose=bindPrivateTalkbackAudio(room,outputRoom,()=>0);assert.equal(attached.size,1,'already present private reply is attached locally');
 assert.equal(track.volume,0,'guest listening mute also applies to private audio');
 outputRoom.emit(RoomEvent.ActiveDeviceChanged,'audiooutput','new-headphones');
 assert.deepEqual(outputs,[['audiooutput','new-headphones']],'private conversation follows the selected listening device');
 room.emit(RoomEvent.TrackSubscribed,track);assert.equal(attached.size,1,'track is never attached twice');
 const camera={kind:Track.Kind.Video,attach(){throw Error('private channel must never attach video');}};room.emit(RoomEvent.TrackSubscribed,camera);
 room.emit(RoomEvent.TrackUnsubscribed,track);assert.equal(attached.size,0,'unpublished private audio element removed');
 const replacement=audio();room.emit(RoomEvent.TrackSubscribed,replacement);assert.equal(attached.size,1);
 dispose();assert.equal(attached.size,0,'cleanup removes every private playback element');assert.equal(room.listenerCount(RoomEvent.TrackSubscribed),0);
 assert.equal(outputRoom.listenerCount(RoomEvent.ActiveDeviceChanged),0);
 assert.ok(started>=1);console.log('PRIVATE_TALKBACK_AUDIO_PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
