ALTER TABLE "Vehicle" ADD COLUMN "qrRevision" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "qrRotatedAt" TIMESTAMP(3);
CREATE TABLE "VehicleQrEvent" (id TEXT PRIMARY KEY,"vehicleId" TEXT NOT NULL REFERENCES "Vehicle"(id) ON DELETE RESTRICT ON UPDATE CASCADE,actor TEXT NOT NULL,reason TEXT NOT NULL,"previousFingerprint" TEXT,"nextFingerprint" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "VehicleQrEvent_vehicleId_createdAt_idx" ON "VehicleQrEvent"("vehicleId","createdAt");
INSERT INTO "VehicleQrEvent"(id,"vehicleId",actor,reason,"nextFingerprint") SELECT gen_random_uuid()::text,id,'Sistema','Credencial existente preservada na implantação do gerenciamento de QR Codes.',encode(sha256(convert_to("qrToken",'UTF8')),'hex') FROM "Vehicle";
CREATE TRIGGER vehicle_qr_history_immutable BEFORE UPDATE ON "VehicleQrEvent" FOR EACH ROW EXECUTE FUNCTION reject_history_update();
