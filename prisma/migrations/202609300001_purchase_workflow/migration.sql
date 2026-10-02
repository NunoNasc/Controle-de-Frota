CREATE TYPE "PurchaseStage" AS ENUM ('PENDING','APPROVAL','APPROVED','REJECTED','CONTINGENCY','ORDERED','WAITING_SUPPLIER','DELIVERED','FINISHED','CANCELED');
ALTER TABLE "PurchaseOrder" ADD COLUMN "orderNumber" TEXT, ADD COLUMN stage "PurchaseStage" NOT NULL DEFAULT 'PENDING', ADD COLUMN "stageChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, ADD COLUMN revision INTEGER NOT NULL DEFAULT 0, ADD COLUMN "submissionKey" TEXT, ADD COLUMN "amountKnown" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "staleAfterDays" INTEGER NOT NULL DEFAULT 5;
UPDATE "PurchaseOrder" SET "orderNumber"=number, "amountKnown"=true,stage=CASE status WHEN 'COMPLETED' THEN 'FINISHED' WHEN 'CANCELED' THEN 'CANCELED' WHEN 'IN_PROGRESS' THEN 'ORDERED' ELSE 'PENDING' END::"PurchaseStage", "stageChangedAt"="updatedAt";
CREATE UNIQUE INDEX "PurchaseOrder_orderNumber_key" ON "PurchaseOrder"("orderNumber");
CREATE UNIQUE INDEX "PurchaseOrder_submissionKey_key" ON "PurchaseOrder"("submissionKey");
CREATE INDEX "PurchaseOrder_stage_stageChangedAt_idx" ON "PurchaseOrder"(stage,"stageChangedAt");
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT purchase_stale_days CHECK ("staleAfterDays" BETWEEN 1 AND 365);
CREATE TABLE "PurchaseEvent" (id TEXT PRIMARY KEY,"purchaseId" TEXT NOT NULL REFERENCES "PurchaseOrder"(id) ON DELETE RESTRICT ON UPDATE CASCADE,actor TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',"before" JSONB,"after" JSONB NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'));
CREATE INDEX "PurchaseEvent_purchaseId_createdAt_idx" ON "PurchaseEvent"("purchaseId","createdAt");
INSERT INTO "PurchaseEvent"(id,"purchaseId",actor,note,"after") SELECT gen_random_uuid()::text,id,'Sistema','Cadastro anterior preservado. Início da etapa baseado na última atualização disponível.',to_jsonb(p) FROM "PurchaseOrder" p;
CREATE TRIGGER purchase_history_immutable BEFORE UPDATE ON "PurchaseEvent" FOR EACH ROW EXECUTE FUNCTION reject_history_update();
CREATE FUNCTION purchase_workflow() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.stage=OLD.stage AND NEW.status<>OLD.status THEN NEW.stage:=CASE NEW.status WHEN 'COMPLETED' THEN 'FINISHED' WHEN 'CANCELED' THEN 'CANCELED' WHEN 'IN_PROGRESS' THEN 'ORDERED' ELSE 'PENDING' END::"PurchaseStage"; END IF;
  NEW."stageChangedAt":=CASE WHEN NEW.stage<>OLD.stage THEN clock_timestamp() AT TIME ZONE 'UTC' ELSE OLD."stageChangedAt" END;
  NEW.revision:=OLD.revision+1;
 ELSE
  IF NEW."orderNumber" IS NULL AND NEW.number NOT LIKE 'SOL-%' THEN NEW."orderNumber":=NEW.number; NEW."amountKnown":=true; END IF;
  IF NEW.stage='PENDING' THEN NEW.stage:=CASE NEW.status WHEN 'COMPLETED' THEN 'FINISHED' WHEN 'CANCELED' THEN 'CANCELED' WHEN 'IN_PROGRESS' THEN 'ORDERED' ELSE 'PENDING' END::"PurchaseStage"; END IF;
 END IF;
 NEW.status:=CASE WHEN NEW.stage='FINISHED' THEN 'COMPLETED' WHEN NEW.stage IN ('REJECTED','CANCELED') THEN 'CANCELED' WHEN NEW.stage='PENDING' THEN 'OPEN' ELSE 'IN_PROGRESS' END::"WorkStatus";
 RETURN NEW;
END $$;
CREATE TRIGGER purchase_workflow BEFORE INSERT OR UPDATE ON "PurchaseOrder" FOR EACH ROW EXECUTE FUNCTION purchase_workflow();
CREATE FUNCTION audit_purchase() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO "PurchaseEvent"(id,"purchaseId",actor,note,"before","after") VALUES(gen_random_uuid()::text,NEW.id,COALESCE(NULLIF(current_setting('fleet.actor',true),''),'Sistema'),COALESCE(NULLIF(current_setting('fleet.reason',true),''),'Cadastro de compra registrado'),CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,to_jsonb(NEW));
 RETURN NEW;
END $$;
CREATE TRIGGER audit_purchase AFTER INSERT OR UPDATE ON "PurchaseOrder" FOR EACH ROW EXECUTE FUNCTION audit_purchase();
-- Changes made from the incident/maintenance modules also invalidate stale purchase editors.
CREATE FUNCTION audit_purchase_link() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_id TEXT; target_id TEXT;
BEGIN
 old_id:=CASE WHEN TG_OP='UPDATE' THEN OLD."purchaseOrderId" ELSE NULL END;
 IF NEW."purchaseOrderId" IS NOT DISTINCT FROM old_id THEN RETURN NEW; END IF;
 FOR target_id IN SELECT DISTINCT x FROM unnest(ARRAY[old_id,NEW."purchaseOrderId"]) x WHERE x IS NOT NULL LOOP
  UPDATE "PurchaseOrder" SET "updatedAt"=clock_timestamp() AT TIME ZONE 'UTC' WHERE id=target_id;
  INSERT INTO "PurchaseEvent"(id,"purchaseId",actor,note,"before","after") VALUES(gen_random_uuid()::text,target_id,COALESCE(NULLIF(current_setting('fleet.actor',true),''),'Sistema'),'Vínculo atualizado em '||CASE TG_TABLE_NAME WHEN 'Incident' THEN 'Ocorrências' ELSE 'Manutenções' END,jsonb_build_object('purchaseId',old_id),jsonb_build_object('origin',TG_TABLE_NAME,'recordId',NEW.id,'purchaseId',NEW."purchaseOrderId"));
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER audit_incident_purchase_link AFTER INSERT OR UPDATE ON "Incident" FOR EACH ROW EXECUTE FUNCTION audit_purchase_link();
CREATE TRIGGER audit_maintenance_purchase_link AFTER INSERT OR UPDATE ON "Maintenance" FOR EACH ROW EXECUTE FUNCTION audit_purchase_link();
