import { ButtonInteraction, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { db } from '../../../db/index.js';

// customId: roles_assign_move_confirm:<memberId>:<newGroupRoleId>
export async function handleAssignMoveConfirm(interaction: ButtonInteraction): Promise<void> {
    const [, memberId, newGroupRoleId] = interaction.customId.split(':');
    const assignerId = interaction.user.id;
    const guildId     = interaction.guildId!;

    const member = await db.groupRoleMember.findUnique({
        where:   { id: memberId },
        include: { group: true, groupRole: true },
    });

    if (!member || member.group.guildId !== guildId) {
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'That character record no longer exists.' }] }],
        } as never);
        return;
    }

    const newGroupRole = await db.groupRole.findUnique({ where: { id: newGroupRoleId } });
    if (!newGroupRole) {
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'The target role no longer exists.' }] }],
        } as never);
        return;
    }

    const { group } = member;
    const oldGroupRole = member.groupRole;

    // Re-check permission on confirm
    let permitted = group.ownerId === assignerId;

    if (!permitted) {
        const manageGroupMembership = await db.groupRoleMember.findFirst({
            where: { groupId: group.id, userId: assignerId, groupRole: { canManageGroup: true } },
        });
        if (manageGroupMembership) permitted = true;
    }

    if (!permitted) {
        const assignerMembership = await db.groupRoleMember.findFirst({
            where:   { groupId: group.id, userId: assignerId, groupRole: { canManageAssignments: true } },
            orderBy: { groupRole: { position: 'desc' } },
            include: { groupRole: true },
        });
        if (assignerMembership && assignerMembership.groupRole.position >= newGroupRole.position) {
            permitted = true;
        }
    }

    if (!permitted) {
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: `You do not have permission to assign the **${newGroupRole.name}** role.` }] }],
        } as never);
        return;
    }

    await db.groupRoleMember.update({ where: { id: memberId }, data: { groupRoleId: newGroupRole.id } });

    try {
        const guildMember = await interaction.guild!.members.fetch(member.userId);
        if (oldGroupRole.discordRoleId) {
            await guildMember.roles.remove(oldGroupRole.discordRoleId, `KARC: moved from ${oldGroupRole.name} to ${newGroupRole.name} in ${group.name}`);
        }
        if (newGroupRole.discordRoleId) {
            await guildMember.roles.add(newGroupRole.discordRoleId, `KARC: moved from ${oldGroupRole.name} to ${newGroupRole.name} in ${group.name}`);
        }
    } catch (err) {
        console.error('[handleAssignMoveConfirm] Discord role swap failed:', err);
    }

    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: [{
            type:         17,
            accent_color: colors.success,
            components:   [{ type: 10, content: `**${member.characterName}** has been moved from **${oldGroupRole.name}** to **${newGroupRole.name}** in **${group.name}**.` }],
        }],
    } as never);
}

export async function handleAssignMoveCancel(interaction: ButtonInteraction): Promise<void> {
    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: [{ type: 17, components: [{ type: 10, content: 'Cancelled.' }] }],
    } as never);
}
