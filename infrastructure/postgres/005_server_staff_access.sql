CREATE TABLE IF NOT EXISTS castlink_server_staff_access (
  installation_id uuid NOT NULL,
  scope text NOT NULL,
  state jsonb NOT NULL,
  PRIMARY KEY (installation_id, scope)
);
INSERT INTO castlink_schema_migrations(version) VALUES (5) ON CONFLICT (version) DO NOTHING;
