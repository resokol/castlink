-- Creator/delegated access only. Legacy studio-bootstrapped credentials are not accepted.
INSERT INTO castlink_control.platform_access(access_key, access_version)
VALUES ('super_admin_v2', '') ON CONFLICT (access_key) DO NOTHING;
CREATE TABLE IF NOT EXISTS castlink_control.platform_credentials (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  kind text NOT NULL CHECK (kind IN ('invite','session')),
  principal_id uuid NOT NULL,
  issued_by uuid,
  access_version text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS platform_credentials_expiry
  ON castlink_control.platform_credentials(expires_at);
