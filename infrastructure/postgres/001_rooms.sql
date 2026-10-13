-- CastLink PostgreSQL storage schema, phase 1.
-- Not wired into runtime yet. Apply only when the PostgreSQL backend is enabled.

CREATE TABLE IF NOT EXISTS castlink_schema_migrations (
  version integer PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS castlink_installations (
  installation_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS castlink_rooms (
  installation_id uuid NOT NULL REFERENCES castlink_installations(installation_id) ON DELETE CASCADE,
  name text NOT NULL,
  password_hash text,
  password_ciphertext text,
  studio_only boolean NOT NULL DEFAULT false,
  transfer_room_id text,
  admin_access_version text,
  guest_invite_version text,
  viewer_access_version text,
  output_access_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (installation_id, name),
  CHECK (char_length(name) BETWEEN 1 AND 100)
);

CREATE INDEX IF NOT EXISTS castlink_rooms_installation_idx
  ON castlink_rooms (installation_id);

INSERT INTO castlink_schema_migrations(version)
VALUES (1)
ON CONFLICT (version) DO NOTHING;
