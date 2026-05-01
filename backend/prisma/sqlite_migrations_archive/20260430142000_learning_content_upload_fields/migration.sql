-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN "resourceType" TEXT NOT NULL DEFAULT 'text';
ALTER TABLE "Lesson" ADD COLUMN "resourceUrl" TEXT;
ALTER TABLE "Lesson" ADD COLUMN "fileName" TEXT;
