CREATE TABLE "ChecklistEvaluation" (
 "id" TEXT PRIMARY KEY, "answerId" TEXT NOT NULL UNIQUE REFERENCES "ChecklistAnswer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "incidentId" TEXT UNIQUE REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "priority" "Priority" NOT NULL, "createsIncident" BOOLEAN NOT NULL, "blocksVehicle" BOOLEAN NOT NULL,
 "ruleSnapshot" JSONB NOT NULL, "configVersion" TEXT NOT NULL, "engineVersion" TEXT NOT NULL,
 "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "vehicleStatusBefore" "VehicleStatus" NOT NULL, "vehicleStatusAfter" "VehicleStatus" NOT NULL,
 "availabilityBefore" "Availability" NOT NULL, "availabilityAfter" "Availability" NOT NULL,
 CONSTRAINT "ChecklistEvaluation_incident_decision" CHECK ("createsIncident" = ("incidentId" IS NOT NULL))
);
CREATE INDEX "ChecklistEvaluation_priority_evaluatedAt_idx" ON "ChecklistEvaluation"("priority","evaluatedAt");
ALTER TABLE "Alert" ADD COLUMN "evaluationId" TEXT UNIQUE REFERENCES "ChecklistEvaluation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Existing answers/incidents remain unchanged. Historical processing is not fabricated.
