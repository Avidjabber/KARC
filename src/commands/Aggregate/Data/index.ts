import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { execute as dataExportGroup } from './exportGroup.js';

export const data = new SlashCommandBuilder()
    .setName('data')
    .setDescription('Import and export KARC data')
    .addSubcommand(sub =>
        sub
            .setName('exportgroup')
            .setDescription('Export a group (roles, progressions, members) to an Excel file')
            .addStringOption(opt =>
                opt
                    .setName('code_name')
                    .setDescription('Code name of the group to export')
                    .setRequired(true),
            ),
    );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const sub = interaction.options.getSubcommand();
    if (sub === 'exportgroup') return dataExportGroup(interaction);
}
