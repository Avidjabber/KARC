import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { db } from '../../../db/index.js';

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId!;
    const userId  = interaction.user.id;

    const characters = await db.character.findMany({
        where:   { guildId, userId },
        orderBy: { name: 'asc' },
        include: {
            memberships: {
                include: {
                    group:     { select: { name: true, codeName: true } },
                    groupRole: { select: { name: true, position: true } },
                },
            },
        },
    });

    if (characters.length === 0) {
        await interaction.editReply({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'You do not have any characters in this server yet. Use `/character create` to make one.' }] }],
        } as never);
        return;
    }

    const inner: unknown[] = [
        { type: 10, content: '## Your Characters' },
        { type: 14, divider: true },
    ];

    for (const c of characters) {
        const roles = c.memberships.length > 0
            ? c.memberships.map(m => `${m.groupRole.name} in **${m.group.name}**`).join('\n')
            : '*Not currently assigned to any role.*';
        const bioLine = c.bio ? `\n-# ${c.bio}` : '';
        inner.push({ type: 10, content: `**${c.name}**${bioLine}\n${roles}` });
    }

    await interaction.editReply({
        flags:      MessageFlags.IsComponentsV2,
        components: [{ type: 17, components: inner }],
    } as never);
}
