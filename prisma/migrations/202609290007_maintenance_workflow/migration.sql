CREATE TYPE "MaintenanceKind" AS ENUM ('UNSPECIFIED','PREVENTIVE','CORRECTIVE','PREDICTIVE');
CREATE TYPE "MaintenanceStage" AS ENUM ('REQUESTED','ANALYSIS','AWAITING_QUOTE','AWAITING_APPROVAL','AWAITING_PART','SCHEDULED','IN_SERVICE','TESTING','DONE','CANCELED');
ALTER TABLE "Maintenance" ADD COLUMN kind "MaintenanceKind" NOT NULL DEFAULT 'UNSPECIFIED', ADD COLUMN stage "MaintenanceStage" NOT NULL DEFAULT 'REQUESTED', ADD COLUMN "stageChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, ADD COLUMN revision INTEGER NOT NULL DEFAULT 0, ADD COLUMN "submissionKey" TEXT, ADD COLUMN "unavailableFrom" TIMESTAMP(3), ADD COLUMN "unavailableUntil" TIMESTAMP(3), ADD COLUMN "alertAfterHours" INTEGER NOT NULL DEFAULT 48, ADD COLUMN "criticalAfterHours" INTEGER NOT NULL DEFAULT 120, ADD COLUMN solution TEXT NOT NULL DEFAULT '', ADD COLUMN "costKnown" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Maintenance" ALTER COLUMN "scheduledAt" DROP NOT NULL;
UPDATE "Maintenance" SET kind=CASE lower(type) WHEN 'preventiva' THEN 'PREVENTIVE' WHEN 'corretiva' THEN 'CORRECTIVE' WHEN 'preditiva' THEN 'PREDICTIVE' ELSE 'UNSPECIFIED' END::"MaintenanceKind", stage=CASE status WHEN 'OPEN' THEN 'REQUESTED' WHEN 'IN_PROGRESS' THEN 'IN_SERVICE' WHEN 'COMPLETED' THEN 'DONE' ELSE 'CANCELED' END::"MaintenanceStage", "stageChangedAt"="updatedAt", "costKnown"=(cost>0);
CREATE UNIQUE INDEX "Maintenance_submissionKey_key" ON "Maintenance"("submissionKey");
CREATE INDEX "Maintenance_stage_stageChangedAt_idx" ON "Maintenance"(stage,"stageChangedAt");
CREATE INDEX "Maintenance_vehicleId_unavailableUntil_idx" ON "Maintenance"("vehicleId","unavailableUntil");
ALTER TABLE "Maintenance" ADD CONSTRAINT "Maintenance_alert_limits" CHECK ("alertAfterHours" BETWEEN 1 AND 8760 AND "criticalAfterHours" BETWEEN "alertAfterHours" AND 17520), ADD CONSTRAINT "Maintenance_unavailability_dates" CHECK (("unavailableUntil" IS NULL OR ("unavailableFrom" IS NOT NULL AND "unavailableUntil">="unavailableFrom")));
ALTER TABLE "Alert" ADD COLUMN "maintenanceId" TEXT REFERENCES "Maintenance"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Alert_maintenanceId_key" ON "Alert"("maintenanceId");
CREATE TABLE "MaintenanceEvent" (id TEXT PRIMARY KEY,"maintenanceId" TEXT NOT NULL REFERENCES "Maintenance"(id) ON DELETE RESTRICT ON UPDATE CASCADE,actor TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',"before" JSONB,"after" JSONB NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'));
CREATE INDEX "MaintenanceEvent_maintenanceId_createdAt_idx" ON "MaintenanceEvent"("maintenanceId","createdAt");
INSERT INTO "MaintenanceEvent"(id,"maintenanceId",actor,note,"after") SELECT gen_random_uuid()::text,id,'Sistema','Cadastro anterior incorporado ao histórico. Indisponibilidade não inferida de datas antigas.',to_jsonb(m) FROM "Maintenance" m;
CREATE TRIGGER maintenance_history_immutable BEFORE UPDATE ON "MaintenanceEvent" FOR EACH ROW EXECUTE FUNCTION reject_history_update();
CREATE FUNCTION maintenance_workflow() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM id FROM "Vehicle" WHERE id=NEW."vehicleId" FOR UPDATE;
 IF TG_OP='UPDATE' THEN
  IF NEW."vehicleId"<>OLD."vehicleId" THEN RAISE EXCEPTION 'Maintenance vehicle is immutable'; END IF;
  IF OLD.stage IN ('DONE','CANCELED') AND NEW.stage<>OLD.stage THEN RAISE EXCEPTION 'Closed maintenance cannot be reopened'; END IF;
  IF OLD."unavailableFrom" IS NOT NULL AND NEW."unavailableFrom" IS DISTINCT FROM OLD."unavailableFrom" THEN RAISE EXCEPTION 'Downtime start is immutable'; END IF;
  IF OLD."unavailableUntil" IS NOT NULL AND NEW."unavailableUntil" IS DISTINCT FROM OLD."unavailableUntil" THEN RAISE EXCEPTION 'Downtime end is immutable'; END IF;
  NEW.revision:=OLD.revision+1;
  NEW."stageChangedAt":=CASE WHEN NEW.stage<>OLD.stage THEN clock_timestamp() AT TIME ZONE 'UTC' ELSE OLD."stageChangedAt" END;
 ELSE
  IF NEW.stage='REQUESTED' THEN NEW.stage:=CASE NEW.status WHEN 'IN_PROGRESS' THEN 'IN_SERVICE' WHEN 'COMPLETED' THEN 'DONE' WHEN 'CANCELED' THEN 'CANCELED' ELSE 'REQUESTED' END::"MaintenanceStage"; END IF;
 END IF;
 IF NEW.kind='UNSPECIFIED' THEN NEW.kind:=CASE lower(NEW.type) WHEN 'preventiva' THEN 'PREVENTIVE' WHEN 'corretiva' THEN 'CORRECTIVE' WHEN 'preditiva' THEN 'PREDICTIVE' ELSE 'UNSPECIFIED' END::"MaintenanceKind"; END IF;
 IF NEW.kind<>'UNSPECIFIED' THEN NEW.type:=CASE NEW.kind WHEN 'PREVENTIVE' THEN 'Preventiva' WHEN 'CORRECTIVE' THEN 'Corretiva' ELSE 'Preditiva' END; END IF;
 IF NEW.stage IN ('DONE','CANCELED') AND NEW."unavailableFrom" IS NOT NULL AND NEW."unavailableUntil" IS NULL THEN NEW."unavailableUntil":=COALESCE(NEW."completedAt",clock_timestamp() AT TIME ZONE 'UTC'); END IF;
 NEW.status:=CASE WHEN NEW.stage='DONE' THEN 'COMPLETED' WHEN NEW.stage='CANCELED' THEN 'CANCELED' WHEN NEW.stage IN ('IN_SERVICE','TESTING') OR (NEW."unavailableFrom" IS NOT NULL AND NEW."unavailableUntil" IS NULL) THEN 'IN_PROGRESS' ELSE 'OPEN' END::"WorkStatus";
 RETURN NEW;
