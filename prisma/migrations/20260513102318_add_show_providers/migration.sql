-- AlterTable
ALTER TABLE "Show" ADD COLUMN     "providers" TEXT[] DEFAULT ARRAY[]::TEXT[];
