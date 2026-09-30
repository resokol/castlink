-- CastLink control-plane server registry schema draft.
-- This belongs to the future License/Account service, not customer media databases.

CREATE TABLE IF NOT EXISTS castlink_organizations (
  id text PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS castlink_licenses (
  license_id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES castlink_organizations(id) ON DELETE CASCADE,
  plan text NOT NULL,
  status text NOT NULL CHECK (status IN ('active','suspended','expired','cancelled')),
  max_servers integer NOT NULL DEFAULT 1 CHECK (max_servers >= 1),
  max_concurrent_studios integer NOT NULL DEFAULT 1 CHECK (max_concurrent_studios >= 1),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS castlink_registered_servers (
  server_id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES castlink_organizations(id) ON DELETE CASCADE,
  license_id text NOT NULL REFERENCES castlink_licenses(license_id) ON DELETE CASCADE,
  installation_id uuid NOT NULL,
  server_type text NOT NULL CHECK (server_type IN ('cloud','dedicated','self-hosted','temporary')),
  display_name text NOT NULL,
  region text,
  endpoint text,
  owner_visibility text NOT NULL DEFAULT 'organization'
    CHECK (owner_visibility IN ('organization','account','platform')),
  state text NOT NULL DEFAULT 'active'
    CHECK (state IN ('active','disabled','expired','provisioning')),
  expires_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (license_id, installation_id)
);

CREATE INDEX IF NOT EXISTS castlink_registered_servers_org_idx
  ON castlink_registered_servers (organization_id, state);

CREATE INDEX IF NOT EXISTS castlink_registered_servers_license_idx
  ON castlink_registered_servers (license_id, state);
