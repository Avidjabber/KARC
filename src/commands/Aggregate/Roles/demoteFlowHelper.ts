import { Guild, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { db } from '../../../db/index.js';
import { moveMember } from './memberMoveHelper.js';

type ReplyFn = (payload: never) => Promise<unknown>;

export async function runDemoteRoleStep(
    memberId: string,
    callerId: string,
    guildId:  string,
    guild:    Guild,
    reply:    ReplyFn,
): Promise<void> {
    const member = await db.groupRoleMember.findUnique({
        where:   { id: memberId },
        include: {
            group:     true,
            groupRole: { include: { progressionsTo: { include: { fromRole: true } } } },
            character: { select: { name: true } },
        },
    });

    if (!member || member.group.guildId !== guildId) {
        await reply({ flags: MessageFlags.IsComponentsV2, components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'Member record not found.' }] }] } as never);
        return;
    }

    const targets = member.groupRole.progressionsTo.map(e => e.fromRole);

    if (targets.length === 0) {
        await reply({ flags: MessageFlags.IsComponentsV2, components: [{ type: 17, accent_color: colors.warning, components: [{ type: 10, content: `**${member.character.name}** is already at the entry level of their path (**${member.groupRole.name}**) and cannot be demoted further.` }] }] } as never);
        return;
    }

    // Permission check — caller must outrank the role being demoted FROM
    let permitted = member.group.ownerId === callerId;

    if (!permitted) {
        const manageGroup = await db.groupRoleMember.findFirst({
            where: { groupId: member.group.id, userId: callerId, groupRole: { canManageGroup: true } },
        });
        if (manageGroup) permitted = true;
    }

    if (!permitted) {
        const callerMembership = await db.groupRoleMember.findFirst({
            where:   { groupId: member.group.id, userId: callerId, groupRole: { canManageAssignments: true } },
            orderBy: { groupRole: { position: 'desc' } },
            include: { groupRole: true },
        });
        if (callerMembership && callerMembership.groupRole.position > member.groupRole.position) permitted = true;
    }

    if (!permitted) {
        await reply({ flags: MessageFlags.IsComponentsV2, components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: `You do not have permission to demote **${member.character.name}** from **${member.groupRole.name}** in **${member.group.name}**.` }] }] } as never);
        return;
    }

    // Single path: auto-demote
    if (targets.length === 1) {
        const { oldRoleName, newRoleName } = await moveMember(
            memberId, targets[0].id, guild,
            `demoted from ${member.groupRole.name}`, member.group.name,
        );
        await reply({ flags: MessageFlags.IsComponentsV2, components: [{ type: 17, accent_color: colors.success, components: [{ type: 10, content: `**${member.character.name}** has been demoted from **${oldRoleName}** to **${newRoleName}** in **${member.group.name}**.` }] }] } as never);
        return;
    }

    // Multiple paths: show role select
    const options = targets
        .sort((a, b) => b.position - a.position || a.name.localeCompare(b.name))
        .map(t => ({ label: t.name, value: t.id, description: t.subName ?? undefined }));

    await reply({
        flags:      MessageFlags.IsComponentsV2,
        components: [{
            type:       17,
            components: [
                { type: 10, content: `**${member.character.name}** can be demoted to multiple roles from **${member.groupRole.name}**. Choose one:` },
                { type: 1,  components: [{
                    type:        3,
                    custom_id:   `roles_demote_role:${memberId}`,
                    placeholder: 'Select a role to demote to',
                    options,
                }]},
            ],
        }],
    } as never);
}
