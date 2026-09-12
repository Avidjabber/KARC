import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { db } from '../../../db/index.js';

export function buildDeleteRoleModal(groupId: string): object {
    return {
        title:      'Delete Role',
        custom_id:  `roles_delete_modal:${groupId}`,
        components: [{
            type:      18,
            label:     'Role Name',
            component: { type: 4, custom_id: 'name', style: 1, max_length: 200, required: true, placeholder: 'Moon Bishop' },
        }],
    };
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

    if (groups.length === 1) {
        await interaction.showModal(buildDeleteRoleModal(groups[0].id) as never);
        return;
    }

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
                { type: 10, content: 'Select a group to delete a role from:' },
                { type: 1,  components: [{
                    type:        3,
                    custom_id:   'roles_delete_group_select',
                    placeholder: 'Select a group',
                    options,
                }]},
            ],
        }],
    } as never);
}
