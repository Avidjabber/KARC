import {
    ChatInputCommandInteraction,
    ContainerBuilder,
    MessageFlags,
    TextDisplayBuilder,
} from 'discord.js';
import { colors } from './colors.js';

export async function replyLoading(
    interaction: ChatInputCommandInteraction,
    ephemeral = true,
): Promise<void> {
    const flags = ephemeral
        ? MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        : MessageFlags.IsComponentsV2;

    await interaction.reply({
        flags,
        components: [
            new ContainerBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent('-# Loading...'),
            ),
        ],
    });
}

export async function replyError(
    interaction: ChatInputCommandInteraction,
    content: string,
): Promise<void> {
    const container = new ContainerBuilder()
        .setAccentColor(colors.error)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(content),
        );

    const payload = {
        flags:      MessageFlags.IsComponentsV2,
        components: [container],
    };

    if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
    } else {
        await interaction.editReply(payload as never);
    }
}
