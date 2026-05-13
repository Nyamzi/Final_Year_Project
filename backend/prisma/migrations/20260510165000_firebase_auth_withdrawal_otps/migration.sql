ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "firebase_uid" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_firebase_uid_key" ON "User"("firebase_uid");

CREATE TABLE IF NOT EXISTS "WithdrawalOtp" (
  "id" TEXT NOT NULL,
  "withdrawalRequestId" TEXT NOT NULL,
  "parentId" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WithdrawalOtp_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WithdrawalOtp_withdrawalRequestId_idx" ON "WithdrawalOtp"("withdrawalRequestId");
CREATE INDEX IF NOT EXISTS "WithdrawalOtp_parentId_idx" ON "WithdrawalOtp"("parentId");
CREATE INDEX IF NOT EXISTS "WithdrawalOtp_email_idx" ON "WithdrawalOtp"("email");

DO $$ BEGIN
  ALTER TABLE "WithdrawalOtp" ADD CONSTRAINT "WithdrawalOtp_withdrawalRequestId_fkey"
  FOREIGN KEY ("withdrawalRequestId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "WithdrawalOtp" ADD CONSTRAINT "WithdrawalOtp_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
