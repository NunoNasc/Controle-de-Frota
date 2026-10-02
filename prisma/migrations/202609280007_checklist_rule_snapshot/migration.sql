ALTER TABLE "ChecklistAnswer" ADD COLUMN "incidentRule" BOOLEAN NOT NULL DEFAULT false;
UPDATE "ChecklistAnswer" SET "incidentRule" = true WHERE "configItemId" IS NULL;
UPDATE "ChecklistAnswer" a SET "requiresPhoto" = true FROM "Checklist" c
 WHERE a."checklistId" = c.id AND a."configItemId" IS NULL AND c."driverIdentification" IS NOT NULL;
