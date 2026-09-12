import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { execute as rolesCreate }         from './create.js';
import { execute as rolesEdit }           from './edit.js';
import { execute as rolesAssign }         from './assign.js';
import { execute as rolesRemove }         from './remove.js';
import { execute as rolesPromote }        from './promote.js';
import { execute as rolesDemote }         from './demote.js';
import { execute as rolesSetProgression } from './setProgression.js';
import { execute as rolesDelete }         from './delete.js';
import { execute as rolesSync }           from './sync.js';

export const data = new SlashCommandBuilder()
    .setName('roles')
    .setDescription('Manage group roles and member assignments')
    .addSubcommand(sub =>
        sub
            .setName('create')
            .setDescription('Create a new role for a group you manage'),
    )
    .addSubcommand(sub =>
        sub
            .setName('edit')
            .setDescription('Edit an existing role in a group you manage')
            .addRoleOption(opt =>
                opt
                    .setName('role')
                    .setDescription('The Discord role to edit')
                    .setRequired(true),
            ),
    )
    .addSubcommand(sub =>
        sub
            .setName('assign')
            .setDescription('Assign a member to a role in a group')
            .addUserOption(opt =>
                opt
                    .setName('user')
                    .setDescription('Server member to assign')
                    .setRequired(true),
            )
            .addRoleOption(opt =>
                opt
                    .setName('role')
                    .setDescription('Group role to assign')
                    .setRequired(true),
            ),
    )
    .addSubcommand(sub =>
        sub
            .setName('remove')
            .setDescription('Remove a member from a role')
            .addUserOption(opt =>
                opt
                    .setName('user')
                    .setDescription('The server member to remove')
                    .setRequired(true),
            )
            .addRoleOption(opt =>
                opt
                    .setName('role')
                    .setDescription('The role to remove them from')
                    .setRequired(true),
            ),
    )
    .addSubcommand(sub =>
        sub
            .setName('promote')
            .setDescription('Promote a member to the next role in their pathway')
            .addUserOption(opt =>
                opt
                    .setName('user')
                    .setDescription('Server member to promote')
                    .setRequired(true),
            ),
    )
    .addSubcommand(sub =>
        sub
            .setName('demote')
            .setDescription('Demote a member to the previous role in their pathway')
            .addUserOption(opt =>
                opt
                    .setName('user')
                    .setDescription('Server member to demote')
                    .setRequired(true),
            ),
    )
    .addSubcommand(sub =>
        sub
            .setName('setprogression')
            .setDescription('Link two roles in a progression chain')
            .addRoleOption(opt =>
                opt
                    .setName('from')
                    .setDescription('The role that leads forward')
                    .setRequired(true),
            )
            .addRoleOption(opt =>
                opt
                    .setName('to')
                    .setDescription('The role being progressed into')
                    .setRequired(true),
            ),
    )
    .addSubcommand(sub =>
        sub
            .setName('delete')
            .setDescription('Delete a role from a group and remove it from all members'),
    )
    .addSubcommand(sub =>
        sub
            .setName('sync')
            .setDescription('Sync your groups\' roles with their linked Discord roles (name, color, members)'),
    );

export const modalSubcommands = new Set(['create', 'edit', 'assign', 'delete']);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const sub = interaction.options.getSubcommand();
    if (sub === 'create')        return rolesCreate(interaction);
    if (sub === 'edit')          return rolesEdit(interaction);
    if (sub === 'assign')        return rolesAssign(interaction);
    if (sub === 'remove')        return rolesRemove(interaction);
    if (sub === 'promote')       return rolesPromote(interaction);
    if (sub === 'demote')        return rolesDemote(interaction);
    if (sub === 'setprogression') return rolesSetProgression(interaction);
    if (sub === 'delete')        return rolesDelete(interaction);
    if (sub === 'sync')          return rolesSync(interaction);
}
