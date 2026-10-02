CREATE TABLE "PreventivePlan" (
 id TEXT PRIMARY KEY,"vehicleId" TEXT NOT NULL UNIQUE REFERENCES "Vehicle"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 "intervalKm" INTEGER,"lastMileage" INTEGER,"nextMileage" INTEGER,"lastAt" TIMESTAMP(3),"dueAt" TIMESTAMP(3),
 "toleranceKm" INTEGER NOT NULL DEFAULT 0,"toleranceDays" INTEGER NOT NULL DEFAULT 0,"upcomingKm" INTEGER NOT NULL DEFAULT 1000,"upcomingDays" INTEGER NOT NULL DEFAULT 7,
 revision INTEGER NOT NULL DEFAULT 0,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT preventive_ranges CHECK (("intervalKm" IS NULL OR "intervalKm">0) AND ("lastMileage" IS NULL OR "lastMileage">=0) AND ("nextMileage" IS NULL OR "nextMileage">=0) AND "toleranceKm">=0 AND "toleranceDays">=0 AND "upcomingKm">=0 AND "upcomingDays">=0)
);
CREATE TABLE "PreventivePlanEvent" (id TEXT PRIMARY KEY,"planId" TEXT NOT NULL REFERENCES "PreventivePlan"(id) ON DELETE RESTRICT ON UPDATE CASCADE,actor TEXT NOT NULL,note TEXT NOT NULL,"before" JSONB,"after" JSONB NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "PreventivePlanEvent_planId_createdAt_idx" ON "PreventivePlanEvent"("planId","createdAt");
CREATE TRIGGER preventive_history_immutable BEFORE UPDATE ON "PreventivePlanEvent" FOR EACH ROW EXECUTE FUNCTION reject_history_update();
CREATE TABLE "MileageReading" (id TEXT PRIMARY KEY,"vehicleId" TEXT NOT NULL REFERENCES "Vehicle"(id) ON DELETE RESTRICT ON UPDATE CASCADE,"checklistId" TEXT UNIQUE REFERENCES "Checklist"(id) ON DELETE RESTRICT ON UPDATE CASCADE,mileage INTEGER NOT NULL,"previousMileage" INTEGER,accepted BOOLEAN NOT NULL,source TEXT NOT NULL,actor TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT reading_ranges CHECK(mileage>=0 AND ("previousMileage" IS NULL OR "previousMileage">=0)));
CREATE INDEX "MileageReading_vehicleId_createdAt_idx" ON "MileageReading"("vehicleId","createdAt");
CREATE TRIGGER mileage_history_immutable BEFORE UPDATE ON "MileageReading" FOR EACH ROW EXECUTE FUNCTION reject_history_update();
ALTER TABLE "Alert" ADD COLUMN "preventivePlanId" TEXT UNIQUE REFERENCES "PreventivePlan"(id) ON DELETE RESTRICT ON UPDATE CASCADE, ADD COLUMN "mileageReadingId" TEXT UNIQUE REFERENCES "MileageReading"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
INSERT INTO "MileageReading"(id,"vehicleId",mileage,accepted,source,actor) SELECT gen_random_uuid()::text,id,mileage,true,'BASELINE','Sistema: valor cadastrado antes do histórico' FROM "Vehicle" WHERE mileage IS NOT NULL;
INSERT INTO "PreventivePlan"(id,"vehicleId","lastAt","nextMileage","dueAt","updatedAt") SELECT gen_random_uuid()::text,id,"lastPreventiveAt","nextPreventiveMileage","nextPreventiveAt",CURRENT_TIMESTAMP FROM "Vehicle" WHERE "lastPreventiveAt" IS NOT NULL OR "nextPreventiveMileage" IS NOT NULL OR "nextPreventiveAt" IS NOT NULL;
INSERT INTO "PreventivePlanEvent"(id,"planId",actor,note,"after") SELECT gen_random_uuid()::text,id,'Sistema','Valores anteriores preservados; intervalo e última quilometragem não inferidos.',to_jsonb(p) FROM "PreventivePlan" p;
