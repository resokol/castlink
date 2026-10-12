"use client";
import { useTrackToggle, useLocalParticipant } from "@livekit/components-react";
import { Track } from "livekit-client";

export function GuestCameraButton({ onError, disabled = false }: { onError: (message: string) => void; disabled?: boolean }) {
  const { isCameraEnabled } = useLocalParticipant();
  const { buttonProps, pending } = useTrackToggle({ source: Track.Source.Camera,
    onDeviceError: () => onError("Не удалось включить камеру. Проверьте выбранное устройство и разрешение браузера."),
    onChange: (_enabled, userInitiated) => { if (userInitiated) onError(""); },
  });
  // The SDK's TrackToggle overwrites caller disabled with pending. Apply our
  // transition guard after its button props while retaining the SDK toggle.
  return <button {...buttonProps} type="button" disabled={disabled || pending}
    aria-label={isCameraEnabled ? "Выключить камеру" : "Включить камеру"}>
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h11v12H4zM15 10l5-3v10l-5-3" fill="none" stroke="currentColor" strokeWidth="2" />{!isCameraEnabled && <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" />}</svg>
    <span>{isCameraEnabled ? "Камера" : "Камера выключена"}</span>
  </button>;
}
