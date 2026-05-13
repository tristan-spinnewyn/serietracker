-- AlterTable
ALTER TABLE "Show" ADD COLUMN     "nextSyncAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Show_nextSyncAt_idx" ON "Show"("nextSyncAt");
