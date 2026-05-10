CREATE TABLE IF NOT EXISTS "GameScore" (
  "id" TEXT NOT NULL,
  "childId" TEXT NOT NULL,
  "childUserId" UUID NOT NULL,
  "gameName" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "maxScore" INTEGER NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GameScore_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GameScore_childId_completedAt_idx" ON "GameScore"("childId", "completedAt");
CREATE INDEX IF NOT EXISTS "GameScore_gameName_idx" ON "GameScore"("gameName");

ALTER TABLE "GameScore"
  ADD CONSTRAINT "GameScore_childId_fkey"
  FOREIGN KEY ("childId") REFERENCES "ChildProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GameScore"
  ADD CONSTRAINT "GameScore_childUserId_fkey"
  FOREIGN KEY ("childUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
