-- Add room-scoped creator credentials without changing legacy rooms or grants.
ALTER TABLE castlink_rooms ADD COLUMN IF NOT EXISTS creator_access_id uuid;
ALTER TABLE castlink_rooms ADD COLUMN IF NOT EXISTS studio_password_hash text;
CREATE UNIQUE INDEX IF NOT EXISTS castlink_rooms_creator_access_id
  ON castlink_rooms(installation_id, creator_access_id) WHERE creator_access_id IS NOT NULL;
INSERT INTO castlink_schema_migrations(version) VALUES (4) ON CONFLICT (version) DO NOTHING;
