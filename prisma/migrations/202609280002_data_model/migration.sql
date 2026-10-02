-- Reviewed, non-destructive evolution. Abort atomically on unknown legacy values.
BEGIN;

-- CreateEnum
CREATE TYPE "Availability" AS ENUM ('AVAILABLE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ChecklistType" AS ENUM ('UNSPECIFIED', 'PRE_TRIP', 'POST_TRIP', 'PERIODIC', 'EXTRAORDINARY');

-- CreateEnum
CREATE TYPE "ChecklistStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REVIEWED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ChecklistResult" AS ENUM ('OK', 'ISSUE', 'NOT_EVALUATED');

-- CreateEnum
CREATE TYPE "ChecklistResponse" AS ENUM ('OK', 'ISSUE', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "InspectionCategory" AS ENUM ('TIRES', 'LIGHTING', 'BRAKES', 'FLUIDS', 'SAFETY', 'BODY', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentOrigin" AS ENUM ('UNSPECIFIED', 'MANUAL', 'CHECKLIST', 'MAINTENANCE');

-- AlterTable
ALTER TABLE "Alert" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Checklist" ADD COLUMN     "conformityPercentage" DECIMAL(5,2),
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "hasProblem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "latitude" DECIMAL(10,7),
ADD COLUMN     "locationAccuracy" DECIMAL(10,2),
ADD COLUMN     "locationLabel" TEXT,
ADD COLUMN     "longitude" DECIMAL(10,7),
ADD COLUMN     "status" "ChecklistStatus" NOT NULL DEFAULT 'SUBMITTED',
ADD COLUMN     "type" "ChecklistType" NOT NULL DEFAULT 'PRE_TRIP',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Checklist" ALTER COLUMN "result" TYPE "ChecklistResult" USING "result"::"ChecklistResult";

-- AlterTable
ALTER TABLE "ChecklistAnswer" ADD COLUMN     "category" "InspectionCategory" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "generatesIncident" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "incidentId" TEXT,
ADD COLUMN     "notes" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "priority" "Priority" NOT NULL DEFAULT 'LOW',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ChecklistAnswer" ALTER COLUMN "answer" TYPE "ChecklistResponse" USING "answer"::"ChecklistResponse";

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Driver" ADD COLUMN     "phone" TEXT,
ADD COLUMN     "status" "DriverStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "category" "InspectionCategory" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "checklistId" TEXT,
ADD COLUMN     "driverId" TEXT,
ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "number" SERIAL NOT NULL,
ADD COLUMN     "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "origin" "IncidentOrigin" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "responsibleId" TEXT,
ADD COLUMN     "solution" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "vehicleBlocked" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Maintenance" ADD COLUMN     "approvedAmount" DECIMAL(12,2),
ADD COLUMN     "budget" DECIMAL(12,2),
ADD COLUMN     "category" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "enteredAt" TIMESTAMP(3),
ADD COLUMN     "expectedAt" TIMESTAMP(3),
ADD COLUMN     "incidentId" TEXT,
ADD COLUMN     "mileage" INTEGER,
ADD COLUMN     "purchaseOrderId" TEXT,
ADD COLUMN     "requisitionId" TEXT,
ADD COLUMN     "responsibleId" TEXT,
ADD COLUMN     "serviceOrder" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Preventive" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "equipmentId" TEXT,
ADD COLUMN     "notes" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "requesterId" TEXT,
ADD COLUMN     "requisitionId" TEXT,
ADD COLUMN     "responsibleId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Setting" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "status" "SupplierStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "tradeName" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Tire" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "availability" "Availability" NOT NULL DEFAULT 'AVAILABLE',
ADD COLUMN     "brand" TEXT,
ADD COLUMN     "costCenterId" TEXT,
ADD COLUMN     "lastPreventiveAt" TIMESTAMP(3),
ADD COLUMN     "nextPreventiveAt" TIMESTAMP(3),
ADD COLUMN     "nextPreventiveMileage" INTEGER,
ADD COLUMN     "notes" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "CostCenter" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffMember" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "costCenterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequisition" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requesterId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseRequisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT,
    "checklistAnswerId" TEXT,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CostCenter_code_key" ON "CostCenter"("code");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMember_employeeId_key" ON "StaffMember"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_code_key" ON "Equipment"("code");

-- CreateIndex
CREATE INDEX "Equipment_costCenterId_idx" ON "Equipment"("costCenterId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequisition_number_key" ON "PurchaseRequisition"("number");

-- CreateIndex
CREATE INDEX "PurchaseRequisition_requesterId_idx" ON "PurchaseRequisition"("requesterId");

-- CreateIndex
CREATE INDEX "Evidence_incidentId_idx" ON "Evidence"("incidentId");

-- CreateIndex
CREATE INDEX "Evidence_checklistAnswerId_idx" ON "Evidence"("checklistAnswerId");

-- CreateIndex
CREATE INDEX "Checklist_driverId_submittedAt_idx" ON "Checklist"("driverId", "submittedAt");

-- CreateIndex
CREATE INDEX "Checklist_status_hasProblem_idx" ON "Checklist"("status", "hasProblem");

-- CreateIndex
CREATE INDEX "ChecklistAnswer_incidentId_idx" ON "ChecklistAnswer"("incidentId");

-- CreateIndex
CREATE INDEX "Driver_active_status_idx" ON "Driver"("active", "status");

-- CreateIndex
CREATE INDEX "Driver_expiresAt_idx" ON "Driver"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_number_key" ON "Incident"("number");

-- CreateIndex
CREATE INDEX "Incident_vehicleId_openedAt_idx" ON "Incident"("vehicleId", "openedAt");

-- CreateIndex
CREATE INDEX "Incident_driverId_idx" ON "Incident"("driverId");

-- CreateIndex
CREATE INDEX "Incident_checklistId_idx" ON "Incident"("checklistId");

-- CreateIndex
CREATE INDEX "Incident_responsibleId_status_idx" ON "Incident"("responsibleId", "status");

-- CreateIndex
CREATE INDEX "Incident_dueAt_idx" ON "Incident"("dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "Maintenance_serviceOrder_key" ON "Maintenance"("serviceOrder");

-- CreateIndex
CREATE INDEX "Maintenance_vehicleId_idx" ON "Maintenance"("vehicleId");

-- CreateIndex
CREATE INDEX "Maintenance_supplierId_idx" ON "Maintenance"("supplierId");

-- CreateIndex
CREATE INDEX "Maintenance_requisitionId_idx" ON "Maintenance"("requisitionId");

-- CreateIndex
CREATE INDEX "Maintenance_purchaseOrderId_idx" ON "Maintenance"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "Maintenance_incidentId_idx" ON "Maintenance"("incidentId");

-- CreateIndex
CREATE INDEX "Maintenance_responsibleId_idx" ON "Maintenance"("responsibleId");

-- CreateIndex
CREATE INDEX "Maintenance_expectedAt_idx" ON "Maintenance"("expectedAt");

-- CreateIndex
CREATE INDEX "PurchaseOrder_requisitionId_idx" ON "PurchaseOrder"("requisitionId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_vehicleId_idx" ON "PurchaseOrder"("vehicleId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_equipmentId_idx" ON "PurchaseOrder"("equipmentId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_requesterId_idx" ON "PurchaseOrder"("requesterId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_responsibleId_idx" ON "PurchaseOrder"("responsibleId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_requestedAt_idx" ON "PurchaseOrder"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "Supplier_status_idx" ON "Supplier"("status");

-- CreateIndex
CREATE INDEX "Vehicle_costCenterId_idx" ON "Vehicle"("costCenterId");

-- CreateIndex
CREATE INDEX "Vehicle_active_availability_idx" ON "Vehicle"("active", "availability");

-- CreateIndex
CREATE INDEX "Vehicle_nextPreventiveAt_idx" ON "Vehicle"("nextPreventiveAt");

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisition" ADD CONSTRAINT "PurchaseRequisition_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistAnswer" ADD CONSTRAINT "ChecklistAnswer_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "Checklist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_checklistAnswerId_fkey" FOREIGN KEY ("checklistAnswerId") REFERENCES "ChecklistAnswer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Maintenance" ADD CONSTRAINT "Maintenance_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "PurchaseRequisition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Maintenance" ADD CONSTRAINT "Maintenance_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Maintenance" ADD CONSTRAINT "Maintenance_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Maintenance" ADD CONSTRAINT "Maintenance_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "PurchaseRequisition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill ONLY newly introduced columns. Existing values and timestamps remain intact.
UPDATE "Vehicle" SET
  "active" = "status" <> 'INACTIVE',
  "availability" = CASE WHEN "status" IN ('AVAILABLE', 'IN_USE') THEN 'AVAILABLE'::"Availability" ELSE 'UNAVAILABLE'::"Availability" END,
  "lastPreventiveAt" = (SELECT MAX(m."completedAt") FROM "Maintenance" m WHERE m."vehicleId" = "Vehicle"."id" AND m."type" = 'Preventiva' AND m."status" = 'COMPLETED'),
  "nextPreventiveMileage" = (SELECT MIN(p."dueMileage") FROM "Preventive" p WHERE p."vehicleId" = "Vehicle"."id" AND p."completedAt" IS NULL),
  "nextPreventiveAt" = (SELECT MIN(p."dueAt") FROM "Preventive" p WHERE p."vehicleId" = "Vehicle"."id" AND p."completedAt" IS NULL);

UPDATE "Driver" SET "status" = CASE WHEN "active" THEN 'ACTIVE'::"DriverStatus" ELSE 'INACTIVE'::"DriverStatus" END, "updatedAt" = "createdAt";
UPDATE "Supplier" SET "status" = CASE WHEN "active" THEN 'ACTIVE'::"SupplierStatus" ELSE 'INACTIVE'::"SupplierStatus" END;

UPDATE "Checklist" c SET
  "type" = 'UNSPECIFIED',
  "createdAt" = c."submittedAt", "updatedAt" = c."submittedAt",
  "hasProblem" = c."result" = 'ISSUE' OR EXISTS (SELECT 1 FROM "ChecklistAnswer" a WHERE a."checklistId" = c."id" AND a."answer" = 'ISSUE'),
  "conformityPercentage" = (SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE a."answer" = 'OK') / NULLIF(COUNT(*) FILTER (WHERE a."answer" <> 'NOT_APPLICABLE'), 0), 2) FROM "ChecklistAnswer" a WHERE a."checklistId" = c."id");

UPDATE "ChecklistAnswer" a SET
  "category" = CASE a."item" WHEN 'tires' THEN 'TIRES' WHEN 'lights' THEN 'LIGHTING' WHEN 'brakes' THEN 'BRAKES' WHEN 'fluids' THEN 'FLUIDS' WHEN 'safety' THEN 'SAFETY' WHEN 'body' THEN 'BODY' ELSE 'OTHER' END::"InspectionCategory",
  "priority" = CASE WHEN a."item" = 'brakes' THEN 'CRITICAL' WHEN a."item" IN ('tires','lights','fluids','safety','body') THEN 'HIGH' ELSE 'LOW' END::"Priority",
  "generatesIncident" = a."answer" = 'ISSUE',
  "createdAt" = c."submittedAt", "updatedAt" = c."submittedAt"
FROM "Checklist" c WHERE c."id" = a."checklistId";

UPDATE "Incident" SET "openedAt" = "createdAt", "updatedAt" = "createdAt", "origin" = 'UNSPECIFIED';
-- Recover links only when the old API stored an exact checklist protocol, never by plate/date proximity.
UPDATE "Incident" i SET "checklistId" = c."id", "driverId" = c."driverId", "origin" = 'CHECKLIST', "vehicleBlocked" = i."priority" = 'CRITICAL'
FROM "Checklist" c WHERE i."description" = 'Protocolo ' || c."id" AND i."vehicleId" = c."vehicleId";
UPDATE "ChecklistAnswer" a SET "incidentId" = i."id" FROM "Incident" i
WHERE a."checklistId" = i."checklistId" AND a."answer" = 'ISSUE'
  AND (SELECT COUNT(*) FROM "Incident" related WHERE related."checklistId" = i."checklistId") = 1;

UPDATE "Maintenance" SET "description" = "title", "budget" = "cost";
UPDATE "PurchaseOrder" SET "requestedAt" = "createdAt", "updatedAt" = "createdAt";
UPDATE "Alert" SET "updatedAt" = "createdAt";

-- Business constraints not expressible in Prisma schema syntax.
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_nonnegative_mileage" CHECK ("mileage" >= 0 AND ("nextPreventiveMileage" IS NULL OR "nextPreventiveMileage" >= 0));
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_available_requires_operational" CHECK ("availability" <> 'AVAILABLE' OR ("active" AND "status" IN ('AVAILABLE','IN_USE')));
ALTER TABLE "Checklist" ADD CONSTRAINT "Checklist_nonnegative_mileage" CHECK ("mileage" >= 0);
ALTER TABLE "Checklist" ADD CONSTRAINT "Checklist_conformity_range" CHECK ("conformityPercentage" IS NULL OR "conformityPercentage" BETWEEN 0 AND 100);
ALTER TABLE "Checklist" ADD CONSTRAINT "Checklist_location_valid" CHECK (
  ("latitude" IS NULL) = ("longitude" IS NULL)
  AND ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90)
  AND ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180)
  AND ("locationAccuracy" IS NULL OR ("latitude" IS NOT NULL AND "locationAccuracy" >= 0))
);
ALTER TABLE "Maintenance" ADD CONSTRAINT "Maintenance_nonnegative_values" CHECK ("cost" >= 0 AND ("budget" IS NULL OR "budget" >= 0) AND ("approvedAmount" IS NULL OR "approvedAmount" >= 0) AND ("mileage" IS NULL OR "mileage" >= 0));
ALTER TABLE "Maintenance" ADD CONSTRAINT "Maintenance_valid_dates" CHECK ("enteredAt" IS NULL OR (("expectedAt" IS NULL OR "expectedAt" >= "enteredAt") AND ("completedAt" IS NULL OR "completedAt" >= "enteredAt")));
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_nonnegative_amount" CHECK ("amount" >= 0);
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_single_asset" CHECK ("vehicleId" IS NULL OR "equipmentId" IS NULL);
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_exactly_one_parent" CHECK (num_nonnulls("incidentId", "checklistAnswerId") = 1);
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_nonnegative_size" CHECK ("sizeBytes" IS NULL OR "sizeBytes" >= 0);
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_valid_dates" CHECK (("dueAt" IS NULL OR "dueAt" >= "openedAt") AND ("resolvedAt" IS NULL OR "resolvedAt" >= "openedAt"));

COMMIT;
