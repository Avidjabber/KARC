import { MessageFlags, StringSelectMenuInteraction } from 'discord.js';
import { buildCreateTogglesComponents } from './create.js';

// customId: roles_create_group_select  (groupId comes from values[0])
export async function handleCreateGroupSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const groupId = interaction.values[0];
    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: buildCreateTogglesComponents(groupId, false, false),
    } as never);
}
