import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { db } from '../../../db/index.js';

export function buildCreateRoleModal(groupId: string, canManageGroup: boolean, canManageAssignments: boolean): object {
    return {
        title:      'Create Role',
        custom_id:  `roles_create_modal:${groupId}:${canManageGroup}:${canManageAssignments}`,
        components: [
            {
                type:      18,
                label:     'Role Name',
                component: { type: 4, custom_id: 'name', style: 1, max_length: 200, required: true, placeholder: 'Moon Bishop' },
            },
            {
                type:        18,
                label:       'Rank',
                description: 'A whole number from 1 to 1000 — higher means more senior',
                component:   { type: 4, custom_id: 'position', style: 1, max_length: 4, required: true, placeholder: '10' },
            },
            {
                type:        18,
                label:       'Subname (optional)',
                description: 'A secondary label for this role, shown alongside its name',
                component:   { type: 4, custom_id: 'sub_name', style: 1, max_length: 100, required: false, placeholder: 'e.g. Warrior' },
            },
            {
                type:        18,
                label:       'Color (optional)',
                description: 'Hex color code, e.g. #7289da — leave blank for default',
                component:   { type: 4, custom_id: 'color', style: 1, max_length: 7, required: false, placeholder: '#7289da' },
            },
        ],
    };
}

export function buildCreateTogglesComponents(groupId: string, canManageGroup: boolean, canManageAssignments: boolean): unknown[] {
    const mg = String(canManageGroup);
    const ma = String(canManageAssignments);

    return [{
        type:       17,
        components: [
            { type: 10, content: 'Set permissions for the new role, then press **Next**:' },
            { type: 1, components: [{
                type:        3,
                custom_id:   `roles_create_setmg:${groupId}:${ma}`,
                placeholder: 'Can Manage Group',
                min_values:  1,
                max_values:  1,
                options: [
                    { label: 'Can Manage Group: No',  value: 'false', default: !canManageGroup },
                    { label: 'Can Manage Group: Yes', value: 'true',  default: canManageGroup },
                ],
            }]},
            { type: 1, components: [{
                type:        3,
                custom_id:   `roles_create_setma:${groupId}:${mg}`,
                placeholder: 'Can Manage Assignments',
                min_values:  1,
                max_values:  1,
                options: [
                    { label: 'Can Manage Assignments: No',  value: 'false', default: !canManageAssignments },
                    { label: 'Can Manage Assignments: Yes', value: 'true',  default: canManageAssignments },
                ],
            }]},
            { type: 1, components: [
                { type: 2, style: 1, label: 'Next', custom_id: `roles_create_next:${groupId}:${mg}:${ma}` },
            ]},
        ],
    }];
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId!;
    const userId  = interaction.user.id;

    const groups = await db.group.findMany({
        where: {
            guildId,
            OR: [
                { ownerId: userId },
                { members: { some: { userId, groupRole: { canManageGroup: true } } } },
            ],
        },
        orderBy: { name: 'asc' },
    });

    if (groups.length === 0) {
        await interaction.reply({
            flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'You do not own or manage any groups in this server.' }] }],
        } as never);
        return;
    }

    // Single group: go straight to the permissions step
    if (groups.length === 1) {
        await interaction.reply({
            flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            components: buildCreateTogglesComponents(groups[0].id, false, false),
        } as never);
        return;
    }

    // Multiple groups: show group select
    const options = groups.map(g => ({
        label:       g.name,
        value:       g.id,
        description: g.codeName,
    }));

    await interaction.reply({
        flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        components: [{
            type:       17,
            components: [
                { type: 10, content: 'Select a group to create a role in:' },
                { type: 1,  components: [{
                    type:        3,
                    custom_id:   'roles_create_group_select',
                    placeholder: 'Select a group',
                    options,
                }]},
            ],
        }],
    } as never);
}
