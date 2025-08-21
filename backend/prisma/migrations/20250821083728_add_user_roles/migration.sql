-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('PLAYER', 'ADMIN', 'MODERATOR');

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "role" "public"."UserRole" NOT NULL DEFAULT 'PLAYER';
