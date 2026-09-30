-- Scope node-local rooms by studio while preserving existing single-studio data.
ALTER TABLE castlink_rooms
  ADD COLUMN IF NOT EXISTS studio_id text NOT NULL DEFAULT 'studio-default';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'castlink_rooms'::regclass
       AND conname = 'castlink_rooms_pkey'
  ) THEN
    ALTER TABLE castlink_rooms DROP CONSTRAINT castlink_rooms_pkey;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'castlink_rooms'::regclass
       AND conname = 'castlink_rooms_pkey'
  ) THEN
    ALTER TABLE castlink_rooms
      ADD CONSTRAINT castlink_rooms_pkey PRIMARY KEY (installation_id, studio_id, name);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS castlink_rooms_installation_studio_idx
  ON castlink_rooms (installation_id, studio_id);

INSERT INTO castlink_schema_migrations(version)
VALUES (2)
ON CONFLICT (version) DO NOTHING;
