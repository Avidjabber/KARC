-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "codeName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupRole" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "discordRoleId" TEXT,
    "color" TEXT,
    "name" TEXT NOT NULL,
    "subName" TEXT,
    "position" INTEGER NOT NULL,
    "canManageAssignments" BOOLEAN NOT NULL DEFAULT false,
    "canManageGroup" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupRoleProgression" (
    "fromRoleId" TEXT NOT NULL,
    "toRoleId" TEXT NOT NULL,

    CONSTRAINT "GroupRoleProgression_pkey" PRIMARY KEY ("fromRoleId","toRoleId")
);

-- CreateTable
CREATE TABLE "GroupRoleMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "groupRoleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "characterName" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupRoleMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Group_codeName_key" ON "Group"("codeName");

-- CreateIndex
CREATE UNIQUE INDEX "GroupRole_groupId_name_key" ON "GroupRole"("groupId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "GroupRoleMember_groupId_characterName_userId_key" ON "GroupRoleMember"("groupId", "characterName", "userId");

-- AddForeignKey
ALTER TABLE "GroupRole" ADD CONSTRAINT "GroupRole_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupRoleProgression" ADD CONSTRAINT "GroupRoleProgression_fromRoleId_fkey" FOREIGN KEY ("fromRoleId") REFERENCES "GroupRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupRoleProgression" ADD CONSTRAINT "GroupRoleProgression_toRoleId_fkey" FOREIGN KEY ("toRoleId") REFERENCES "GroupRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupRoleMember" ADD CONSTRAINT "GroupRoleMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupRoleMember" ADD CONSTRAINT "GroupRoleMember_groupRoleId_fkey" FOREIGN KEY ("groupRoleId") REFERENCES "GroupRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
