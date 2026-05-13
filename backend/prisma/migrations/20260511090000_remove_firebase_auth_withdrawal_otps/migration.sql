DROP TABLE IF EXISTS "WithdrawalOtp";
DROP INDEX IF EXISTS "User_firebase_uid_key";
ALTER TABLE "User" DROP COLUMN IF EXISTS "firebase_uid";
