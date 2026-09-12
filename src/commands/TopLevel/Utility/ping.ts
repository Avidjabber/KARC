import { ChatInputCommandInteraction, ContainerBuilder, MessageFlags, SlashCommandBuilder, TextDisplayBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot latency');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const wsLatency = interaction.client.ws.ping;
    const wsDisplay = wsLatency === -1 ? 'measuring...' : `${wsLatency}ms`;

    const start = Date.now();
    await interaction.editReply({
        flags: MessageFlags.IsComponentsV2,
        components: [new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent('Pong!'),
        )],
    });
    const apiLatency = Date.now() - start;

    await interaction.editReply({
        flags: MessageFlags.IsComponentsV2,
        components: [new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `Pong!\n- API: **${apiLatency}ms**\n- WS: **${wsDisplay}**`,
            ),
        )],
    });
}
