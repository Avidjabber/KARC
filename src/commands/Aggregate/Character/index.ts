import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { execute as characterCreate } from './create.js';
import { execute as characterEdit } from './edit.js';
import { execute as characterList } from './list.js';
import { execute as characterDelete } from './delete.js';
import { execute as characterInfo } from './info.js';
import { execute as characterPurge } from './purge.js';

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
    )
    .addSubcommand(sub =>
        sub
            .setName('info')
            .setDescription("View a character's info card")
            .addUserOption(opt =>
                opt
                    .setName('user')
                    .setDescription("View this member's character instead of your own")
                    .setRequired(false),
            ),
    )
    .addSubcommand(sub =>
        sub
            .setName('purge')
            .setDescription('Delete ALL of a member\'s characters, by user ID (requires Administrator)')
            .addStringOption(opt =>
                opt
                    .setName('userid')
                    .setDescription('The Discord user ID whose characters to delete (works even if they left the server)')
                    .setRequired(true),
            ),
    );

export const modalSubcommands     = new Set(['create', 'edit']);
// Public when there's a character to show, but replies ephemerally when there isn't —
// so it manages its own first reply.
export const manualAckSubcommands = new Set(['info']);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const sub = interaction.options.getSubcommand();
    if (sub === 'create') return characterCreate(interaction);
    if (sub === 'edit')   return characterEdit(interaction);
    if (sub === 'list')   return characterList(interaction);
    if (sub === 'delete') return characterDelete(interaction);
    if (sub === 'info')   return characterInfo(interaction);
    if (sub === 'purge')  return characterPurge(interaction);
}
