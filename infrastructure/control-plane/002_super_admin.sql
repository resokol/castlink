-- CastLink platform-level access state for Super Admin sessions.
-- Contains only a revocation version; no bearer tokens or passwords are stored.

CREATE TABLE IF NOT EXISTS castlink_control.platform_access (
  access_key text PRIMARY KEY,
  access_version text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO castlink_control.platform_access(access_key, access_version)
VALUES ('super_admin', '')
ON CONFLICT (access_key) DO NOTHING;
