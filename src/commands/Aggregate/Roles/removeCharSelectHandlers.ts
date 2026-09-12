import { MessageFlags, StringSelectMenuInteraction } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { db } from '../../../db/index.js';
import { buildRemoveConfirmation } from './remove.js';

// customId: roles_remove_char_select  (memberId from values[0])
export async function handleRemoveCharSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const memberId = interaction.values[0];
    const guildId  = interaction.guildId!;

    const member = await db.groupRoleMember.findUnique({
        where:   { id: memberId },
        include: { groupRole: true, group: true, character: { select: { name: true } } },
    });

    if (!member || member.group.guildId !== guildId) {
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'Member record no longer exists.' }] }],
        } as never);
        return;
    }

    const userMention = `<@${member.userId}>`;

    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: [buildRemoveConfirmation(memberId, member.character.name, userMention, member.groupRole.name, member.group.name)],
    } as never);
}
