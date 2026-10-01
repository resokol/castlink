-- Add explicit emergency node state.
-- "active" is displayed as Enabled in the Super Admin UI.

ALTER TABLE castlink_control.nodes
  DROP CONSTRAINT IF EXISTS nodes_state_check;

ALTER TABLE castlink_control.nodes
  ADD CONSTRAINT nodes_state_check
  CHECK (state IN ('active','draining','disabled','force_offline'));
