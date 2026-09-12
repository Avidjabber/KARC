import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { execute as groupCreate } from './create.js';
import { execute as groupTransferOwnership } from './transferOwnership.js';
import { execute as groupRole } from './role.js';
import { execute as groupInfo } from './info.js';
import { execute as groupViewMembers } from './viewMembers.js';
import { execute as groupDelete } from './delete.js';

export const data = new SlashCommandBuilder()
    .setName('group')
    .setDescription('Manage groups')
    .addSubcommand(sub =>
        sub
            .setName('create')
            .setDescription('Create a new group'),
    )
    .addSubcommand(sub =>
        sub
            .setName('transferownership')
            .setDescription('Transfer ownership of a group to another server member')
            .addStringOption(opt =>
                opt
                    .setName('group')
                    .setDescription('Code name of the group to transfer')
                    .setRequired(true),
            )
            .addUserOption(opt =>
                opt
                    .setName('user')
                    .setDescription('Server member to transfer ownership to')
                    .setRequired(true),
            ),
    )
    .addSubcommand(sub =>
        sub
            .setName('viewroles')
            .setDescription('View roles for a group (pick from a list if there is more than one)'),
    )
    .addSubcommand(sub =>
        sub
            .setName('info')
            .setDescription('View members and roles for a group')
            .addStringOption(opt =>
                opt
                    .setName('code_name')
                    .setDescription('Code name of the group')
                    .setRequired(true),
            ),
    )
    .addSubcommand(sub =>
        sub
            .setName('viewmembers')
            .setDescription('View a plain-text card of members by role (pick from a list if there is more than one)'),
    )
    .addSubcommand(sub =>
        sub
            .setName('delete')
            .setDescription('Delete a group you own from KARC (does not delete its Discord roles)'),
    );

export const modalSubcommands  = new Set(['create']);
export const publicSubcommands = new Set(['viewroles', 'viewmembers']);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const sub = interaction.options.getSubcommand();
    if (sub === 'create')            return groupCreate(interaction);
    if (sub === 'transferownership') return groupTransferOwnership(interaction);
    if (sub === 'viewroles')         return groupRole(interaction);
    if (sub === 'info')              return groupInfo(interaction);
    if (sub === 'viewmembers')       return groupViewMembers(interaction);
    if (sub === 'delete')            return groupDelete(interaction);
}
