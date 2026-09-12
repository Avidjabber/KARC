-- CreateTable
CREATE TABLE "Residence" (
    "id"    TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Residence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Career" (
    "id"    TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Career_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Residence_value_key" ON "Residence"("value");

-- CreateIndex
CREATE UNIQUE INDEX "Career_value_key" ON "Career"("value");

-- AlterTable
ALTER TABLE "Character" ADD COLUMN "residenceId" TEXT;
ALTER TABLE "Character" ADD COLUMN "careerId" TEXT;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "Career"("id") ON DELETE SET NULL ON UPDATE CASCADE;
