CREATE SCHEMA IF NOT EXISTS castlink_control;

-- CastLink multi-tenant control-plane foundation.
-- One physical node may host many independent studios.

CREATE TABLE IF NOT EXISTS castlink_control.accounts (
  account_id text PRIMARY KEY,
  email text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS castlink_control.organizations (
  organization_id text PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS castlink_control.organization_members (
  organization_id text NOT NULL REFERENCES castlink_control.organizations(organization_id) ON DELETE CASCADE,
  account_id text NOT NULL REFERENCES castlink_control.accounts(account_id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','admin','member')),
  PRIMARY KEY (organization_id, account_id)
);

CREATE TABLE IF NOT EXISTS castlink_control.nodes (
  node_id text PRIMARY KEY,
  name text NOT NULL,
  region text NOT NULL,
  node_type text NOT NULL CHECK (node_type IN ('cloud','self-hosted','edge')),
  endpoint text,
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active','draining','disabled')),
  health text NOT NULL DEFAULT 'unknown' CHECK (health IN ('healthy','degraded','offline','unknown')),
  last_seen_at timestamptz,
  max_active_studios integer NOT NULL DEFAULT 4 CHECK (max_active_studios >= 1),
  max_participants integer NOT NULL DEFAULT 24 CHECK (max_participants >= 1),
  max_video_tracks integer NOT NULL DEFAULT 32 CHECK (max_video_tracks >= 1),
  active_studios integer NOT NULL DEFAULT 0 CHECK (active_studios >= 0),
  active_participants integer NOT NULL DEFAULT 0 CHECK (active_participants >= 0),
  active_video_tracks integer NOT NULL DEFAULT 0 CHECK (active_video_tracks >= 0),
  network_out_mbps real,
  cpu_load real,
  memory_load real,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS castlink_control.studios (
  studio_id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES castlink_control.organizations(organization_id) ON DELETE CASCADE,
  name text NOT NULL,
  assignment_mode text NOT NULL DEFAULT 'auto' CHECK (assignment_mode IN ('auto','pinned')),
  assigned_node_id text REFERENCES castlink_control.nodes(node_id),
  broadcast_state text NOT NULL DEFAULT 'idle' CHECK (broadcast_state IN ('idle','starting','live','stopping')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS castlink_control.rooms (
  room_id text PRIMARY KEY,
  studio_id text NOT NULL REFERENCES castlink_control.studios(studio_id) ON DELETE CASCADE,
  name text NOT NULL,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (studio_id, name)
);

CREATE INDEX IF NOT EXISTS studios_org_idx
  ON castlink_control.studios (organization_id);

CREATE INDEX IF NOT EXISTS studios_node_idx
  ON castlink_control.studios (assigned_node_id, broadcast_state);

CREATE INDEX IF NOT EXISTS rooms_studio_idx
  ON castlink_control.rooms (studio_id);

CREATE INDEX IF NOT EXISTS nodes_health_idx
  ON castlink_control.nodes (state, health, last_seen_at);
