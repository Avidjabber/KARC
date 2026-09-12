import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { execute as characterCreate } from './create.js';
import { execute as characterEdit } from './edit.js';
import { execute as characterList } from './list.js';
import { execute as characterDelete } from './delete.js';

export const data = new SlashCommandBuilder()
    .setName('character')
    .setDescription('Manage your characters')
    .addSubcommand(sub =>
        sub
            .setName('create')
            .setDescription('Create a new character'),
    )
    .addSubcommand(sub =>
        sub
            .setName('edit')
            .setDescription('Edit one of your characters')
            .addUserOption(opt =>
                opt
                    .setName('user')
                    .setDescription('Edit another member\'s character (requires Administrator)')
                    .setRequired(false),
            ),
    )
    .addSubcommand(sub =>
        sub
            .setName('list')
            .setDescription('List your characters and where they hold roles'),
    )
    .addSubcommand(sub =>
        sub
            .setName('delete')
            .setDescription('Delete one of your characters'),
    );

export const modalSubcommands = new Set(['create', 'edit']);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const sub = interaction.options.getSubcommand();
    if (sub === 'create') return characterCreate(interaction);
    if (sub === 'edit')   return characterEdit(interaction);
    if (sub === 'list')   return characterList(interaction);
    if (sub === 'delete') return characterDelete(interaction);
}
