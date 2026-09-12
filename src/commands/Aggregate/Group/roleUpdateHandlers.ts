import { ButtonInteraction, MessageFlags } from 'discord.js';
import { db } from '../../../db/index.js';
import { renderRoleView } from './role.js';

export async function handleViewRolesUpdate(interaction: ButtonInteraction): Promise<void> {
    const codeName = interaction.customId.slice('group_viewroles_update:'.length);
    const guildId  = interaction.guildId!;

    await interaction.deferUpdate();

    const group = await db.group.findUnique({ where: { codeName }, select: { id: true, guildId: true } });
    if (!group || group.guildId !== guildId) return;

    const view = await renderRoleView(group.id, guildId);
    if (!view) return;

    await interaction.editReply({
        flags:      MessageFlags.IsComponentsV2,
        files:      view.files,
        components: view.components,
    } as never);
}
