"use client";

import { MediaDevicePicker } from "@/components/MediaDevicePicker";
import { RemoteStudioDevices } from "@/components/RemoteStudioDevices";
import type { StudioDesired } from "@/lib/studio-control";
import type { Room } from "livekit-client";

export function StudioDeviceControlPanel({
  role,
  room,
  disabledInputs,
  cameraId,
  microphoneId,
  headphonesId,
  outputRequestKey,
  remoteActual,
  remoteDesired,
  remoteOnline,
  remoteDisabled,
  onDevicesChanged,
  onOutputStatus,
  onLocalChange,
  onRemoteChange,
}: {
  role: "primary" | "moderator" | "connecting";
  room: Room;
  disabledInputs: boolean;
  cameraId?: string;
  microphoneId?: string;
  headphonesId?: string;
  outputRequestKey: number;
  remoteActual: Record<string, unknown> | null;
  remoteDesired: StudioDesired;
  remoteOnline: boolean;
  remoteDisabled: boolean;
  onDevicesChanged: (devices: MediaDeviceInfo[]) => void;
  onOutputStatus: (deviceId: string, error: string) => void;
  onLocalChange: (change: { cameraId?: string; microphoneId?: string; headphonesId?: string }) => void;
  onRemoteChange: (patch: Partial<StudioDesired>) => void;
}) {
  return <div className="panel studio-device-panel">
    {role === "primary" ? <MediaDevicePicker
      room={room}
      disabledInputs={disabledInputs}
      cameraId={cameraId}
      microphoneId={microphoneId}
      headphonesId={headphonesId}
      outputRequestKey={outputRequestKey}
      onDevicesChanged={onDevicesChanged}
      onOutputStatus={onOutputStatus}
      onChange={onLocalChange}
    /> : <RemoteStudioDevices
      actual={remoteActual}
      desired={remoteDesired}
      online={remoteOnline}
      disabled={remoteDisabled}
      onChange={onRemoteChange}
    />}
  </div>;
}
