import { MessageFlags, ModalSubmitInteraction, StringSelectMenuInteraction } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { validateDisplayName, validateBio, FILTER_MESSAGES } from '../../../core/contentFilter.js';
import { extractField } from '../../../core/modalUtils.js';
import { isServerAdmin } from '../../../core/permissions.js';
import { db } from '../../../db/index.js';
import { buildEditCharacterModal } from './edit.js';

// customId: character_edit_select
export async function handleCharacterEditSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const characterId = interaction.values[0];
    const userId      = interaction.user.id;
    const guildId     = interaction.guildId!;

    const character = await db.character.findUnique({ where: { id: characterId } });
    if (!character || character.guildId !== guildId) {
        await interaction.update({
            flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'That character no longer exists.' }] }],
        } as never);
        return;
    }

    if (character.userId !== userId && !isServerAdmin(interaction)) {
        await interaction.update({
            flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'Only an Administrator can edit another member\'s characters.' }] }],
        } as never);
        return;
    }

    await interaction.showModal(buildEditCharacterModal(character) as never);
}

// customId: character_edit_modal:<characterId>
export async function handleCharacterEditModal(interaction: ModalSubmitInteraction): Promise<void> {
    const [, characterId] = interaction.customId.split(':');
    const userId  = interaction.user.id;
    const guildId = interaction.guildId!;

    const rawName = extractField(interaction, 'name');
    const rawBio  = extractField(interaction, 'bio');

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

    const character = await db.character.findUnique({ where: { id: characterId } });
    if (!character || character.guildId !== guildId) {
        await interaction.reply({
            flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'That character no longer exists.' }] }],
        } as never);
        return;
    }

    const isSelf = character.userId === userId;
    if (!isSelf && !isServerAdmin(interaction)) {
        await interaction.reply({
            flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'Only an Administrator can edit another member\'s characters.' }] }],
        } as never);
        return;
    }

    const name = nameResult.value;
    const bio  = bioResult.value || null;

    try {
        await db.character.update({ where: { id: characterId }, data: { name, bio } });
    } catch (err) {
        const isDuplicate = (err as { code?: string }).code === 'P2002';
        const content = isDuplicate
            ? isSelf
                ? `You already have a character named **${name}** in this server.`
                : `<@${character.userId}> already has a character named **${name}** in this server.`
            : 'Something went wrong. Please try again.';
        if (!isDuplicate) console.error('[handleCharacterEditModal]', err);

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
            components:   [{ type: 10, content: `**${name}** has been updated.` }],
        }],
    } as never);
}
