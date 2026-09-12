import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { db } from '../../../db/index.js';

export function buildDeleteConfirmation(character: {
    id: string;
    name: string;
    memberships: Array<{ group: { name: string }; groupRole: { name: string } }>;
}): object {
    const warning = character.memberships.length > 0
        ? `\n-# This will also remove them from: ${character.memberships.map(m => `**${m.groupRole.name}** in **${m.group.name}**`).join(', ')} (Discord roles included).`
        : '';

    return {
        type:       17,
        components: [
            { type: 10, content: `Are you sure you want to delete **${character.name}**?${warning}` },
            { type: 1,  components: [
                { type: 2, style: 4, label: 'Delete',  custom_id: `character_delete_confirm:${character.id}` },
                { type: 2, style: 2, label: 'Cancel', custom_id: 'character_delete_cancel' },
            ]},
        ],
    };
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId!;
    const userId  = interaction.user.id;

    const characters = await db.character.findMany({
        where:   { guildId, userId },
        orderBy: { name: 'asc' },
        include: {
            memberships: {
                include: {
                    group:     { select: { name: true } },
                    groupRole: { select: { name: true } },
                },
            },
        },
    });

    if (characters.length === 0) {
        await interaction.editReply({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'You do not have any characters in this server.' }] }],
        } as never);
        return;
    }

    if (characters.length === 1) {
        await interaction.editReply({
            flags:      MessageFlags.IsComponentsV2,
            components: [buildDeleteConfirmation(characters[0])],
        } as never);
        return;
    }

    const options = characters.map(c => ({
        label:       c.name,
        value:       c.id,
        description: c.memberships.length > 0 ? `${c.memberships.length} role(s)` : 'No roles',
    }));

    await interaction.editReply({
        flags:      MessageFlags.IsComponentsV2,
        components: [{
            type:       17,
            components: [
                { type: 10, content: 'Select a character to delete:' },
                { type: 1,  components: [{
                    type:        3,
                    custom_id:   'character_delete_select',
                    placeholder: 'Select a character',
                    options,
                }]},
            ],
        }],
    } as never);
}
