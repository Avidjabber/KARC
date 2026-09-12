import { Guild } from 'discord.js';
import { db } from '../../../db/index.js';

export async function moveMember(
    memberId:      string,
    newRoleId:     string,
    guild:         Guild,
    reasonVerb:    string,
    groupName:     string,
): Promise<{ oldRoleName: string; newRoleName: string }> {
    const member = await db.groupRoleMember.findUniqueOrThrow({
        where:   { id: memberId },
        include: { groupRole: true },
    });
    const newRole = await db.groupRole.findUniqueOrThrow({ where: { id: newRoleId } });

    await db.groupRoleMember.update({
        where: { id: memberId },
        data:  { groupRoleId: newRoleId },
    });

    try {
        const discordMember = await guild.members.fetch(member.userId);
        if (member.groupRole.discordRoleId) {
            await discordMember.roles.remove(
                member.groupRole.discordRoleId,
                `KARC: ${reasonVerb} in ${groupName}`,
            );
        }
        if (newRole.discordRoleId) {
            await discordMember.roles.add(
                newRole.discordRoleId,
                `KARC: ${reasonVerb} in ${groupName}`,
            );
        }
    } catch (err) {
        console.error(`[moveMember] Discord role swap failed:`, err);
    }

    return { oldRoleName: member.groupRole.name, newRoleName: newRole.name };
}
