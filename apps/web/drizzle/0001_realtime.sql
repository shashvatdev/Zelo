-- Realtime: tell every app server when a board or a team changes.
-- NOTIFY is delivered on COMMIT, so listeners never see changes that were rolled back.
CREATE OR REPLACE FUNCTION zelo_notify_board() RETURNS trigger AS $$
BEGIN
  IF NEW.version IS DISTINCT FROM OLD.version THEN
    PERFORM pg_notify('zelo_events', json_build_object('w', NEW.workspace_id, 't', 'board', 'v', NEW.version)::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER products_notify AFTER UPDATE OF version ON products FOR EACH ROW EXECUTE FUNCTION zelo_notify_board();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION zelo_notify_team() RETURNS trigger AS $$
DECLARE ws uuid;
BEGIN
  ws := COALESCE(NEW.workspace_id, OLD.workspace_id);
  PERFORM pg_notify('zelo_events', json_build_object('w', ws, 't', 'team')::text);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER members_notify AFTER INSERT OR UPDATE OR DELETE ON members FOR EACH ROW EXECUTE FUNCTION zelo_notify_team();
--> statement-breakpoint
CREATE TRIGGER invites_notify AFTER INSERT OR UPDATE OR DELETE ON invites FOR EACH ROW EXECUTE FUNCTION zelo_notify_team();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION zelo_notify_workspace() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('zelo_events', json_build_object('w', NEW.id, 't', 'team')::text);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER workspaces_notify AFTER UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION zelo_notify_workspace();
