-- CreateTable
CREATE TABLE "Character" (
    "id"        TEXT NOT NULL,
    "guildId"   TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "bio"       TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- Backfill: one Character per distinct (guildId, userId, characterName) currently in use,
-- collapsing cases where the same user used the same name across multiple groups in the same guild.
INSERT INTO "Character" ("id", "guildId", "userId", "name", "bio", "createdAt", "updatedAt")
SELECT
    'c' || substr(md5(random()::text || clock_timestamp()::text || d."guildId" || d."userId" || d."name"), 1, 24),
    d."guildId",
    d."userId",
    d."name",
    NULL,
    now(),
    now()
FROM (
    SELECT DISTINCT g."guildId" AS "guildId", grm."userId" AS "userId", grm."characterName" AS "name"
    FROM "GroupRoleMember" grm
    JOIN "Group" g ON g."id" = grm."groupId"
) d;

-- AlterTable: add nullable characterId, backfill it, then enforce NOT NULL
ALTER TABLE "GroupRoleMember" ADD COLUMN "characterId" TEXT;

UPDATE "GroupRoleMember" grm
SET "characterId" = c."id"
FROM "Character" c, "Group" g
WHERE g."id" = grm."groupId"
  AND c."guildId" = g."guildId"
  AND c."userId" = grm."userId"
  AND c."name" = grm."characterName";

ALTER TABLE "GroupRoleMember" ALTER COLUMN "characterId" SET NOT NULL;

-- DropIndex (old name-based uniqueness)
DROP INDEX "GroupRoleMember_groupId_characterName_userId_key";

-- AlterTable: drop the now-redundant raw name column
ALTER TABLE "GroupRoleMember" DROP COLUMN "characterName";

-- CreateIndex
CREATE UNIQUE INDEX "Character_guildId_userId_name_key" ON "Character"("guildId", "userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "GroupRoleMember_groupId_characterId_key" ON "GroupRoleMember"("groupId", "characterId");

-- AddForeignKey
ALTER TABLE "GroupRoleMember" ADD CONSTRAINT "GroupRoleMember_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
