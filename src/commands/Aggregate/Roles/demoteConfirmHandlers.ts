import { MessageFlags, StringSelectMenuInteraction } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { db } from '../../../db/index.js';
import { moveMember } from './memberMoveHelper.js';

// customId: roles_demote_role:<memberId>
export async function handleDemoteRoleSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const memberId     = interaction.customId.slice('roles_demote_role:'.length);
    const targetRoleId = interaction.values[0];
    const callerId     = interaction.user.id;
    const guildId      = interaction.guildId!;

    const member = await db.groupRoleMember.findUnique({
        where:   { id: memberId },
        include: { groupRole: true, group: true, character: { select: { name: true } } },
    });

    if (!member || member.group.guildId !== guildId) {
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'Member record no longer exists.' }] }],
        } as never);
        return;
    }

    const targetRole = await db.groupRole.findUnique({ where: { id: targetRoleId } });
    if (!targetRole) {
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'That role no longer exists.' }] }],
        } as never);
        return;
    }

    const { group } = member;
    let permitted = group.ownerId === callerId;

    if (!permitted) {
        const manageGroup = await db.groupRoleMember.findFirst({
            where: { groupId: group.id, userId: callerId, groupRole: { canManageGroup: true } },
        });
        if (manageGroup) permitted = true;
    }

    if (!permitted) {
        const callerMembership = await db.groupRoleMember.findFirst({
            where:   { groupId: group.id, userId: callerId, groupRole: { canManageAssignments: true } },
            orderBy: { groupRole: { position: 'desc' } },
            include: { groupRole: true },
        });
        if (callerMembership && callerMembership.groupRole.position > member.groupRole.position) permitted = true;
    }

    if (!permitted) {
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: `You do not have permission to demote **${member.character.name}** from **${member.groupRole.name}**.` }] }],
        } as never);
        return;
    }

    const { oldRoleName, newRoleName } = await moveMember(
        memberId, targetRoleId, interaction.guild!,
        `demoted from ${member.groupRole.name}`, group.name,
    );

    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: [{
            type:         17,
            accent_color: colors.success,
            components:   [{ type: 10, content: `**${member.character.name}** has been demoted from **${oldRoleName}** to **${newRoleName}** in **${group.name}**.` }],
        }],
    } as never);
}
