-- Desired state and acknowledgement are deliberately separate.
ALTER TABLE castlink_control.nodes ADD COLUMN IF NOT EXISTS operational_revision bigint NOT NULL DEFAULT 0;
ALTER TABLE castlink_control.nodes ADD COLUMN IF NOT EXISTS applied_revision bigint;
ALTER TABLE castlink_control.nodes ADD COLUMN IF NOT EXISTS applied_at timestamptz;
CREATE TABLE IF NOT EXISTS castlink_control.participant_blocks (
  node_id text NOT NULL REFERENCES castlink_control.nodes(node_id) ON DELETE CASCADE,
  media_room text NOT NULL,
  identity text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(node_id, media_room, identity)
);
CREATE INDEX IF NOT EXISTS participant_blocks_expiry ON castlink_control.participant_blocks(expires_at);
