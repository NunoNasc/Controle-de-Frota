-- Prisma's timestamp columns represent UTC, independently of the database session timezone.
ALTER TABLE "IncidentEvent" ALTER COLUMN "createdAt" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC');
ALTER TABLE "IncidentAttachment" ALTER COLUMN "createdAt" SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC');
