import { MessageFlags, StringSelectMenuInteraction } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { db } from '../../../db/index.js';
import { buildInfoCardComponents } from './info.js';

// customId: character_info_select  (characterId from values[0])
export async function handleCharacterInfoSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const characterId = interaction.values[0];
    const guildId      = interaction.guildId!;

    const character = await db.character.findUnique({
        where:   { id: characterId },
        include: {
            career:    { select: { value: true } },
            residence: { select: { value: true } },
            memberships: {
                include: {
                    group:     { select: { name: true } },
                    groupRole: { select: { name: true, subName: true } },
                },
            },
        },
    });

    if (!character || character.guildId !== guildId) {
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'That character no longer exists.' }] }],
        } as never);
        return;
    }

    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: buildInfoCardComponents(character),
    } as never);
}
