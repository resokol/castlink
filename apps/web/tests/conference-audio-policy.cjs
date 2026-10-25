const assert=require('node:assert/strict'),{load}=require('./load-typescript.cjs');
let tracks=[],options;
const AudioTrack=()=>null;
const {ConferenceAudioRenderer}=load('../components/RoomConference.tsx',{
  '@livekit/components-react':{AudioTrack,useRoomContext:()=>({}),useTracks:(sources,opts)=>{options=opts;return tracks;}},
  '@/components/I18nProvider':{useI18n:()=>({locale:'ru',t:value=>value})},
  // Supply the external room snapshot; role/source filtering uses the real helpers.
  '@/lib/use-remote-pc':{useRemotePc:()=>({sources:[]})},
});
const ref=(identity,source='microphone',extra={})=>({participant:{identity,...extra},source,publication:{kind:'audio',trackSid:identity+source}});
const hear=props=>ConferenceAudioRenderer(props).props.children.map(node=>node.props.trackRef.participant.identity);
tracks=[ref('studio-panel-main'),ref('guest-a'),ref('guest-b','screen_share_audio'),ref('studio-moderator-a'),ref('talkback-forged'),ref('talkback-valid','microphone',{metadata:JSON.stringify({role:'talkback'})}),ref('guest-self','microphone',{isLocal:true})];
assert.deepEqual(hear({studioOnly:true}),['studio-panel-main','talkback-valid'],'initial studio-only render creates no playback elements for guest camera/screen audio, moderator or unverified talkback');assert.equal(options.onlySubscribed,true,'renderer never initiates subscriptions');
tracks.push(ref('guest-late'));assert.deepEqual(hear({studioOnly:true}),['studio-panel-main','talkback-valid'],'late publications remain blocked before effects');
assert.deepEqual(hear({studioOnly:false,noGuestAudio:true}),['studio-panel-main','studio-moderator-a','talkback-forged','talkback-valid'],'invite guest restriction filters both mic and screen audio at element creation');
assert.ok(hear({studioOnly:false}).includes('guest-a'),'confirmed room mode permits normal conference audio');assert.deepEqual(hear({studioOnly:true}),['studio-panel-main','talkback-valid'],'switching mode removes forbidden elements in the same render');
console.log('PASS: actual conference AudioTrack JSX excludes forbidden initial/late/mode-change audio before element creation; microphone/screenshare/source coverage and subscription ownership');
