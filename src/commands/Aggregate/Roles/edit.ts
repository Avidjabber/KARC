import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { db } from '../../../db/index.js';

export function buildEditRoleModal(
    groupId: string, canManageGroup: boolean, canManageAssignments: boolean,
    role: { id: string; name: string; position: number; color: string | null; subName: string | null },
): object {
    return {
        title:      'Edit Role',
        custom_id:  `roles_edit_modal:${groupId}:${role.id}:${canManageGroup}:${canManageAssignments}`,
        components: [
            {
                type:      18,
                label:     'Role Name',
                component: { type: 4, custom_id: 'name', style: 1, max_length: 200, required: true, placeholder: 'Moon Bishop', value: role.name },
            },
            {
                type:        18,
                label:       'Rank',
                description: 'A whole number from 1 to 1000 — higher means more senior',
                component:   { type: 4, custom_id: 'position', style: 1, max_length: 4, required: true, placeholder: '10', value: String(role.position) },
            },
            {
                type:        18,
                label:       'Subname (optional)',
                description: 'A secondary label for this role, shown alongside its name',
                component:   { type: 4, custom_id: 'sub_name', style: 1, max_length: 100, required: false, placeholder: 'e.g. Warrior', value: role.subName ?? '' },
            },
            {
                type:        18,
                label:       'Color (optional)',
                description: 'Hex color code, e.g. #7289da — leave blank for default',
                component:   { type: 4, custom_id: 'color', style: 1, max_length: 7, required: false, placeholder: '#7289da', value: role.color ?? '' },
            },
        ],
    };
}

export function buildEditTogglesComponents(
    groupId: string, roleId: string, canManageGroup: boolean, canManageAssignments: boolean,
): unknown[] {
    const mg = String(canManageGroup);
    const ma = String(canManageAssignments);

    return [{
        type:       17,
        components: [
            { type: 10, content: 'Set permissions for this role, then press **Next**:' },
            { type: 1, components: [{
                type:        3,
                custom_id:   `roles_edit_setmg:${groupId}:${roleId}:${ma}`,
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
                custom_id:   `roles_edit_setma:${groupId}:${roleId}:${mg}`,
                placeholder: 'Can Manage Assignments',
                min_values:  1,
                max_values:  1,
                options: [
                    { label: 'Can Manage Assignments: No',  value: 'false', default: !canManageAssignments },
                    { label: 'Can Manage Assignments: Yes', value: 'true',  default: canManageAssignments },
                ],
            }]},
            { type: 1, components: [
                { type: 2, style: 1, label: 'Next', custom_id: `roles_edit_next:${groupId}:${roleId}:${mg}:${ma}` },
            ]},
        ],
    }];
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const discordRole = interaction.options.getRole('role', true);
    const roleName    = discordRole.name;
    const guildId     = interaction.guildId!;
    const userId      = interaction.user.id;

    // Find all GroupRoles with this name in groups the caller can manage
    const matches = await db.groupRole.findMany({
        where: {
            name:  { equals: roleName, mode: 'insensitive' },
            group: {
                guildId,
                OR: [
                    { ownerId: userId },
                    { members: { some: { userId, groupRole: { canManageGroup: true } } } },
                ],
            },
        },
        include: { group: true },
        orderBy: { group: { name: 'asc' } },
    });

    if (matches.length === 0) {
        await interaction.reply({
            flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: `No role named **${roleName}** found in any group you manage in this server.` }] }],
        } as never);
        return;
    }

    // Single match: go straight to the permissions step
    if (matches.length === 1) {
        const role = matches[0];
        await interaction.reply({
            flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            components: buildEditTogglesComponents(role.group.id, role.id, role.canManageGroup, role.canManageAssignments),
        } as never);
        return;
    }

    // Multiple groups have this role name: show group picker
    const options = matches.map(r => ({
        label:       r.group.name,
        value:       r.id,
        description: r.group.codeName,
    }));

    await interaction.reply({
        flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        components: [{
            type:       17,
            components: [
                { type: 10, content: `**${roleName}** exists in multiple groups you manage. Choose which one to edit:` },
                { type: 1,  components: [{
                    type:        3,
                    custom_id:   'roles_edit_group_select',
                    placeholder: 'Select a group',
                    options,
                }]},
            ],
        }],
    } as never);
}
