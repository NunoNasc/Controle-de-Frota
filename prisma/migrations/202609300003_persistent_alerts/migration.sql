CREATE TYPE "AlertCategory" AS ENUM ('CHECKLIST','MAINTENANCE','PREVENTIVE','DOCUMENT','PURCHASE','TIRE','INCIDENT');
CREATE TYPE "AlertStage" AS ENUM ('NEW','IN_PROGRESS','RESOLVED','HANDLED','NOT_APPLICABLE','RULE_CLOSED');
ALTER TABLE "Alert" ADD COLUMN category "AlertCategory" NOT NULL DEFAULT 'CHECKLIST', ADD COLUMN stage "AlertStage" NOT NULL DEFAULT 'NEW', ADD COLUMN revision INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, ADD COLUMN "closedAt" TIMESTAMP(3), ADD COLUMN "closingReason" TEXT NOT NULL DEFAULT '',
ADD COLUMN "actionRequired" TEXT NOT NULL DEFAULT 'Avaliar o registro de origem e registrar o atendimento.', ADD COLUMN "responsibleId" TEXT REFERENCES "StaffMember"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
ADD COLUMN "sourceKey" TEXT, ADD COLUMN "sourceActive" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN "sourceHref" TEXT;
UPDATE "Alert" SET category=CASE WHEN "evaluationId" IS NOT NULL THEN 'CHECKLIST' WHEN module='manutencoes' THEN 'MAINTENANCE' WHEN module='preventivas' THEN 'PREVENTIVE' WHEN module='documentos' THEN 'DOCUMENT' WHEN module='compras' THEN 'PURCHASE' WHEN module='pneus' THEN 'TIRE' WHEN module='ocorrencias' THEN 'INCIDENT' ELSE 'CHECKLIST' END::"AlertCategory",
stage=CASE status WHEN 'IN_PROGRESS' THEN 'IN_PROGRESS' WHEN 'COMPLETED' THEN 'RULE_CLOSED' WHEN 'CANCELED' THEN 'RULE_CLOSED' ELSE 'NEW' END::"AlertStage",
"openedAt"="createdAt", "closedAt"=CASE WHEN status IN ('COMPLETED','CANCELED') THEN "updatedAt" END,
"closingReason"=CASE WHEN status IN ('COMPLETED','CANCELED') THEN 'Encerramento anterior preservado; critério e horário exato não disponíveis. Data da última atualização utilizada.' ELSE '' END,
"sourceActive"=status IN ('OPEN','IN_PROGRESS');
CREATE UNIQUE INDEX "Alert_sourceKey_key" ON "Alert"("sourceKey");
CREATE INDEX "Alert_stage_priority_openedAt_idx" ON "Alert"(stage,priority,"openedAt");
CREATE INDEX "Alert_category_openedAt_idx" ON "Alert"(category,"openedAt");
CREATE INDEX "Alert_responsibleId_idx" ON "Alert"("responsibleId");
CREATE TABLE "AlertEvent" (id TEXT PRIMARY KEY,"alertId" TEXT NOT NULL REFERENCES "Alert"(id) ON DELETE RESTRICT ON UPDATE CASCADE,actor TEXT NOT NULL,note TEXT NOT NULL,"before" JSONB,"after" JSONB NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'));
CREATE INDEX "AlertEvent_alertId_createdAt_idx" ON "AlertEvent"("alertId","createdAt");
INSERT INTO "AlertEvent"(id,"alertId",actor,note,"after") SELECT gen_random_uuid()::text,id,'Sistema','Registro anterior preservado na implantação da Central de Alertas; histórico anterior não reconstruído.',to_jsonb(a) FROM "Alert" a;
CREATE TRIGGER alert_history_immutable BEFORE UPDATE ON "AlertEvent" FOR EACH ROW EXECUTE FUNCTION reject_history_update();
CREATE FUNCTION alert_workflow() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  NEW.category:=CASE WHEN NEW."evaluationId" IS NOT NULL THEN 'CHECKLIST' WHEN NEW.module='manutencoes' THEN 'MAINTENANCE' WHEN NEW.module='preventivas' THEN 'PREVENTIVE' WHEN NEW.module='documentos' THEN 'DOCUMENT' WHEN NEW.module='compras' THEN 'PURCHASE' WHEN NEW.module='pneus' THEN 'TIRE' WHEN NEW.module='ocorrencias' THEN 'INCIDENT' ELSE NEW.category::text END::"AlertCategory";
  IF NEW.stage='NEW' THEN NEW.stage:=CASE NEW.status WHEN 'IN_PROGRESS' THEN 'IN_PROGRESS' WHEN 'COMPLETED' THEN 'RULE_CLOSED' WHEN 'CANCELED' THEN 'RULE_CLOSED' ELSE 'NEW' END::"AlertStage"; END IF;
 ELSE
  IF NEW.stage=OLD.stage AND NEW.status<>OLD.status THEN NEW.stage:=CASE NEW.status WHEN 'IN_PROGRESS' THEN 'IN_PROGRESS' WHEN 'COMPLETED' THEN 'RULE_CLOSED' WHEN 'CANCELED' THEN 'RULE_CLOSED' ELSE 'NEW' END::"AlertStage"; END IF;
  NEW.revision:=OLD.revision+1;
  NEW."openedAt":=CASE WHEN OLD.stage NOT IN ('NEW','IN_PROGRESS') AND NEW.stage IN ('NEW','IN_PROGRESS') THEN clock_timestamp() AT TIME ZONE 'UTC' ELSE OLD."openedAt" END;
 END IF;
 NEW.status:=CASE WHEN NEW.stage='NEW' THEN 'OPEN' WHEN NEW.stage='IN_PROGRESS' THEN 'IN_PROGRESS' WHEN NEW.stage='NOT_APPLICABLE' THEN 'CANCELED' ELSE 'COMPLETED' END::"WorkStatus";
 IF NEW.stage IN ('NEW','IN_PROGRESS') THEN NEW."closedAt":=NULL; NEW."closingReason":='';
 ELSE
  NEW."closedAt":=COALESCE(NEW."closedAt",clock_timestamp() AT TIME ZONE 'UTC');
  IF NEW."closingReason"='' THEN NEW."closingReason":=COALESCE(NULLIF(current_setting('fleet.alert_reason',true),''),NULLIF(current_setting('fleet.reason',true),''),'Encerrado conforme atualização do registro de origem.'); END IF;
 END IF;
 NEW."updatedAt":=clock_timestamp() AT TIME ZONE 'UTC';
 RETURN NEW;
END $$;
CREATE TRIGGER alert_workflow BEFORE INSERT OR UPDATE ON "Alert" FOR EACH ROW EXECUTE FUNCTION alert_workflow();
CREATE FUNCTION audit_alert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO "AlertEvent"(id,"alertId",actor,note,"before","after") VALUES(gen_random_uuid()::text,NEW.id,COALESCE(NULLIF(current_setting('fleet.actor',true),''),'Sistema'),COALESCE(NULLIF(current_setting('fleet.alert_reason',true),''),NULLIF(current_setting('fleet.reason',true),''),CASE WHEN TG_OP='INSERT' THEN 'Alerta registrado' ELSE 'Alerta atualizado pelo registro de origem' END),CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,to_jsonb(NEW)||jsonb_build_object('responsibleName',(SELECT name FROM "StaffMember" WHERE id=NEW."responsibleId")));
 RETURN NEW;
END $$;
CREATE TRIGGER audit_alert AFTER INSERT OR UPDATE ON "Alert" FOR EACH ROW EXECUTE FUNCTION audit_alert();
