-- CreateTable
CREATE TABLE "public"."player_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "autoCashoutEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoCashoutMultiplier" DECIMAL(8,2) NOT NULL DEFAULT 2.0,
    "soundEnabled" BOOLEAN NOT NULL DEFAULT true,
    "dailyLimitsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maxDailyWager" DECIMAL(10,2) NOT NULL DEFAULT 10000,
    "maxDailyLoss" DECIMAL(10,2) NOT NULL DEFAULT 5000,
    "maxGamesPerDay" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "player_settings_userId_key" ON "public"."player_settings"("userId");

-- AddForeignKey
ALTER TABLE "public"."player_settings" ADD CONSTRAINT "player_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
