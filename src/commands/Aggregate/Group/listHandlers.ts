import { ButtonInteraction, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { db } from '../../../db/index.js';
import { buildInfoComponents } from './info.js';
import { buildGroupListComponents, fetchGroupsForList, noGroupsComponents } from './list.js';

export async function handleGroupListPage(interaction: ButtonInteraction): Promise<void> {
    const page   = parseInt(interaction.customId.split(':')[1] ?? '0', 10);
    const groups = await fetchGroupsForList(interaction.guildId!);

    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: groups.length === 0 ? noGroupsComponents : buildGroupListComponents(groups, page),
    } as never);
}

export async function handleGroupListInfo(interaction: ButtonInteraction): Promise<void> {
    const groupId = interaction.customId.split(':')[1];

    const group = await db.group.findUnique({
        where:   { id: groupId },
        include: {
            members: {
                include:  { groupRole: { select: { name: true, position: true } }, character: { select: { name: true } } },
                orderBy:  [{ groupRole: { position: 'desc' } }, { character: { name: 'asc' } }],
            },
        },
    });

    if (!group || group.guildId !== interaction.guildId) {
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'This group no longer exists.' }] }],
        } as never);
        return;
    }

    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: await buildInfoComponents(interaction.guild!, group, 0),
    } as never);
}
