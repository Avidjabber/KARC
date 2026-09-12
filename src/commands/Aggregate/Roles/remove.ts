import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { db } from '../../../db/index.js';

export function buildRemoveConfirmation(
    memberId:      string,
    characterName: string,
    userMention:   string,
    roleName:      string,
    groupName:     string,
): object {
    return {
        type:       17,
        components: [
            { type: 10, content: `Are you sure you want to remove **${characterName}** (${userMention}) from **${roleName}** in **${groupName}**?` },
            { type: 1,  components: [
                { type: 2, style: 4, label: 'Remove', custom_id: `roles_remove_confirm:${memberId}` },
                { type: 2, style: 2, label: 'Cancel', custom_id: 'roles_remove_cancel' },
            ]},
        ],
    };
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetUser  = interaction.options.getUser('user', true);
    const discordRole = interaction.options.getRole('role', true);
    const callerId    = interaction.user.id;
    const guildId     = interaction.guildId!;

    const groupRole = await db.groupRole.findFirst({
        where:   { discordRoleId: discordRole.id, group: { guildId } },
        include: { group: true },
    });

    if (!groupRole) {
        await interaction.editReply({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: `${discordRole} is not linked to any group in this server.` }] }],
        } as never);
        return;
    }

    const { group } = groupRole;

    const members = await db.groupRoleMember.findMany({
        where:   { groupRoleId: groupRole.id, userId: targetUser.id },
        orderBy: { characterName: 'asc' },
    });

    if (members.length === 0) {
        await interaction.editReply({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: `${targetUser} does not hold **${groupRole.name}** in **${group.name}**.` }] }],
        } as never);
        return;
    }

    // Permission check
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
        await interaction.editReply({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: `You do not have permission to remove members from **${groupRole.name}** in **${group.name}**.` }] }],
        } as never);
        return;
    }

    // Multiple characters: show character dropdown
    if (members.length > 1) {
        const options = members.map(m => ({ label: m.characterName, value: m.id }));
        await interaction.editReply({
            flags:      MessageFlags.IsComponentsV2,
            components: [{
                type:       17,
                components: [
                    { type: 10, content: `${targetUser} has multiple characters with **${groupRole.name}** in **${group.name}**. Select one to remove:` },
                    { type: 1,  components: [{
                        type:        3,
                        custom_id:   'roles_remove_char_select',
                        placeholder: 'Select a character',
                        options,
                    }]},
                ],
            }],
        } as never);
        return;
    }

    // Single character: go straight to confirmation
    await interaction.editReply({
        flags:      MessageFlags.IsComponentsV2,
        components: [buildRemoveConfirmation(members[0].id, members[0].characterName, targetUser.toString(), groupRole.name, group.name)],
    } as never);
}
