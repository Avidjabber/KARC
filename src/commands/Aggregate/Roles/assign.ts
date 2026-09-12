import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { db } from '../../../db/index.js';

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetUser   = interaction.options.getUser('user', true);
    const discordRole  = interaction.options.getRole('role', true);
    const assignerId   = interaction.user.id;
    const guildId      = interaction.guildId!;

    // Resolve the group role from the Discord role ID
    const groupRole = await db.groupRole.findFirst({
        where:   { discordRoleId: discordRole.id },
        include: { group: true },
    });

    if (!groupRole || groupRole.group.guildId !== guildId) {
        await interaction.reply({
            flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: `**${discordRole.name}** is not linked to any group role in this server.` }] }],
        } as never);
        return;
    }

    const { group } = groupRole;

    // ── Permission check ──────────────────────────────────────────────────────
    let permitted = false;

    if (group.ownerId === assignerId) {
        permitted = true;
    }

    if (!permitted) {
        const manageGroupMembership = await db.groupRoleMember.findFirst({
            where: { groupId: group.id, userId: assignerId, groupRole: { canManageGroup: true } },
        });
        if (manageGroupMembership) permitted = true;
    }

    if (!permitted) {
        // canManageAssignments: assigner's highest eligible role must be >= target role position
        const assignerMembership = await db.groupRoleMember.findFirst({
            where:   { groupId: group.id, userId: assignerId, groupRole: { canManageAssignments: true } },
            orderBy: { groupRole: { position: 'desc' } },
            include: { groupRole: true },
        });
        if (assignerMembership && assignerMembership.groupRole.position >= groupRole.position) {
            permitted = true;
        }
    }

    if (!permitted) {
        await interaction.reply({
            flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: `You do not have permission to assign the **${groupRole.name}** role.` }] }],
        } as never);
        return;
    }

    await interaction.showModal({
        title:      `Assign: ${groupRole.name}`,
        custom_id:  `roles_assign_modal:${groupRole.id}:${targetUser.id}`,
        components: [
            {
                type:        18,
                label:       'Character Name',
                description: `The in-group character name for ${targetUser.displayName ?? targetUser.username}`,
                component:   { type: 4, custom_id: 'character_name', style: 1, max_length: 200, required: true, placeholder: "Ko'har" },
            },
        ],
    } as never);
}
