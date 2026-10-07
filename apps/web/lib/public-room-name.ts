/** Default studio uses literal LiveKit names; internal tenant/watch namespaces are reserved. */
export function validPublicRoomName(value: string) {
  return !!value.trim() && value.trim().length <= 100 && !/^(?:s-|castlink-view-)/i.test(value.trim()) && !/[\u0000-\u001f\u007f]/.test(value);
}
