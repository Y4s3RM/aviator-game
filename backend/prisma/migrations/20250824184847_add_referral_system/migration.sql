/*
  Warnings:

  - A unique constraint covering the columns `[referralCode]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."ReferralStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PAID');

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "referralJoinRewardClaimed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "referredBy" TEXT,
ADD COLUMN     "referredByUserId" TEXT;

-- CreateTable
CREATE TABLE "public"."referrals" (
    "id" TEXT NOT NULL,
    "referrerUserId" TEXT NOT NULL,
    "inviteeUserId" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "ip" TEXT,
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activationEventAt" TIMESTAMP(3),
    "referrerRewardStatus" "public"."ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "inviteeRewardPaid" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "referrals_inviteeUserId_key" ON "public"."referrals"("inviteeUserId");

-- CreateIndex
CREATE UNIQUE INDEX "users_referralCode_key" ON "public"."users"("referralCode");

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_referredByUserId_fkey" FOREIGN KEY ("referredByUserId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."referrals" ADD CONSTRAINT "referrals_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."referrals" ADD CONSTRAINT "referrals_inviteeUserId_fkey" FOREIGN KEY ("inviteeUserId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
