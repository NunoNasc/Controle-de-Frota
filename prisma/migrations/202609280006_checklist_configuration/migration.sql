CREATE TABLE "ChecklistCategory" (
 "id" TEXT PRIMARY KEY, "code" TEXT NOT NULL UNIQUE, "name" TEXT NOT NULL,
 "sortOrder" INTEGER NOT NULL DEFAULT 0, "inspectionCategory" "InspectionCategory" NOT NULL DEFAULT 'OTHER',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "ChecklistItemConfig" (
 "id" TEXT PRIMARY KEY, "categoryId" TEXT NOT NULL REFERENCES "ChecklistCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "label" TEXT NOT NULL, "help" TEXT NOT NULL DEFAULT '', "problems" TEXT[] NOT NULL,
 "priority" "Priority" NOT NULL DEFAULT 'MEDIUM', "requiresPhoto" BOOLEAN NOT NULL DEFAULT true,
 "generatesIncident" BOOLEAN NOT NULL DEFAULT true, "blocksVehicle" BOOLEAN NOT NULL DEFAULT false,
 "allowsNotApplicable" BOOLEAN NOT NULL DEFAULT false, "vehicleTypes" TEXT[] NOT NULL,
 "active" BOOLEAN NOT NULL DEFAULT true, "sortOrder" INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ChecklistItemConfig_problem_options" CHECK(cardinality("problems") BETWEEN 1 AND 20)
);
CREATE INDEX "ChecklistItemConfig_categoryId_active_sortOrder_idx" ON "ChecklistItemConfig"("categoryId","active","sortOrder");
ALTER TABLE "Checklist" ADD COLUMN "configVersion" TEXT;
ALTER TABLE "ChecklistAnswer" ADD COLUMN "configItemId" TEXT REFERENCES "ChecklistItemConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 ADD COLUMN "itemLabel" TEXT, ADD COLUMN "categoryLabel" TEXT, ADD COLUMN "requiresPhoto" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "blocksVehicle" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "allowsNotApplicable" BOOLEAN NOT NULL DEFAULT false;
-- Freeze the presentation of existing inspections; never reinterpret historical answers using live config.
UPDATE "ChecklistAnswer" SET "itemLabel" = CASE "item"
 WHEN 'tire-front-left' THEN 'Dianteiro esquerdo' WHEN 'tire-front-right' THEN 'Dianteiro direito'
 WHEN 'tire-rear-left' THEN 'Traseiros esquerdos' WHEN 'tire-rear-right' THEN 'Traseiros direitos'
 WHEN 'headlights' THEN 'Faróis' WHEN 'signals' THEN 'Setas e pisca-alerta' WHEN 'rear-lights' THEN 'Lanternas e luz de freio'
 WHEN 'brakes' THEN 'Freios' WHEN 'oil' THEN 'Óleo do motor' WHEN 'coolant' THEN 'Arrefecimento'
 WHEN 'seatbelt' THEN 'Cinto de segurança' WHEN 'safety-kit' THEN 'Triângulo e itens obrigatórios'
 WHEN 'mirrors' THEN 'Retrovisores' WHEN 'windshield' THEN 'Para-brisa e limpadores' WHEN 'body' THEN 'Lataria e carroceria'
 WHEN 'tires' THEN 'Pneus e rodas' WHEN 'lights' THEN 'Luzes e sinalização' WHEN 'fluids' THEN 'Óleo e fluidos' WHEN 'safety' THEN 'Itens de segurança' ELSE "item" END,
 "categoryLabel" = CASE "category" WHEN 'TIRES' THEN 'Pneus' WHEN 'LIGHTING' THEN 'Iluminação' WHEN 'BRAKES' THEN 'Freios' WHEN 'FLUIDS' THEN 'Óleo e fluidos' WHEN 'SAFETY' THEN 'Segurança' WHEN 'BODY' THEN 'Condição externa' ELSE 'Outros' END,
 "blocksVehicle" = ("item" = 'brakes');