END $$;
CREATE TRIGGER maintenance_workflow BEFORE INSERT OR UPDATE ON "Maintenance" FOR EACH ROW EXECUTE FUNCTION maintenance_workflow();
CREATE FUNCTION audit_maintenance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO "MaintenanceEvent"(id,"maintenanceId",actor,note,"before","after") VALUES(gen_random_uuid()::text,NEW.id,COALESCE(NULLIF(current_setting('fleet.actor',true),''),'Sistema'),COALESCE(NULLIF(current_setting('fleet.reason',true),''),CASE WHEN TG_OP='INSERT' THEN 'Manutenção solicitada' ELSE 'Cadastro atualizado' END),CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,to_jsonb(NEW));
 IF NEW."unavailableFrom" IS NOT NULL AND NEW."unavailableUntil" IS NULL THEN
  UPDATE "Vehicle" SET status='MAINTENANCE',availability='UNAVAILABLE',"updatedAt"=clock_timestamp() AT TIME ZONE 'UTC' WHERE id=NEW."vehicleId";
 ELSIF TG_OP='UPDATE' AND OLD."unavailableFrom" IS NOT NULL AND OLD."unavailableUntil" IS NULL AND NEW."unavailableUntil" IS NOT NULL THEN
  UPDATE "Vehicle" SET status='UNKNOWN',availability='UNKNOWN',"updatedAt"=clock_timestamp() AT TIME ZONE 'UTC' WHERE id=NEW."vehicleId" AND status='MAINTENANCE' AND NOT EXISTS(SELECT 1 FROM "Maintenance" m WHERE m."vehicleId"=NEW."vehicleId" AND m."unavailableFrom" IS NOT NULL AND m."unavailableUntil" IS NULL);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER audit_maintenance AFTER INSERT OR UPDATE ON "Maintenance" FOR EACH ROW EXECUTE FUNCTION audit_maintenance();
CREATE OR REPLACE FUNCTION guard_vehicle_restrictions() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 SELECT CASE WHEN bool_or(state='BLOCKED') THEN 'BLOCKED' WHEN bool_or(state='AWAITING_ASSESSMENT') THEN 'AWAITING_ASSESSMENT' ELSE 'CLEAR' END::"OperationalStatus" INTO NEW."operationalStatus" FROM "VehicleRestriction" WHERE "vehicleId"=NEW.id AND state<>'RELEASED';
 IF NEW."operationalStatus"<>'CLEAR' THEN NEW.status:='STOPPED'; NEW.availability:='UNAVAILABLE';
 ELSIF EXISTS(SELECT 1 FROM "Maintenance" WHERE "vehicleId"=NEW.id AND "unavailableFrom" IS NOT NULL AND "unavailableUntil" IS NULL) THEN NEW.status:='MAINTENANCE'; NEW.availability:='UNAVAILABLE'; END IF;
 RETURN NEW;
END $$;
