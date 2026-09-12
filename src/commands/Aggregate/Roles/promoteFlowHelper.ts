import { Guild, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { db } from '../../../db/index.js';
import { moveMember } from './memberMoveHelper.js';

type ReplyFn = (payload: never) => Promise<unknown>;

export async function runPromoteRoleStep(
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
            groupRole: { include: { progressionsFrom: { include: { toRole: true } } } },
        },
    });

    if (!member || member.group.guildId !== guildId) {
        await reply({ flags: MessageFlags.IsComponentsV2, components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'Member record not found.' }] }] } as never);
        return;
    }

    const targets = member.groupRole.progressionsFrom.map(e => e.toRole);

    if (targets.length === 0) {
        await reply({ flags: MessageFlags.IsComponentsV2, components: [{ type: 17, accent_color: colors.warning, components: [{ type: 10, content: `**${member.characterName}** is already at the top of their path (**${member.groupRole.name}**) in **${member.group.name}**.` }] }] } as never);
        return;
    }

    // Permission check
    let permitted = member.group.ownerId === callerId;

    if (!permitted) {
        const manageGroup = await db.groupRoleMember.findFirst({
            where: { groupId: member.group.id, userId: callerId, groupRole: { canManageGroup: true } },
        });
        if (manageGroup) permitted = true;
    }

    if (!permitted) {
        const highestTarget   = targets.reduce((a, b) => (a.position > b.position ? a : b));
        const callerMembership = await db.groupRoleMember.findFirst({
            where:   { groupId: member.group.id, userId: callerId, groupRole: { canManageAssignments: true } },
            orderBy: { groupRole: { position: 'desc' } },
            include: { groupRole: true },
        });
        if (callerMembership && callerMembership.groupRole.position > highestTarget.position) permitted = true;
    }

    if (!permitted) {
        await reply({ flags: MessageFlags.IsComponentsV2, components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: `You do not have permission to promote **${member.characterName}** in **${member.group.name}**.` }] }] } as never);
        return;
    }

    // Single path: auto-promote
    if (targets.length === 1) {
        const { oldRoleName, newRoleName } = await moveMember(
            memberId, targets[0].id, guild,
            `promoted from ${member.groupRole.name}`, member.group.name,
        );
        await reply({ flags: MessageFlags.IsComponentsV2, components: [{ type: 17, accent_color: colors.success, components: [{ type: 10, content: `**${member.characterName}** has been promoted from **${oldRoleName}** to **${newRoleName}** in **${member.group.name}**.` }] }] } as never);
        return;
    }

    // Multiple paths: show role select
    const options = targets
        .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
        .map(t => ({ label: t.name, value: t.id, description: t.subName ?? undefined }));

    await reply({
        flags:      MessageFlags.IsComponentsV2,
        components: [{
            type:       17,
            components: [
                { type: 10, content: `**${member.characterName}** can advance to multiple roles from **${member.groupRole.name}**. Choose one:` },
                { type: 1,  components: [{
                    type:        3,
                    custom_id:   `roles_promote_role:${memberId}`,
                    placeholder: 'Select a role to promote to',
                    options,
                }]},
            ],
        }],
    } as never);
}
