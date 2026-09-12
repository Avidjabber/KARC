import { ButtonInteraction, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { db } from '../../../db/index.js';
import { buildInfoComponents, buildStatsComponents } from './info.js';

export async function handleGroupInfoPage(interaction: ButtonInteraction): Promise<void> {
    const parts   = interaction.customId.split(':');
    const groupId = parts[1];
    const page    = parseInt(parts[2] ?? '0', 10);

    const group = await db.group.findUnique({
        where:   { id: groupId },
        include: {
            members: {
                include:  { groupRole: { select: { name: true, position: true } } },
                orderBy:  [{ groupRole: { position: 'desc' } }, { characterName: 'asc' }],
            },
        },
    });

    if (!group) {
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'This group no longer exists.' }] }],
        } as never);
        return;
    }

    const components = await buildInfoComponents(interaction.guild!, group, page);
    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components,
    } as never);
}

export async function handleGroupInfoStats(interaction: ButtonInteraction): Promise<void> {
    const groupId = interaction.customId.split(':')[1];

    const group = await db.group.findUnique({
        where:   { id: groupId },
        include: {
            roles: {
                orderBy: { position: 'desc' },
                include: { _count: { select: { members: true } } },
            },
        },
    });

    if (!group) {
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'This group no longer exists.' }] }],
        } as never);
        return;
    }

    const components = await buildStatsComponents(interaction.guild!, group);
    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components,
    } as never);
}

export async function handleGroupInfoDone(interaction: ButtonInteraction): Promise<void> {
    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: [{ type: 17, components: [{ type: 10, content: '-# Group info closed.' }] }],
    } as never);
}
