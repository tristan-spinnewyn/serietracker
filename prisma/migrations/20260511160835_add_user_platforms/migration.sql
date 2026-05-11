-- AlterTable
ALTER TABLE "User" ADD COLUMN     "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[];
