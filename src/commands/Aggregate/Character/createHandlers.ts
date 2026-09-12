import { MessageFlags, ModalSubmitInteraction } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { validateDisplayName, validateBio, FILTER_MESSAGES } from '../../../core/contentFilter.js';
import { extractField } from '../../../core/modalUtils.js';
import { db } from '../../../db/index.js';

// customId: character_create_modal
export async function handleCharacterCreateModal(interaction: ModalSubmitInteraction): Promise<void> {
    const rawName = extractField(interaction, 'name');
    const rawBio  = extractField(interaction, 'bio');
    const guildId = interaction.guildId!;
    const userId  = interaction.user.id;

    const nameResult = validateDisplayName(rawName);
    const bioResult  = validateBio(rawBio);

    if (!nameResult.valid || !bioResult.valid) {
        const lines: string[] = [];
        if (!nameResult.valid) lines.push(`**Name** ${FILTER_MESSAGES[nameResult.reason]}`);
        if (!bioResult.valid)  lines.push(`**Bio** ${FILTER_MESSAGES[bioResult.reason]}`);

        await interaction.reply({
            flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: lines.join('\n') }] }],
        } as never);
        return;
    }

    const name = nameResult.value;
    const bio  = bioResult.value || null;

    try {
        await db.character.create({ data: { guildId, userId, name, bio } });
    } catch (err) {
        const isDuplicate = (err as { code?: string }).code === 'P2002';
        const content = isDuplicate
            ? `You already have a character named **${name}** in this server.`
            : 'Something went wrong. Please try again.';
        if (!isDuplicate) console.error('[handleCharacterCreateModal]', err);

        await interaction.reply({
            flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content }] }],
        } as never);
        return;
    }

    await interaction.reply({
        flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        components: [{
            type:         17,
            accent_color: colors.success,
            components:   [{ type: 10, content: `## Character Created\n**${name}** has been added to your roster.` }],
        }],
    } as never);
}
