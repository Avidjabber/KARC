import { Client, ContainerBuilder, Interaction, MessageFlags, TextDisplayBuilder } from 'discord.js';
import { colors } from '../core/colors.js';
import { modalHandlers, selectMenuHandlers, buttonHandlers } from '../handlers/componentRegistry.js';
import type { ComponentHandler } from '../handlers/componentRegistry.js';

function dispatch(handlers: ComponentHandler[], interaction: Interaction): Promise<void> | void {
    if (!interaction.isMessageComponent() && !interaction.isModalSubmit()) return;
    const entry = handlers.find(h => interaction.customId.startsWith(h.prefix));
    if (entry) return entry.handler(interaction);
}

export default async function interactionCreate(
    interaction: Interaction,
    client: Client,
): Promise<void> {
    if (interaction.isModalSubmit() || interaction.isStringSelectMenu() || interaction.isButton()) {
        const handlers = interaction.isModalSubmit()      ? modalHandlers
                       : interaction.isStringSelectMenu() ? selectMenuHandlers
                       : buttonHandlers;
        try {
            await dispatch(handlers, interaction);
        } catch (err) {
            if ((err as { code?: number }).code !== 10062) {
                console.error('Unhandled error in component handler:', err);
            }
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        // ── Auto-defer ───────────────────────────────────────────────────────
        const subcommandName = interaction.options.getSubcommand(false);
        const subUsesModal   = subcommandName && command.modalSubcommands?.has(subcommandName);
        const subIsPublic    = subcommandName && command.publicSubcommands?.has(subcommandName);

        if (!command.usesModal && !subUsesModal) {
            const deferContainer = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent('-# Loading...'),
                );
            const flags = subIsPublic
                ? MessageFlags.IsComponentsV2
                : MessageFlags.Ephemeral | MessageFlags.IsComponentsV2;
            await interaction.reply({
                flags,
                components: [deferContainer],
            });
        }

        await command.execute(interaction);

    } catch (err) {
        console.error(`Error executing /${interaction.commandName}:`, err);
        if ((err as { code?: number }).code === 10062) return;

        const container = new ContainerBuilder()
            .setAccentColor(colors.error)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent('Something went wrong. Please try again.'),
            );
        const payload = {
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            components: [container],
        };
        if (interaction.replied || interaction.deferred) {
            await interaction.editReply(payload).catch(() => null);
        } else {
            await interaction.reply(payload).catch(() => null);
        }
    }
}
