-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "Sex" AS ENUM ('male', 'female');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sex" "Sex";
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profileImageUrl" TEXT;
