import { ButtonInteraction, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { buildViewMembersComponents, fetchGroupWithMembers } from './viewMembers.js';
import { db } from '../../../db/index.js';

export async function handleViewMembersUpdate(interaction: ButtonInteraction): Promise<void> {
    const codeName = interaction.customId.slice('group_viewmembers_update:'.length);
    const guildId  = interaction.guildId!;

    await interaction.deferUpdate();

    const group = await db.group.findUnique({
        where:   { codeName },
        include: {
            roles: {
                include: { members: { select: { userId: true, characterName: true } } },
                orderBy: { position: 'asc' },
            },
        },
    });
    if (!group || group.guildId !== guildId) return;

    await interaction.editReply({
        flags:      MessageFlags.IsComponentsV2,
        components: buildViewMembersComponents(group, 0),
    } as never);
}

export async function handleViewMembersPage(interaction: ButtonInteraction): Promise<void> {
    const parts   = interaction.customId.split(':');
    const groupId = parts[1];
    const page    = parseInt(parts[2] ?? '0', 10);

    const group = await fetchGroupWithMembers(groupId);

    if (!group) {
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'This group no longer exists.' }] }],
        } as never);
        return;
    }

    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: buildViewMembersComponents(group, page),
    } as never);
}
