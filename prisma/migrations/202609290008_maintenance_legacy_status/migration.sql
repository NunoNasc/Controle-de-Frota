-- Older integrations still write WorkStatus; translate those writes before the new workflow trigger.
CREATE FUNCTION maintenance_legacy_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.stage=OLD.stage AND NEW.status<>OLD.status THEN
  NEW.stage:=CASE NEW.status WHEN 'OPEN' THEN 'REQUESTED' WHEN 'IN_PROGRESS' THEN 'IN_SERVICE' WHEN 'COMPLETED' THEN 'DONE' ELSE 'CANCELED' END::"MaintenanceStage";
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER maintenance_legacy_status BEFORE UPDATE ON "Maintenance" FOR EACH ROW EXECUTE FUNCTION maintenance_legacy_status();
