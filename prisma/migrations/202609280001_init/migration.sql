-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'MAINTENANCE', 'STOPPED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "WorkStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELED');

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "mileage" INTEGER NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "status" "VehicleStatus" NOT NULL DEFAULT 'AVAILABLE',
    "qrToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "license" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Checklist" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT,
    "driverName" TEXT NOT NULL,
    "mileage" INTEGER NOT NULL,
    "result" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submissionKey" TEXT NOT NULL,

    CONSTRAINT "Checklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistAnswer" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "answer" TEXT NOT NULL,

    CONSTRAINT "ChecklistAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "WorkStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Maintenance" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "supplierId" TEXT,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "WorkStatus" NOT NULL DEFAULT 'OPEN',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "cost" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "Maintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Preventive" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "dueMileage" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Preventive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tire" (
    "id" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "treadMm" DECIMAL(4,1) NOT NULL,
    "status" TEXT NOT NULL,
    "vehicleId" TEXT,

    CONSTRAINT "Tire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "fileUrl" TEXT,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "WorkStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplierId" TEXT,
    "vehicleId" TEXT,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "Priority" NOT NULL,
    "status" "WorkStatus" NOT NULL DEFAULT 'OPEN',
    "module" TEXT NOT NULL,
    "vehicleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_plate_key" ON "Vehicle"("plate");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_code_key" ON "Vehicle"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_qrToken_key" ON "Vehicle"("qrToken");

-- CreateIndex
CREATE INDEX "Vehicle_status_unit_idx" ON "Vehicle"("status", "unit");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_employeeId_key" ON "Driver"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_license_key" ON "Driver"("license");

-- CreateIndex
CREATE UNIQUE INDEX "Checklist_submissionKey_key" ON "Checklist"("submissionKey");

-- CreateIndex
CREATE INDEX "Checklist_vehicleId_submittedAt_idx" ON "Checklist"("vehicleId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistAnswer_checklistId_item_key" ON "ChecklistAnswer"("checklistId", "item");

-- CreateIndex
CREATE INDEX "Incident_status_priority_idx" ON "Incident"("status", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_taxId_key" ON "Supplier"("taxId");

-- CreateIndex
CREATE INDEX "Maintenance_status_scheduledAt_idx" ON "Maintenance"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "Preventive_dueAt_idx" ON "Preventive"("dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "Tire_serial_key" ON "Tire"("serial");

-- CreateIndex
CREATE INDEX "Document_expiresAt_idx" ON "Document"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_number_key" ON "PurchaseOrder"("number");

-- CreateIndex
CREATE INDEX "Alert_status_priority_idx" ON "Alert"("status", "priority");

-- AddForeignKey
ALTER TABLE "Checklist" ADD CONSTRAINT "Checklist_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checklist" ADD CONSTRAINT "Checklist_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistAnswer" ADD CONSTRAINT "ChecklistAnswer_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "Checklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Maintenance" ADD CONSTRAINT "Maintenance_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Maintenance" ADD CONSTRAINT "Maintenance_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Preventive" ADD CONSTRAINT "Preventive_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tire" ADD CONSTRAINT "Tire_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
