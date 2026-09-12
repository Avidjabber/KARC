import { StringSelectMenuInteraction } from 'discord.js';
import { buildDeleteRoleModal } from './delete.js';

// customId: roles_delete_group_select  (groupId comes from values[0])
export async function handleDeleteGroupSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const groupId = interaction.values[0];
    await interaction.showModal(buildDeleteRoleModal(groupId) as never);
}
