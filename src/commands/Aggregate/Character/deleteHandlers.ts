import { ButtonInteraction, MessageFlags, StringSelectMenuInteraction } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { db } from '../../../db/index.js';
import { buildDeleteConfirmation } from './delete.js';

// customId: character_delete_select
export async function handleCharacterDeleteSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const characterId = interaction.values[0];
    const userId      = interaction.user.id;
    const guildId     = interaction.guildId!;

    const character = await db.character.findUnique({
        where:   { id: characterId },
        include: {
            memberships: {
                include: {
                    group:     { select: { name: true } },
                    groupRole: { select: { name: true } },
                },
            },
        },
    });

    if (!character || character.guildId !== guildId || character.userId !== userId) {
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'That character no longer exists.' }] }],
        } as never);
        return;
    }

    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: [buildDeleteConfirmation(character)],
    } as never);
}

// customId: character_delete_confirm:<characterId>
export async function handleCharacterDeleteConfirm(interaction: ButtonInteraction): Promise<void> {
    const characterId = interaction.customId.slice('character_delete_confirm:'.length);
    const userId       = interaction.user.id;
    const guildId      = interaction.guildId!;

    const character = await db.character.findUnique({
        where:   { id: characterId },
        include: {
            memberships: {
                include: {
                    group:     true,
                    groupRole: true,
                },
            },
        },
    });

    if (!character || character.guildId !== guildId || character.userId !== userId) {
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'That character no longer exists.' }] }],
        } as never);
        return;
    }

    for (const membership of character.memberships) {
        if (!membership.groupRole.discordRoleId) continue;
        try {
            const discordMember = await interaction.guild!.members.fetch(character.userId);
            await discordMember.roles.remove(
                membership.groupRole.discordRoleId,
                `KARC: character ${character.name} deleted`,
            );
        } catch (err) {
            console.error('[character delete confirm] Discord role remove failed:', err);
        }
    }

    // Cascades to GroupRoleMember rows for this character.
    await db.character.delete({ where: { id: characterId } });

    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: [{
            type:         17,
            accent_color: colors.success,
            components:   [{ type: 10, content: `**${character.name}** has been deleted.` }],
        }],
    } as never);
}

export async function handleCharacterDeleteCancel(interaction: ButtonInteraction): Promise<void> {
    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: [{ type: 17, components: [{ type: 10, content: 'Cancelled.' }] }],
    } as never);
}
