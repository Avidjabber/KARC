import { Guild } from 'discord.js';
import { db } from '../../../db/index.js';

export type LinkOutcome =
    | { kind: 'created' }
    | { kind: 'moved'; oldRoleName: string }
    | { kind: 'already' };

/** Links a character to a group role — creating the membership, moving it from another role, or no-op if already there. Swaps Discord roles to match. */
export async function linkCharacterToRole(
    character: { id: string; name: string; userId: string },
    groupRole: { id: string; name: string; discordRoleId: string | null },
    group: { id: string; name: string; discordRoleId: string | null },
    guild: Guild,
): Promise<LinkOutcome> {
    const existing = await db.groupRoleMember.findUnique({
        where:   { groupId_characterId: { groupId: group.id, characterId: character.id } },
        include: { groupRole: true },
    });

    let outcome: LinkOutcome;

    if (existing && existing.groupRoleId === groupRole.id) {
        outcome = { kind: 'already' };
    } else if (existing) {
        await db.groupRoleMember.update({ where: { id: existing.id }, data: { groupRoleId: groupRole.id } });
        outcome = { kind: 'moved', oldRoleName: existing.groupRole.name };

        if (existing.groupRole.discordRoleId) {
            try {
                const member = await guild.members.fetch(character.userId);
                await member.roles.remove(existing.groupRole.discordRoleId, `KARC: moved to ${groupRole.name} in ${group.name}`);
            } catch (err) {
                console.error('[linkCharacterToRole] Discord role remove failed:', err);
            }
        }
    } else {
        await db.groupRoleMember.create({
            data: { groupId: group.id, groupRoleId: groupRole.id, characterId: character.id, userId: character.userId },
        });
        outcome = { kind: 'created' };
    }

    if (outcome.kind !== 'already' && groupRole.discordRoleId) {
        try {
            const member = await guild.members.fetch(character.userId);
            await member.roles.add(groupRole.discordRoleId, `KARC: assigned to ${groupRole.name} in ${group.name}`);
        } catch (err) {
            console.error('[linkCharacterToRole] Discord role add failed:', err);
        }
    }

    // The group's own tag is applied alongside the specific role tag whenever a character
    // newly joins the group. A "moved" outcome stays within the same group, so it already holds it.
    if (outcome.kind === 'created' && group.discordRoleId) {
        try {
            const member = await guild.members.fetch(character.userId);
            await member.roles.add(group.discordRoleId, `KARC: joined ${group.name}`);
        } catch (err) {
            console.error('[linkCharacterToRole] Discord group tag add failed:', err);
        }
    }

    return outcome;
}
