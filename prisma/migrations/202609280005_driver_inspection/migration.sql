ALTER TABLE "Checklist" ADD COLUMN "driverIdentification" TEXT;
ALTER TABLE "ChecklistAnswer" ADD COLUMN "problemType" TEXT;
ALTER TABLE "Evidence" ADD COLUMN "content" BYTEA;
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_content_size" CHECK ("content" IS NULL OR (octet_length("content") <= 450000 AND octet_length("content") = "sizeBytes" AND "mimeType" = 'image/jpeg'));
