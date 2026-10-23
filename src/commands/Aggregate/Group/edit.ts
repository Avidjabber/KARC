import { DEFAULT_GRAPH_THEME, GRAPH_THEME_OPTIONS, isGraphTheme } from '../../../core/roleGraph.js';
import { isServerAdmin } from '../../../core/permissions.js';
import { db } from '../../../db/index.js';

type EditableGroup = { id: string; name: string; codeName: string; backgroundTheme: string };

/** Server admins, the owner, and members holding a Can Manage Group role may edit a group's settings. */
export async function canEditGroup(
    group:       { id: string; ownerId: string },
    interaction: Parameters<typeof isServerAdmin>[0] & { user: { id: string } },
): Promise<boolean> {
    if (isServerAdmin(interaction) || group.ownerId === interaction.user.id) return true;
    const manager = await db.groupRoleMember.findFirst({
        where: { groupId: group.id, userId: interaction.user.id, groupRole: { canManageGroup: true } },
    });
    return !!manager;
}

export function buildGroupEditModal(group: EditableGroup): object {
    const current = isGraphTheme(group.backgroundTheme) ? group.backgroundTheme : DEFAULT_GRAPH_THEME;
    return {
        title:      'Edit Group',
        custom_id:  `group_edit_modal:${group.id}`,
        components: [
            {
                type:      18,
                label:     'Display Name',
                component: { type: 4, custom_id: 'name', style: 1, max_length: 200, required: true, value: group.name },
            },
            {
                type:        18,
                label:       'Code Name',
                description: 'Lowercase letters, numbers, and underscores only — must be globally unique',
                component:   { type: 4, custom_id: 'code_name', style: 1, max_length: 200, required: true, value: group.codeName },
            },
            {
                type:        18,
                label:       'Background Theme',
                description: 'Decor behind the role graph image',
                component:   {
                    type:      21,
                    custom_id: 'background_theme',
                    required:  true,
                    options:   GRAPH_THEME_OPTIONS.map(o => ({ ...o, default: o.value === current })),
                },
            },
        ],
    };
}
