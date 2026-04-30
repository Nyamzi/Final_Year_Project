ALTER TABLE "SavingsGoal" ADD COLUMN "completedAt" DATETIME;

UPDATE "SavingsGoal"
SET
  "status" = 'completed',
  "completedAt" = COALESCE("completedAt", CURRENT_TIMESTAMP)
WHERE
  "status" = 'completed'
  OR "currentAmount" >= "targetAmount"
  OR "id" IN (
    SELECT "savingsGoalId"
    FROM "Transaction"
    WHERE "savingsGoalId" IS NOT NULL
      AND "withdrawalSource" = 'goal'
  );
