import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { buildEditPanelComponents } from './editPanel.js';
import { createNewSession } from './editShared.js';

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId!;
    const userId  = interaction.user.id;

    const { sessionId, session } = createNewSession(guildId, userId);

    await interaction.reply({
        flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        components: buildEditPanelComponents({ sessionId, ...session.draft }),
    } as never);
}
