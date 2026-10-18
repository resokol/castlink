ALTER TABLE castlink_rooms ADD COLUMN IF NOT EXISTS slot_association_id uuid;
CREATE TABLE IF NOT EXISTS castlink_caster_slots (
  installation_id uuid NOT NULL, scope text NOT NULL, state jsonb NOT NULL,
  PRIMARY KEY (installation_id, scope)
);
CREATE TABLE IF NOT EXISTS castlink_guest_admissions (
  installation_id uuid NOT NULL, scope text NOT NULL, state jsonb NOT NULL,
  PRIMARY KEY (installation_id, scope)
);
INSERT INTO castlink_schema_migrations(version) VALUES (6) ON CONFLICT (version) DO NOTHING;
