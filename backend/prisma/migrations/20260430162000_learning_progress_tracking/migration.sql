ALTER TABLE "ChildLessonAssignment" ADD COLUMN "progressPercent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ChildLessonAssignment" ADD COLUMN "firstViewedAt" DATETIME;
ALTER TABLE "ChildLessonAssignment" ADD COLUMN "lastViewedAt" DATETIME;
ALTER TABLE "ChildLessonAssignment" ADD COLUMN "completedAt" DATETIME;
