-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('SEQUEL', 'PREQUEL', 'SPINOFF', 'ALTERNATIVE', 'PARENT', 'RELATED');

-- CreateTable
CREATE TABLE "ShowRelation" (
    "id" TEXT NOT NULL,
    "fromShowId" TEXT NOT NULL,
    "toShowId" TEXT NOT NULL,
    "type" "RelationType" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ShowRelation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShowRelation_fromShowId_idx" ON "ShowRelation"("fromShowId");

-- CreateIndex
CREATE INDEX "ShowRelation_toShowId_idx" ON "ShowRelation"("toShowId");

-- CreateIndex
CREATE UNIQUE INDEX "ShowRelation_fromShowId_toShowId_key" ON "ShowRelation"("fromShowId", "toShowId");

-- AddForeignKey
ALTER TABLE "ShowRelation" ADD CONSTRAINT "ShowRelation_fromShowId_fkey" FOREIGN KEY ("fromShowId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowRelation" ADD CONSTRAINT "ShowRelation_toShowId_fkey" FOREIGN KEY ("toShowId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;
