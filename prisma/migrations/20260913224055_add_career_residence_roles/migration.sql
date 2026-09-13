-- CreateTable
CREATE TABLE "ResidenceRole" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "residenceId" TEXT NOT NULL,
    "discordRoleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResidenceRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerRole" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "careerId" TEXT NOT NULL,
    "discordRoleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResidenceRole_guildId_residenceId_key" ON "ResidenceRole"("guildId", "residenceId");

-- CreateIndex
CREATE UNIQUE INDEX "CareerRole_guildId_careerId_key" ON "CareerRole"("guildId", "careerId");

-- AddForeignKey
ALTER TABLE "ResidenceRole" ADD CONSTRAINT "ResidenceRole_residenceId_fkey" FOREIGN KEY ("residenceId") REFERENCES "Residence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerRole" ADD CONSTRAINT "CareerRole_careerId_fkey" FOREIGN KEY ("careerId") REFERENCES "Career"("id") ON DELETE CASCADE ON UPDATE CASCADE;
