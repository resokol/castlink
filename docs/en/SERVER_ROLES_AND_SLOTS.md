# Server roles and permanent caster outputs

[Русский](../SERVER_ROLES_AND_SLOTS_RU.md) · [简体中文](../zh-CN/SERVER_ROLES_AND_SLOTS.md)

Casters enter immediately through the normal guest or personal invitation, with existing room access checks. Moderator approval and a slot assignment are not required for entry.

The guest camera and microphone start automatically on the prejoin check screen when enabled and permitted. Preview and microphone metering stay local; the room is not joined automatically. Explicitly disabled inputs stay off. Permission errors are shown with manual retry; an unavailable input does not block the other. Leaving the check releases temporary capture.

The original administrator and moderator invitation controls are restored: Studio → Room settings → Create administrator link / Create moderator link. Use the normal studio login for your room. The separate server-owner login, password form and Server access panel have been removed. Invitations and revocation use the original room-scoped permissions; a room administrator can invite room moderators.

Studio, administrator and moderator can create, rename, assign, release and delete slots. Each slot has a permanent caster invitation and separate permanent camera/microphone and screen/screen-audio output URLs for OBS/vMix.

Assignment changes output routing only. Replacing, moving or releasing a caster preserves all room connections and publications. An empty output shows no other caster. Reconnecting the same verified session restores its output; a new identity needs assignment. Disconnect guest remains a separate action that removes the participant and clears its slot.

Renaming, changing the invitation binding and assigning another caster preserve output URLs. Only explicit camera/screen link reissue changes that output URL. Invitation reissue affects future entry. Deleting a slot invalidates its links; recreating its name produces new URLs. Existing room password and deletion revocation rules remain.

ON AIR / OFF AIR reflects confirmed publication. Camera and screen sources stay separate. Outputs inherit the existing read-only media-room subscription; source routing is not a confidentiality boundary within the room.

Migrations 005/006 apply to the initial roles/slots installation. This direct-entry correction adds no migration. Back up the database and web-data before updating. Verify the installed build through /api/version.
