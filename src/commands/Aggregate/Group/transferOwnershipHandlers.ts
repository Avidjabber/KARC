import { ButtonInteraction, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { db } from '../../../db/index.js';

function parseCustomId(customId: string): { groupId: string; ownerId: string; targetUserId: string } | null {
    const parts = customId.split(':');
    if (parts.length !== 4) return null;
    const [, groupId, ownerId, targetUserId] = parts;
    if (!groupId || !ownerId || !targetUserId) return null;
    return { groupId, ownerId, targetUserId };
}

export async function handleGroupTransferAccept(interaction: ButtonInteraction): Promise<void> {
    const parsed = parseCustomId(interaction.customId);
    if (!parsed) return;
    const { groupId, ownerId, targetUserId } = parsed;

    if (interaction.user.id !== targetUserId) {
        await interaction.reply({
            flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'This request is not for you.' }] }],
        } as never);
        return;
    }

    const group = await db.group.findUnique({ where: { id: groupId } });

    if (!group) {
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'This group no longer exists.' }] }],
        } as never);
        return;
    }

    if (group.ownerId !== ownerId) {
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, components: [{ type: 10, content: '*This transfer request is no longer valid.*' }] }],
        } as never);
        return;
    }

    await db.group.update({
        where: { id: groupId },
        data:  { ownerId: targetUserId },
    });

    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: [{
            type:         17,
            accent_color: colors.success,
            components:   [{ type: 10, content: `## Ownership Transferred\n<@${targetUserId}> has accepted ownership of **${group.name}** (\`${group.codeName}\`).` }],
        }],
    } as never);
}

export async function handleGroupTransferReject(interaction: ButtonInteraction): Promise<void> {
    const parsed = parseCustomId(interaction.customId);
    if (!parsed) return;
    const { groupId, ownerId, targetUserId } = parsed;

    if (interaction.user.id !== targetUserId) {
        await interaction.reply({
            flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'This request is not for you.' }] }],
        } as never);
        return;
    }

    const group = await db.group.findUnique({ where: { id: groupId } });
    const name  = group ? `**${group.name}** (\`${group.codeName}\`)` : 'the group';

    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: [{
            type:         17,
            accent_color: colors.error,
            components:   [{ type: 10, content: `<@${targetUserId}> declined the ownership transfer of ${name} from <@${ownerId}>.` }],
        }],
    } as never);
}
