-- Optional diagnostic receipts; ordinary room credentials and data are unchanged.
ALTER TABLE castlink_rooms
  ADD COLUMN IF NOT EXISTS diagnostic_creation_id uuid,
  ADD COLUMN IF NOT EXISTS diagnostic_revision uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'castlink_rooms'::regclass
      AND conname = 'castlink_rooms_diagnostic_revision_check'
  ) THEN
    ALTER TABLE castlink_rooms ADD CONSTRAINT castlink_rooms_diagnostic_revision_check
      CHECK (diagnostic_revision IS NULL OR diagnostic_creation_id IS NOT NULL);
  END IF;
END $$;

INSERT INTO castlink_schema_migrations(version)
VALUES (3)
ON CONFLICT (version) DO NOTHING;
