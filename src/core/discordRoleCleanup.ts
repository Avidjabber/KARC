import { Guild } from 'discord.js';
import { db } from '../db/index.js';

/**
 * Removes the given Discord roles from a user — skipping any that one of their remaining characters still
 * holds (as a group role or group tag). Call after the DB membership rows are gone. Best-effort: if the user
 * has left the server there's nothing to clean up.
 */
export async function removeUnheldDiscordRoles(
    guild:   Guild,
    userId:  string,
    roleIds: Array<string | null>,
    reason:  string,
): Promise<void> {
    const candidates = roleIds.filter((id): id is string => !!id);
    if (candidates.length === 0) return;

    const discordMember = await guild.members.fetch(userId).catch(() => null);
    if (!discordMember) return;

    const remaining = await db.groupRoleMember.findMany({
        where:   { userId, group: { guildId: guild.id } },
        include: { group: true, groupRole: true },
    });
    const stillHeld = new Set(remaining.flatMap(m => [m.groupRole.discordRoleId, m.group.discordRoleId]));

    for (const roleId of new Set(candidates)) {
        if (stillHeld.has(roleId)) continue;
        try {
            await discordMember.roles.remove(roleId, reason);
        } catch (err) {
            console.error('[removeUnheldDiscordRoles] Discord role remove failed:', err);
        }
    }
}
