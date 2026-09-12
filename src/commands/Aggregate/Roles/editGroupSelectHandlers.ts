import { MessageFlags, StringSelectMenuInteraction } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { db } from '../../../db/index.js';
import { buildEditTogglesComponents } from './edit.js';

// customId: roles_edit_group_select  (groupRoleId from values[0])
export async function handleEditGroupSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const roleId  = interaction.values[0];
    const guildId = interaction.guildId!;

    const groupRole = await db.groupRole.findUnique({
        where:   { id: roleId },
        include: { group: true },
    });

    if (!groupRole || groupRole.group.guildId !== guildId) {
        await interaction.update({
            flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'This role no longer exists.' }] }],
        } as never);
        return;
    }

    await interaction.update({
        flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        components: buildEditTogglesComponents(groupRole.group.id, groupRole.id, groupRole.canManageGroup, groupRole.canManageAssignments),
    } as never);
}
