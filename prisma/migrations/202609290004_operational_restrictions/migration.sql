CREATE TYPE "OperationalStatus" AS ENUM ('CLEAR','AWAITING_ASSESSMENT','BLOCKED');
CREATE TYPE "RestrictionState" AS ENUM ('AWAITING_ASSESSMENT','BLOCKED','RELEASED');
ALTER TABLE "Vehicle" ADD COLUMN "operationalStatus" "OperationalStatus" NOT NULL DEFAULT 'CLEAR';
CREATE TABLE "VehicleRestriction" (
 id TEXT PRIMARY KEY, "vehicleId" TEXT NOT NULL REFERENCES "Vehicle"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "incidentId" TEXT REFERENCES "Incident"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "evaluationId" TEXT REFERENCES "ChecklistEvaluation"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 reason TEXT NOT NULL, state "RestrictionState" NOT NULL DEFAULT 'AWAITING_ASSESSMENT',
 "releaseEvidenceRequired" BOOLEAN NOT NULL DEFAULT true, revision INTEGER NOT NULL DEFAULT 0,
 "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "releasedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "VehicleRestriction_release_date" CHECK ((state='RELEASED')=("releasedAt" IS NOT NULL))
);
CREATE UNIQUE INDEX "VehicleRestriction_evaluationId_key" ON "VehicleRestriction"("evaluationId");
CREATE INDEX "VehicleRestriction_vehicleId_state_idx" ON "VehicleRestriction"("vehicleId",state);
CREATE INDEX "VehicleRestriction_incidentId_idx" ON "VehicleRestriction"("incidentId");
CREATE TABLE "RestrictionEvent" (id TEXT PRIMARY KEY, "restrictionId" TEXT NOT NULL REFERENCES "VehicleRestriction"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 actor TEXT NOT NULL, decision "RestrictionState" NOT NULL, solution TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL, "before" JSONB, "after" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'));
CREATE INDEX "RestrictionEvent_restrictionId_createdAt_idx" ON "RestrictionEvent"("restrictionId","createdAt");
CREATE TABLE "RestrictionEvidence" (id TEXT PRIMARY KEY, "eventId" TEXT NOT NULL REFERENCES "RestrictionEvent"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "fileName" TEXT NOT NULL, "mimeType" TEXT NOT NULL, content BYTEA NOT NULL, "sizeBytes" INTEGER NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
 CONSTRAINT "RestrictionEvidence_valid" CHECK ("sizeBytes" BETWEEN 1 AND 5242880 AND octet_length(content)="sizeBytes" AND "mimeType" IN ('image/jpeg','image/png','application/pdf')));
CREATE INDEX "RestrictionEvidence_eventId_idx" ON "RestrictionEvidence"("eventId");
CREATE TABLE "RestrictionPolicyEvent" (id TEXT PRIMARY KEY, actor TEXT NOT NULL, "before" JSONB NOT NULL, "after" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'));
CREATE TRIGGER restriction_event_immutable BEFORE UPDATE ON "RestrictionEvent" FOR EACH ROW EXECUTE FUNCTION reject_history_update();
CREATE TRIGGER restriction_evidence_immutable BEFORE UPDATE ON "RestrictionEvidence" FOR EACH ROW EXECUTE FUNCTION reject_history_update();
CREATE TRIGGER restriction_policy_immutable BEFORE UPDATE ON "RestrictionPolicyEvent" FOR EACH ROW EXECUTE FUNCTION reject_history_update();
INSERT INTO "Setting"(key,value,"createdAt","updatedAt") VALUES ('operational-restrictions','{"initialState":"AWAITING_ASSESSMENT","releaseEvidenceRequired":true}',CURRENT_TIMESTAMP AT TIME ZONE 'UTC',CURRENT_TIMESTAMP AT TIME ZONE 'UTC') ON CONFLICT(key) DO NOTHING;

CREATE FUNCTION guard_restriction() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM id FROM "Vehicle" WHERE id=NEW."vehicleId" FOR UPDATE;
 IF TG_OP='UPDATE' THEN
  IF OLD.state='RELEASED' THEN RAISE EXCEPTION 'Released restrictions are immutable'; END IF;
  IF (NEW."vehicleId",NEW."incidentId",NEW."evaluationId",NEW.reason,NEW."releaseEvidenceRequired",NEW."detectedAt",NEW."createdAt") IS DISTINCT FROM (OLD."vehicleId",OLD."incidentId",OLD."evaluationId",OLD.reason,OLD."releaseEvidenceRequired",OLD."detectedAt",OLD."createdAt") THEN RAISE EXCEPTION 'Restriction source is immutable'; END IF;
  NEW.revision:=OLD.revision+1;
 END IF;
 IF NEW.state='RELEASED' THEN
  IF COALESCE(current_setting('fleet.actor',true),'')='' OR length(COALESCE(current_setting('fleet.solution',true),''))<5 OR length(COALESCE(current_setting('fleet.notes',true),''))<3 THEN RAISE EXCEPTION 'Release requires responsible, solution and notes'; END IF;
  NEW."releasedAt":=clock_timestamp() AT TIME ZONE 'UTC';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_restriction BEFORE INSERT OR UPDATE ON "VehicleRestriction" FOR EACH ROW EXECUTE FUNCTION guard_restriction();
CREATE FUNCTION audit_restriction() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE op "OperationalStatus";
BEGIN
 INSERT INTO "RestrictionEvent"(id,"restrictionId",actor,decision,solution,notes,"before","after") VALUES(gen_random_uuid()::text,NEW.id,COALESCE(NULLIF(current_setting('fleet.actor',true),''),'Sistema'),NEW.state,COALESCE(current_setting('fleet.solution',true),''),COALESCE(NULLIF(current_setting('fleet.notes',true),''),'Restrição registrada pela regra configurada do checklist.'),CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,to_jsonb(NEW));
 SELECT CASE WHEN bool_or(state='BLOCKED') THEN 'BLOCKED' WHEN bool_or(state='AWAITING_ASSESSMENT') THEN 'AWAITING_ASSESSMENT' ELSE 'CLEAR' END::"OperationalStatus" INTO op FROM "VehicleRestriction" WHERE "vehicleId"=NEW."vehicleId" AND state<>'RELEASED';
 UPDATE "Vehicle" SET "operationalStatus"=op,status=CASE WHEN op<>'CLEAR' THEN 'STOPPED'::"VehicleStatus" ELSE status END,availability=CASE WHEN op<>'CLEAR' THEN 'UNAVAILABLE'::"Availability" ELSE availability END,"updatedAt"=clock_timestamp() AT TIME ZONE 'UTC' WHERE id=NEW."vehicleId";
 RETURN NEW;
END $$;
CREATE TRIGGER audit_restriction AFTER INSERT OR UPDATE ON "VehicleRestriction" FOR EACH ROW EXECUTE FUNCTION audit_restriction();
CREATE FUNCTION guard_vehicle_restrictions() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 SELECT CASE WHEN bool_or(state='BLOCKED') THEN 'BLOCKED' WHEN bool_or(state='AWAITING_ASSESSMENT') THEN 'AWAITING_ASSESSMENT' ELSE 'CLEAR' END::"OperationalStatus" INTO NEW."operationalStatus" FROM "VehicleRestriction" WHERE "vehicleId"=NEW.id AND state<>'RELEASED';
 IF NEW."operationalStatus"<>'CLEAR' THEN NEW.status:='STOPPED'; NEW.availability:='UNAVAILABLE'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_vehicle_restrictions BEFORE UPDATE ON "Vehicle" FOR EACH ROW EXECUTE FUNCTION guard_vehicle_restrictions();
-- Preserve existing evidence and import only restrictions still reflected in vehicle unavailability.
INSERT INTO "VehicleRestriction"(id,"vehicleId","incidentId","evaluationId",reason,"detectedAt","createdAt","updatedAt")
 SELECT gen_random_uuid()::text,c."vehicleId",e."incidentId",e.id,'Bloqueio anterior do checklist: '||COALESCE(a."itemLabel",a.item)||'. Requer avaliação técnica.',e."evaluatedAt",CURRENT_TIMESTAMP AT TIME ZONE 'UTC',CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
 FROM "ChecklistEvaluation" e JOIN "ChecklistAnswer" a ON a.id=e."answerId" JOIN "Checklist" c ON c.id=a."checklistId" JOIN "Vehicle" v ON v.id=c."vehicleId"
 WHERE e."blocksVehicle" AND v.status='STOPPED' AND v.availability='UNAVAILABLE';
INSERT INTO "VehicleRestriction"(id,"vehicleId","incidentId",reason,"detectedAt","createdAt","updatedAt")
 SELECT gen_random_uuid()::text,i."vehicleId",i.id,'Bloqueio anterior da ocorrência '||i."publicNumber"||': '||i.title,i."openedAt",CURRENT_TIMESTAMP AT TIME ZONE 'UTC',CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
 FROM "Incident" i JOIN "Vehicle" v ON v.id=i."vehicleId" WHERE i."vehicleBlocked" AND v.status='STOPPED' AND v.availability='UNAVAILABLE' AND NOT EXISTS(SELECT 1 FROM "VehicleRestriction" r WHERE r."incidentId"=i.id);
