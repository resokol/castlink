export type StoredRoomChatMessage = {
  id: string;
  message: string;
  timestamp: number;
  identity: string;
  name: string;
};

export type RoomChatScope = { studioId: string; roomAssociation: string };
