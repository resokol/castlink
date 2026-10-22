import type { CoPresentation } from './co-presentation-state';
import { slideControlsId } from './co-presentation-controls';
export const PRESENTATION_AUTO_ACCEPT_KEY = 'castlink.presentation.autoAccept';
export const presentationAutoAcceptPreference = (stored: string | null) => stored !== 'false';
export const presentationRecipientAccepted = (session: CoPresentation) => session.controllerAccepted !== false;
export function presentationRecipientAcceptanceKey(session: CoPresentation, identity: string, sid: string, trackSid: string) {
  return session.controller?.identity === identity && session.controller.sid === sid && trackSid ? JSON.stringify([slideControlsId(session),identity,sid,trackSid]) : '';
}
