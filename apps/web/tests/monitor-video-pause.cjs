const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createRequire } = require('node:module');
const { readFileSync } = require('node:fs');
const { load } = require('./load-typescript.cjs');
const { Track, ConnectionState, RoomEvent } = require('livekit-client');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const componentsRequire = createRequire(require.resolve('@livekit/components-react'));
const { trackReferencesObservable } = componentsRequire('@livekit/components-core');
const { MonitorVideoPauseBadge } = load('../components/MonitorVideoPauseBadge.tsx', {
  '@/components/I18nProvider': { useI18n: () => ({ t: text => text }) },
});

const monitorPage = readFileSync(require.resolve('../app/monitor/page.tsx'), 'utf8');
assert.match(monitorPage, /new Room\(\{[^}]*singlePeerConnection:\s*false/,
  'LiveKit 1.13.11 only signals pauses on the dedicated subscriber transport');
assert.match(monitorPage, /room\.connect\(getLiveKitUrl\(\),\s*token,\s*\{[^}]*subscriberAllowPause:\s*true/,
  'the monitor opts in to congestion pauses on its connection');

function publication(kind, source) {
  return { kind, source, isLocal: false, isMuted: false, isEnabled: true, isSubscribed: true,
    track: { streamState: Track.StreamState.Active } };
}
const camera = publication(Track.Kind.Video, Track.Source.Camera);
const screen = publication(Track.Kind.Video, Track.Source.ScreenShare);
const mic = publication(Track.Kind.Audio, Track.Source.Microphone);
const publisher = { trackPublications: new Map([['cam',camera],['screen',screen],['mic',mic]]) };
const room = Object.assign(new EventEmitter(), {
  state: ConnectionState.Connected, localParticipant: { trackPublications: new Map() },
  remoteParticipants: new Map([['guest-one',publisher]]),
});
// This is the installed observable used by RoomConference's useTracks hook.
let badges;
const subscription = trackReferencesObservable(room, Object.values(Track.Source), { onlySubscribed: false })
  .subscribe(({trackReferences}) => {
    badges = trackReferences.filter(({publication}) => renderToStaticMarkup(
      React.createElement(MonitorVideoPauseBadge, { connection: room.state, publication })
    )).map(({source}) => source);
  });
function streamState(pub, state) {
  pub.track.streamState = state;
  room.emit(RoomEvent.TrackStreamStateChanged, pub, state, publisher);
}
assert.deepEqual(badges, []);
streamState(screen, Track.StreamState.Paused);
assert.deepEqual(badges, [Track.Source.ScreenShare], 'only the affected video tile reports the network pause');
streamState(mic, Track.StreamState.Paused);
assert.deepEqual(badges, [Track.Source.ScreenShare], 'a microphone cannot show a video pause');
screen.isMuted = true;
room.emit(RoomEvent.TrackMuted, screen, publisher);
assert.deepEqual(badges, [], 'publisher mute takes precedence');
screen.isMuted = false;
room.emit(RoomEvent.TrackUnmuted, screen, publisher);
assert.deepEqual(badges, [Track.Source.ScreenShare]);
room.state = ConnectionState.Reconnecting;
room.emit(RoomEvent.ConnectionStateChanged, room.state);
assert.deepEqual(badges, []);
room.state = ConnectionState.Connected;
room.emit(RoomEvent.ConnectionStateChanged, room.state);
assert.deepEqual(badges, [Track.Source.ScreenShare], 'resumed connections reflect current track state');
streamState(screen, Track.StreamState.Active);
assert.deepEqual(badges, [], 'recovery clears the screen badge');
streamState(camera, Track.StreamState.Paused);
camera.isSubscribed = false;
room.emit(RoomEvent.TrackSubscriptionStatusChanged, camera);
assert.deepEqual(badges, [], 'a locally unsubscribed camera is not a network pause');
publisher.trackPublications.set('cam', publication(Track.Kind.Video, Track.Source.Camera));
room.emit(RoomEvent.TrackPublished, publisher.trackPublications.get('cam'), publisher);
assert.deepEqual(badges, [], 'a new publication never inherits the previous track state');
streamState(screen, Track.StreamState.Paused);
room.remoteParticipants.clear();
room.emit(RoomEvent.ParticipantDisconnected, publisher);
assert.deepEqual(badges, []);
subscription.unsubscribe();
assert.equal(room.listenerCount(RoomEvent.TrackStreamStateChanged), 0);
console.log('PASS monitor pause badge follows installed SDK track observer across pause, resume, mute, reconnect and publication replacement');
