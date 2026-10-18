"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import { RoomEvent, type Room } from "livekit-client";
import { GuestDeviceRequestDialog } from "./GuestDeviceRequestDialog";
import { watchGuestDeviceRequests } from "@/lib/guest-device-control-client";
import { guestDeviceState, switchGuestMicrophoneDevice, switchGuestOutputDevice } from "@/lib/guest-device-switch";
import type { GuestDeviceRequest } from "@/lib/guest-device-control";
import type { GuestChoices } from "@/lib/guest-media";

export type GuestDeviceRequestsProps = {
  room: Room; token: string; studioId: string; roomName: string; identity: string;
  choicesRef: RefObject<GuestChoices | undefined>; mediaGeneration: RefObject<number>;
  disabled?: boolean; onChoices: (patch: Partial<GuestChoices>) => void; onError: (message: string) => void;
  onApplyingChange?: (busy: boolean) => void;
  onPromptChange?: (pending: boolean) => void;
  applyCamera: (deviceId: string, isCurrent: () => boolean) => Promise<"applied" | "saved">;
};
/** Owns authenticated inventory reporting, explicit consent, and prompt lifecycle. */
export function GuestDeviceRequests(props: GuestDeviceRequestsProps) {
  const latest = useRef(props); latest.current = props;
  const watcher = useRef<ReturnType<typeof watchGuestDeviceRequests> | undefined>(undefined);
  const [request, setRequest] = useState<GuestDeviceRequest>();
  const [applying, setApplying] = useState(false);
  useEffect(() => {
    setRequest(undefined); setApplying(false); latest.current.onPromptChange?.(false);
    if (!props.token || !props.identity) return;
    let active = true;
    const controller = watchGuestDeviceRequests(props.room, {
      studioId: props.studioId, roomName: props.roomName, identity: props.identity, token: props.token,
      state: async () => {
        const choices = latest.current.choicesRef.current;
        if (!choices) throw new Error("Настройки кастера ещё не готовы");
        return guestDeviceState(props.room, choices);
      },
      apply: async (command, currentRequest) => {
        const current = latest.current;
        if (current.disabled || !current.choicesRef.current) throw new Error("Настройки кастера сейчас заняты");
        const generation = current.mediaGeneration.current;
        const isCurrent = () => active && currentRequest() && latest.current.mediaGeneration.current === generation && !latest.current.disabled;
        const target = command.target;
        // Inventory check uses enumerateDevices only; it cannot open a new permission prompt.
        const state = await guestDeviceState(props.room, current.choicesRef.current);
        if (!isCurrent() || !state.devices.some(device => device.kind === target.kind && device.deviceId === target.deviceId)) throw new Error("Устройство недоступно в подтверждённом списке кастера");
        let outcome: "applied" | "saved";
        if (target.kind === "audioinput") outcome = await switchGuestMicrophoneDevice(props.room, () => latest.current.choicesRef.current!, target.deviceId, isCurrent);
        else if (target.kind === "videoinput") outcome = await latest.current.applyCamera(target.deviceId, isCurrent);
        else outcome = await switchGuestOutputDevice(props.room, target.deviceId, isCurrent);
        if (!isCurrent()) throw new Error("Запрос устройства уже устарел");
        const patch: Partial<GuestChoices> = target.kind === "audioinput" ? { audioDeviceId: target.deviceId } : target.kind === "videoinput" ? { videoDeviceId: target.deviceId } : { audioOutputId: target.deviceId };
        // Commit the ref synchronously so the authenticated ACK sees this exact choice.
        const previous = latest.current.choicesRef.current;
        if (!previous) throw new Error("Настройки кастера ещё не готовы");
        latest.current.choicesRef.current = { ...previous, ...patch };
        latest.current.onChoices(patch);
        return outcome;
      },
      onRequest: (next, busy) => { if (active) { setRequest(next); setApplying(busy); latest.current.onApplyingChange?.(busy); latest.current.onPromptChange?.(!!next); } },
      onError: message => { if (active) latest.current.onError(message); },
    });
    watcher.current = controller;
    const report = () => controller.report();
    navigator.mediaDevices?.addEventListener("devicechange", report);
    props.room.on(RoomEvent.TrackMuted, report).on(RoomEvent.TrackUnmuted, report).on(RoomEvent.LocalTrackPublished, report).on(RoomEvent.LocalTrackUnpublished, report).on(RoomEvent.ActiveDeviceChanged, report);
    return () => {
      active = false; controller.stop(); if (watcher.current === controller) watcher.current = undefined;
      latest.current.onApplyingChange?.(false); latest.current.onPromptChange?.(false);
      navigator.mediaDevices?.removeEventListener("devicechange", report);
      props.room.off(RoomEvent.TrackMuted, report).off(RoomEvent.TrackUnmuted, report).off(RoomEvent.LocalTrackPublished, report).off(RoomEvent.LocalTrackUnpublished, report).off(RoomEvent.ActiveDeviceChanged, report);
    };
  }, [props.room, props.token, props.studioId, props.roomName, props.identity]);
  return request ? <GuestDeviceRequestDialog request={request} applying={applying} disabled={props.disabled} onRespond={accepted => { void watcher.current?.respond(accepted); }} /> : null;
}
