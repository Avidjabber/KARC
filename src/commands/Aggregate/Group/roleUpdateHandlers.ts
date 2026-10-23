import { ButtonInteraction, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { db } from '../../../db/index.js';
import { renderRoleView } from './role.js';

export async function handleViewRolesUpdate(interaction: ButtonInteraction): Promise<void> {
    // Group id; panels posted before ids were used carry the code name instead
    const key      = interaction.customId.slice('group_viewroles_update:'.length);
    const guildId  = interaction.guildId!;

    await interaction.deferUpdate();

    const group = await db.group.findFirst({ where: { OR: [{ id: key }, { codeName: key }] }, select: { id: true, guildId: true } });
    const view  = group && group.guildId === guildId ? await renderRoleView(group.id, guildId) : null;
    if (!view) {
        await interaction.followUp({
            flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'This group no longer exists.' }] }],
        } as never);
        return;
    }

    await interaction.editReply({
        flags:      MessageFlags.IsComponentsV2,
        files:      view.files,
        components: view.components,
    } as never);
}
