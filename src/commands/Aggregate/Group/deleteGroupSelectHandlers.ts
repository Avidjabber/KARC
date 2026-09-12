import { MessageFlags, StringSelectMenuInteraction } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { db } from '../../../db/index.js';
import { buildDeleteConfirmation } from './delete.js';

// customId: group_delete_group_select  (groupId from values[0])
export async function handleGroupDeleteGroupSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const groupId = interaction.values[0];
    const guildId  = interaction.guildId!;
    const userId   = interaction.user.id;

    const group = await db.group.findUnique({ where: { id: groupId } });

    if (!group || group.guildId !== guildId || group.ownerId !== userId) {
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'This group no longer exists, or you no longer own it.' }] }],
        } as never);
        return;
    }

    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: [buildDeleteConfirmation(group.id, group.name, group.codeName)],
    } as never);
}
