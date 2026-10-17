import { RoomEvent, Track, type AudioProcessorOptions, type LocalAudioTrack, type Room, type TrackProcessor } from "livekit-client";
import { enqueueGuestMicrophoneTask } from "./guest-audio";

/** Changes the transmitted microphone signal without sending it to local speakers. */
export class GuestMicrophoneGain implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
  readonly name = "castlink-guest-microphone-gain";
  processedTrack?: MediaStreamTrack;
  private context?: AudioContext;
  private source?: MediaStreamAudioSourceNode;
  private gain?: GainNode;
  private destination?: MediaStreamAudioDestinationNode;
  constructor(private percent: number) {}
  setGain(percent: number) {
    this.percent = percent;
    if (this.gain && this.context) this.gain.gain.setValueAtTime(percent / 100, this.context.currentTime);
  }
  async init(options: AudioProcessorOptions) {
    this.context = options.audioContext || this.context;
    if (!this.context || this.context.state === "closed") throw new Error("Усиление микрофона недоступно в этом браузере");
    try {
      this.source = this.context.createMediaStreamSource(new MediaStream([options.track]));
      this.gain = this.context.createGain();
      this.destination = this.context.createMediaStreamDestination();
      this.processedTrack = this.destination.stream.getAudioTracks()[0];
      this.setGain(this.percent);
      this.source.connect(this.gain); this.gain.connect(this.destination);
      // The shared SDK context owns resume/close. Never connect to its speakers.
    } catch (cause) { await this.destroy(); throw cause; }
  }
  async restart(options: AudioProcessorOptions) { await this.destroy(); await this.init(options); }
  async destroy() {
    this.source?.disconnect(); this.gain?.disconnect(); this.destination?.disconnect();
    this.processedTrack?.stop(); this.processedTrack = undefined;
    this.source = undefined; this.gain = undefined; this.destination = undefined;
  }
}

export function setGuestMicrophoneGain(room: Room, percent: number, isCurrent: () => boolean = () => true): Promise<boolean> {
  return enqueueGuestMicrophoneTask(room, async () => {
    if (!Number.isFinite(percent) || percent < 0 || percent > 200) throw new Error("Недопустимое усиление микрофона");
    if (!isCurrent() || room.state !== "connected") return false;
    const track = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track as LocalAudioTrack | undefined;
    if (!track) return true; // Keep an absent/disabled microphone absent.
    const processor = track.getProcessor?.();
    if (processor instanceof GuestMicrophoneGain) processor.setGain(percent);
    else if (percent !== 100) {
      if (processor) throw new Error("Микрофон уже использует другую обработку звука");
      const next = new GuestMicrophoneGain(percent);
      try { await track.setProcessor(next); }
      catch (cause) { await next.destroy(); throw cause; }
    }
    return isCurrent() && room.state === "connected" && room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track === track;
  });
}

/** SDK processors restart with capture; new publications need the saved gain too. */
export function watchGuestMicrophoneGain(room: Room, gain: () => number, onError: (message: string) => void) {
  let active = true;
  const apply = () => { void setGuestMicrophoneGain(room, gain(), () => active).catch(cause => { if (active) onError(cause instanceof Error ? cause.message : "Не удалось изменить усиление микрофона"); }); };
  const published = (publication: { source?: Track.Source; track?: { source?: Track.Source } }) => { if ((publication.source || publication.track?.source) === Track.Source.Microphone) apply(); };
  room.on(RoomEvent.LocalTrackPublished, published).on(RoomEvent.Connected, apply).on(RoomEvent.Reconnected, apply);
  apply();
  return () => { active = false; room.off(RoomEvent.LocalTrackPublished, published).off(RoomEvent.Connected, apply).off(RoomEvent.Reconnected, apply); };
}
