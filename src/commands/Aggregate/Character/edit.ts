import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { isServerAdmin } from '../../../core/permissions.js';
import { db } from '../../../db/index.js';

export function buildEditCharacterModal(character: { id: string; name: string; bio: string | null }): object {
    return {
        title:      'Edit Character',
        custom_id:  `character_edit_modal:${character.id}`,
        components: [
            {
                type:      18,
                label:     'Name',
                component: { type: 4, custom_id: 'name', style: 1, max_length: 200, required: true, placeholder: "Ko'har", value: character.name },
            },
            {
                type:        18,
                label:       'Bio',
                description: 'Optional — a small bio or other details',
                component:   { type: 4, custom_id: 'bio', style: 2, max_length: 1000, required: false, placeholder: 'A short description of your character...', value: character.bio ?? '' },
            },
        ],
    };
}

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
        await interaction.showModal(buildEditCharacterModal(characters[0]) as never);
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
