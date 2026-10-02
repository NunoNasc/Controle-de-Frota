CREATE TYPE "IncidentStage" AS ENUM ('NEW','ANALYSIS','AWAITING_APPROVAL','AWAITING_PART','AWAITING_SUPPLIER','SCHEDULED','UNDER_MAINTENANCE','AWAITING_TEST','RELEASED','DONE','REJECTED','VOID','CONTINGENCY');
ALTER TABLE "Incident" ADD COLUMN "publicNumber" TEXT, ADD COLUMN "stage" "IncidentStage" NOT NULL DEFAULT 'NEW', ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "supplierId" TEXT, ADD COLUMN "requisitionId" TEXT, ADD COLUMN "purchaseOrderId" TEXT;
CREATE TABLE "IncidentCounter" ("year" INTEGER PRIMARY KEY, "value" INTEGER NOT NULL);
WITH numbered AS (
 SELECT id, EXTRACT(YEAR FROM "openedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bahia')::int AS y,
 ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM "openedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bahia') ORDER BY "openedAt",number)::int AS seq FROM "Incident"
) UPDATE "Incident" i SET "publicNumber"='OC-'||n.y||'-'||lpad(n.seq::text,6,'0') FROM numbered n WHERE i.id=n.id;
INSERT INTO "IncidentCounter" SELECT split_part("publicNumber",'-',2)::int,MAX(split_part("publicNumber",'-',3)::int) FROM "Incident" GROUP BY 1;
UPDATE "Incident" SET stage=CASE status WHEN 'OPEN' THEN 'NEW' WHEN 'IN_PROGRESS' THEN 'ANALYSIS' WHEN 'COMPLETED' THEN 'DONE' ELSE 'VOID' END::"IncidentStage";
ALTER TABLE "Incident" ALTER COLUMN "publicNumber" SET NOT NULL;
CREATE UNIQUE INDEX "Incident_publicNumber_key" ON "Incident"("publicNumber");
CREATE INDEX "Incident_stage_priority_idx" ON "Incident"(stage,priority);
CREATE INDEX "Incident_supplierId_idx" ON "Incident"("supplierId");
CREATE INDEX "Incident_requisitionId_idx" ON "Incident"("requisitionId");
CREATE INDEX "Incident_purchaseOrderId_idx" ON "Incident"("purchaseOrderId");
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "PurchaseRequisition"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "IncidentEvent" (id TEXT PRIMARY KEY, "incidentId" TEXT NOT NULL REFERENCES "Incident"(id) ON DELETE RESTRICT ON UPDATE CASCADE, kind TEXT NOT NULL, actor TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', "before" JSONB, "after" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "IncidentEvent_incidentId_createdAt_idx" ON "IncidentEvent"("incidentId","createdAt");
CREATE TABLE "IncidentAttachment" (id TEXT PRIMARY KEY, "incidentId" TEXT NOT NULL REFERENCES "Incident"(id) ON DELETE RESTRICT ON UPDATE CASCADE, "fileName" TEXT NOT NULL, "mimeType" TEXT NOT NULL, content BYTEA NOT NULL, "sizeBytes" INTEGER NOT NULL, actor TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "IncidentAttachment_valid" CHECK ("sizeBytes" BETWEEN 1 AND 5242880 AND octet_length(content)="sizeBytes" AND "mimeType" IN ('image/jpeg','image/png','application/pdf')));
CREATE INDEX "IncidentAttachment_incidentId_createdAt_idx" ON "IncidentAttachment"("incidentId","createdAt");
-- Existing records get an honest migration snapshot, not an invented past timeline.
INSERT INTO "IncidentEvent"(id,"incidentId",kind,actor,note,"after") SELECT gen_random_uuid()::text,id,'MIGRATED','Sistema','Registro existente incorporado ao histórico; alterações anteriores não estavam auditadas.',to_jsonb(i) FROM "Incident" i;
CREATE FUNCTION incident_number_and_stage() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE y integer; seq integer;
BEGIN
 IF TG_OP='INSERT' THEN
  y:=EXTRACT(YEAR FROM NEW."openedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bahia')::integer;
  INSERT INTO "IncidentCounter"(year,value) VALUES(y,1) ON CONFLICT(year) DO UPDATE SET value="IncidentCounter".value+1 RETURNING value INTO seq;
  NEW."publicNumber":='OC-'||y||'-'||lpad(seq::text,GREATEST(6,length(seq::text)),'0');
 ELSE
  IF NEW."publicNumber" IS DISTINCT FROM OLD."publicNumber" OR NEW.number<>OLD.number THEN RAISE EXCEPTION 'Incident number is immutable'; END IF;
  NEW.revision:=OLD.revision+1;
 END IF;
 -- Preserve the existing dashboard/report contract without changing maintenance or purchase statuses.
 NEW.status:=CASE NEW.stage WHEN 'NEW' THEN 'OPEN' WHEN 'DONE' THEN 'COMPLETED' WHEN 'RELEASED' THEN 'COMPLETED' WHEN 'REJECTED' THEN 'CANCELED' WHEN 'VOID' THEN 'CANCELED' ELSE 'IN_PROGRESS' END::"WorkStatus";
 RETURN NEW;
END $$;
CREATE TRIGGER incident_number_and_stage BEFORE INSERT OR UPDATE ON "Incident" FOR EACH ROW EXECUTE FUNCTION incident_number_and_stage();
CREATE FUNCTION incident_audit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE who text; why text; source "Checklist"%ROWTYPE;
BEGIN
 who:=COALESCE(NULLIF(current_setting('fleet.actor',true),''),'Sistema');
 why:=COALESCE(current_setting('fleet.reason',true),'');
 IF TG_OP='INSERT' THEN
  IF NEW."checklistId" IS NOT NULL THEN
   SELECT * INTO source FROM "Checklist" WHERE id=NEW."checklistId";
   INSERT INTO "IncidentEvent"(id,"incidentId",kind,actor,note,"createdAt") VALUES(gen_random_uuid()::text,NEW.id,'CHECKLIST',source."driverName",'Checklist realizado · '||source.id,source."submittedAt");
   INSERT INTO "IncidentEvent"(id,"incidentId",kind,actor,note,"createdAt") VALUES(gen_random_uuid()::text,NEW.id,'DETECTED','Sistema',NEW.title,NEW."openedAt");
  END IF;
  INSERT INTO "IncidentEvent"(id,"incidentId",kind,actor,note,"after","createdAt") VALUES(gen_random_uuid()::text,NEW.id,'CREATED',who,'Ocorrência criada',to_jsonb(NEW),NEW."openedAt");
 ELSE
  INSERT INTO "IncidentEvent"(id,"incidentId",kind,actor,note,"before","after") VALUES(gen_random_uuid()::text,NEW.id,'UPDATED',who,why,to_jsonb(OLD),to_jsonb(NEW));
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER incident_audit AFTER INSERT OR UPDATE ON "Incident" FOR EACH ROW EXECUTE FUNCTION incident_audit();
CREATE FUNCTION reject_history_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Incident history is append-only'; END $$;
CREATE TRIGGER incident_history_immutable BEFORE UPDATE ON "IncidentEvent" FOR EACH ROW EXECUTE FUNCTION reject_history_update();
CREATE TRIGGER incident_attachment_immutable BEFORE UPDATE ON "IncidentAttachment" FOR EACH ROW EXECUTE FUNCTION reject_history_update();
