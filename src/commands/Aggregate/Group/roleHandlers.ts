import { ButtonInteraction, MessageFlags } from 'discord.js';

export async function handleGroupRoleDone(interaction: ButtonInteraction): Promise<void> {
    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: [{ type: 17, components: [{ type: 10, content: '-# Role management closed.' }] }],
    } as never);
}
