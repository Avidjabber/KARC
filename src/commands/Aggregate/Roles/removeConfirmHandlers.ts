import { ButtonInteraction, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { db } from '../../../db/index.js';

// customId: roles_remove_confirm:<memberId>
export async function handleRemoveConfirm(interaction: ButtonInteraction): Promise<void> {
    const memberId = interaction.customId.slice('roles_remove_confirm:'.length);
    const callerId = interaction.user.id;
    const guildId  = interaction.guildId!;

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

    const { group, groupRole } = member;

    // Re-check permission in case roles changed since the command ran
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
        if (callerMembership && callerMembership.groupRole.position > groupRole.position) permitted = true;
    }

    if (!permitted) {
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'You no longer have permission to do this.' }] }],
        } as never);
        return;
    }

    await db.groupRoleMember.delete({ where: { id: memberId } });

    if (groupRole.discordRoleId || group.discordRoleId) {
        try {
            const discordMember = await interaction.guild!.members.fetch(member.userId);
            if (groupRole.discordRoleId) {
                await discordMember.roles.remove(
                    groupRole.discordRoleId,
                    `KARC: removed from ${groupRole.name} in ${group.name}`,
                );
            }
            // A member holds at most one role per group, so losing this role means leaving the group entirely.
            if (group.discordRoleId) {
                await discordMember.roles.remove(
                    group.discordRoleId,
                    `KARC: left ${group.name}`,
                );
            }
        } catch (err) {
            console.error('[roles remove confirm] Discord role remove failed:', err);
        }
    }

    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: [{
            type:         17,
            accent_color: colors.success,
            components:   [{ type: 10, content: `**${member.character.name}** has been removed from **${groupRole.name}** in **${group.name}**.` }],
        }],
    } as never);
}

export async function handleRemoveCancel(interaction: ButtonInteraction): Promise<void> {
    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: [{ type: 17, components: [{ type: 10, content: 'Cancelled.' }] }],
    } as never);
}
