import { MessageFlags, ModalSubmitInteraction } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { validateDisplayName, validateCodeName, FILTER_MESSAGES } from '../../../core/contentFilter.js';
import { extractField } from '../../../core/modalUtils.js';
import { db } from '../../../db/index.js';

// customId: group_create_modal
export async function handleGroupCreateModal(interaction: ModalSubmitInteraction): Promise<void> {
    const rawName     = extractField(interaction, 'name');
    const rawCodeName = extractField(interaction, 'code_name');
    const guildId     = interaction.guildId!;
    const userId      = interaction.user.id;

    const nameResult     = validateDisplayName(rawName);
    const codeNameResult = validateCodeName(rawCodeName);

    if (!nameResult.valid || !codeNameResult.valid) {
        const lines: string[] = [];
        if (!nameResult.valid)     lines.push(`**Display Name** ${FILTER_MESSAGES[nameResult.reason]}`);
        if (!codeNameResult.valid) lines.push(`**Code Name** ${FILTER_MESSAGES[codeNameResult.reason]}`);

        await interaction.reply({
            flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: lines.join('\n') }] }],
        } as never);
        return;
    }

    const name     = nameResult.value;
    const codeName = codeNameResult.value;

    if (!name || !codeName) {
        await interaction.reply({
            flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'Both Display Name and Code Name are required.' }] }],
        } as never);
        return;
    }

    let group;
    try {
        group = await db.group.create({
            data: { codeName, name, ownerId: userId, guildId },
        });
    } catch (err) {
        const isPrismaUnique = (err as { code?: string }).code === 'P2002';
        const content = isPrismaUnique
            ? `A group with code name \`${codeName}\` already exists.`
            : 'Something went wrong. Please try again.';
        if (!isPrismaUnique) console.error('[handleGroupCreateModal]', err);

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
            components:   [{ type: 10, content: `## Group Created\n**${group.name}** (\`${group.codeName}\`) has been created.` }],
        }],
    } as never);
}
