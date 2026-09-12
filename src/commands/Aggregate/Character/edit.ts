import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { isServerAdmin } from '../../../core/permissions.js';
import { db } from '../../../db/index.js';
import { buildEditPanelComponents } from './editPanel.js';
import { startEditSession } from './editShared.js';

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId    = interaction.guildId!;
    const callerId   = interaction.user.id;
    const targetUser = interaction.options.getUser('user') ?? interaction.user;
    const isSelf     = targetUser.id === callerId;

    if (!isSelf && !isServerAdmin(interaction)) {
        await interaction.reply({
            flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'Only an Administrator can edit another member\'s characters.' }] }],
        } as never);
        return;
    }

    const characters = await db.character.findMany({
        where:   { guildId, userId: targetUser.id },
        orderBy: { name: 'asc' },
        include: {
            career:    { select: { id: true, value: true } },
            residence: { select: { id: true, value: true } },
        },
    });

    if (characters.length === 0) {
        const content = isSelf
            ? 'You do not have any characters in this server yet. Use `/character create` first.'
            : `${targetUser} does not have any characters in this server.`;
        await interaction.reply({
            flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content }] }],
        } as never);
        return;
    }

    if (characters.length === 1) {
        const { sessionId, session } = startEditSession(characters[0]);
        await interaction.reply({
            flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            components: buildEditPanelComponents({ sessionId, ...session.draft }),
        } as never);
        return;
    }

    const options = characters.map(c => ({
        label:       c.name,
        value:       c.id,
        description: c.bio ? c.bio.slice(0, 100) : undefined,
    }));

    await interaction.reply({
        flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        components: [{
            type:       17,
            components: [
                { type: 10, content: isSelf ? 'Select a character to edit:' : `Select one of ${targetUser}'s characters to edit:` },
                { type: 1,  components: [{
                    type:        3,
                    custom_id:   'character_edit_select',
                    placeholder: 'Select a character',
                    options,
                }]},
            ],
        }],
    } as never);
}
