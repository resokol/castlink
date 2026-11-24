import { ConnectionState, Track, type TrackPublication } from "livekit-client";
import { useI18n } from "@/components/I18nProvider";

/** RoomConference's useTracks refreshes on TrackStreamStateChanged, mute, subscription and connection changes. */
export function MonitorVideoPauseBadge({ connection, publication }: {
  connection: ConnectionState;
  publication?: TrackPublication;
}) {
  const { t } = useI18n();
  if (connection !== ConnectionState.Connected || !publication || publication.isLocal ||
      publication.kind !== Track.Kind.Video || publication.isMuted || !publication.isSubscribed ||
      !publication.isEnabled || publication.track?.streamState !== Track.StreamState.Paused) return null;

  return <span className="monitor-video-pause" role="status">{t("Видео на паузе из-за перегрузки сети")}</span>;
}
