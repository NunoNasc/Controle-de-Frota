CREATE TABLE "FuelRecord" (
 id TEXT PRIMARY KEY,"vehicleId" TEXT NOT NULL REFERENCES "Vehicle"(id) ON DELETE RESTRICT ON UPDATE CASCADE,"submissionKey" TEXT NOT NULL UNIQUE,
 "fueledAt" TIMESTAMP(3) NOT NULL,mileage INTEGER NOT NULL,"fuelType" TEXT NOT NULL,liters DECIMAL(10,3) NOT NULL,amount DECIMAL(12,2) NOT NULL,
 station TEXT NOT NULL DEFAULT '',notes TEXT NOT NULL DEFAULT '',actor TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fuel_positive_values CHECK(mileage>=0 AND liters>0 AND amount>=0)
);
CREATE INDEX "FuelRecord_vehicleId_fueledAt_idx" ON "FuelRecord"("vehicleId","fueledAt");
CREATE TRIGGER fuel_history_immutable BEFORE UPDATE ON "FuelRecord" FOR EACH ROW EXECUTE FUNCTION reject_history_update();
