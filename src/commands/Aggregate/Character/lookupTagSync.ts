import { Guild } from 'discord.js';
import { db } from '../../../db/index.js';
import { ensureLookupRoleId } from '../Roles/lookupRoleSync.js';

type Lookup = { id: string; value: string } | null;

/**
 * Keeps a member's Career/Residence Discord tags in sync with their characters whenever one is
 * created, edited, or deleted. `before`/`after` are this one character's values immediately
 * before and after the change (null on either side for create/delete). A value is only removed
 * from the member if no other character of theirs in this guild still carries it.
 */
export async function syncCharacterLookupTags(
    guild:   Guild,
    guildId: string,
    userId:  string,
    before:  { career: Lookup; residence: Lookup },
    after:   { career: Lookup; residence: Lookup },
): Promise<void> {
    if (before.career?.id !== after.career?.id) {
        await applyChange(guild, guildId, userId, 'Career', before.career, after.career,
            (valueId) => db.character.count({ where: { guildId, userId, careerId: valueId } }),
            (valueId) => db.careerRole.findUnique({ where: { guildId_careerId: { guildId, careerId: valueId } } }),
            (valueId, discordRoleId) => db.careerRole.upsert({
                where:  { guildId_careerId: { guildId, careerId: valueId } },
                update: { discordRoleId },
                create: { guildId, careerId: valueId, discordRoleId },
            }).then(() => undefined),
        );
    }

    if (before.residence?.id !== after.residence?.id) {
        await applyChange(guild, guildId, userId, 'Residence', before.residence, after.residence,
            (valueId) => db.character.count({ where: { guildId, userId, residenceId: valueId } }),
            (valueId) => db.residenceRole.findUnique({ where: { guildId_residenceId: { guildId, residenceId: valueId } } }),
            (valueId, discordRoleId) => db.residenceRole.upsert({
                where:  { guildId_residenceId: { guildId, residenceId: valueId } },
                update: { discordRoleId },
                create: { guildId, residenceId: valueId, discordRoleId },
            }).then(() => undefined),
        );
    }
}

async function applyChange(
    guild:        Guild,
    guildId:      string,
    userId:       string,
    label:        string,
    before:       Lookup,
    after:        Lookup,
    countHolders: (valueId: string) => Promise<number>,
    findRole:     (valueId: string) => Promise<{ discordRoleId: string } | null>,
    persistRole:  (valueId: string, discordRoleId: string) => Promise<void>,
): Promise<void> {
    let member;
    try {
        member = await guild.members.fetch(userId);
    } catch (err) {
        console.error(`[syncCharacterLookupTags] could not fetch member for ${label} tag update:`, err);
        return;
    }

    // Called after the character's own row has already been saved, so this counts only *other*
    // characters — the one just changed no longer carries `before`.
    if (before && (await countHolders(before.id)) === 0) {
        const role = await findRole(before.id);
        if (role) {
            try {
                await member.roles.remove(role.discordRoleId, `KARC: no longer ${before.value}`);
            } catch (err) {
                console.error(`[syncCharacterLookupTags] ${label} tag remove failed:`, err);
            }
        }
    }

    if (after) {
        const discordRoleId = await ensureLookupRoleId(guild, label, after.id, after.value, (await findRole(after.id))?.discordRoleId, persistRole);
        if (discordRoleId) {
            try {
                await member.roles.add(discordRoleId, `KARC: set to ${after.value}`);
            } catch (err) {
                console.error(`[syncCharacterLookupTags] ${label} tag add failed:`, err);
            }
        }
    }
}
