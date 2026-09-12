import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { db } from '../../../db/index.js';

export function buildDeleteConfirmation(groupId: string, name: string, codeName: string): object {
    return {
        type:       17,
        components: [
            { type: 10, content: `Are you sure you want to delete **${name}** (\`${codeName}\`)?\n-# This removes the group and all of its roles, members, and progressions from KARC's database. The Discord roles themselves are not deleted.` },
            { type: 1,  components: [
                { type: 2, style: 4, label: 'Delete',  custom_id: `group_delete_confirm:${groupId}` },
                { type: 2, style: 2, label: 'Cancel', custom_id: 'group_delete_cancel' },
            ]},
        ],
    };
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId!;
    const userId  = interaction.user.id;

    const groups = await db.group.findMany({
        where:   { guildId, ownerId: userId },
        orderBy: { name: 'asc' },
    });

    if (groups.length === 0) {
        await interaction.editReply({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'You do not own any groups in this server.' }] }],
        } as never);
        return;
    }

    if (groups.length === 1) {
        const group = groups[0];
        await interaction.editReply({
            flags:      MessageFlags.IsComponentsV2,
            components: [buildDeleteConfirmation(group.id, group.name, group.codeName)],
        } as never);
        return;
    }

    const options = groups.map(g => ({
        label:       g.name,
        value:       g.id,
        description: g.codeName,
    }));

    await interaction.editReply({
        flags:      MessageFlags.IsComponentsV2,
        components: [{
            type:       17,
            components: [
                { type: 10, content: 'Select a group to delete:' },
                { type: 1,  components: [{
                    type:        3,
                    custom_id:   'group_delete_group_select',
                    placeholder: 'Select a group',
                    options,
                }]},
            ],
        }],
    } as never);
}
