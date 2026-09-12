import { ButtonInteraction, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { db } from '../../../db/index.js';
import { buildGroupPickerComponents, PickAction } from './groupPicker.js';
import { renderRoleView } from './role.js';
import { buildViewMembersComponents, fetchGroupWithMembers } from './viewMembers.js';

async function fetchGroupsForGuild(guildId: string) {
    return db.group.findMany({
        where:   { guildId },
        select:  { id: true, codeName: true, name: true },
        orderBy: { name: 'asc' },
    });
}

const notFound = [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'This group no longer exists.' }] }];

export async function handleGroupPickPage(interaction: ButtonInteraction): Promise<void> {
    const parts   = interaction.customId.split(':');
    const action  = parts[1] as PickAction;
    const page    = parseInt(parts[2] ?? '0', 10);
    const guildId = interaction.guildId!;

    const groups = await fetchGroupsForGuild(guildId);

    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: buildGroupPickerComponents(groups, page, action),
    } as never);
}

export async function handleGroupPickView(interaction: ButtonInteraction): Promise<void> {
    const parts   = interaction.customId.split(':');
    const action  = parts[1] as PickAction;
    const groupId = parts[2];
    const guildId = interaction.guildId!;

    await interaction.deferUpdate();

    if (action === 'viewroles') {
        const view = await renderRoleView(groupId, guildId);
        if (!view) {
            await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: notFound } as never);
            return;
        }
        await interaction.editReply({
            flags:      MessageFlags.IsComponentsV2,
            files:      view.files,
            components: view.components,
        } as never);
        return;
    }

    const group = await fetchGroupWithMembers(groupId);
    if (!group || group.guildId !== guildId) {
        await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: notFound } as never);
        return;
    }
    await interaction.editReply({
        flags:      MessageFlags.IsComponentsV2,
        components: buildViewMembersComponents(group, 0),
    } as never);
}
