import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { db } from '../../../db/index.js';

export type CharacterForCard = {
    name:    string;
    bio:     string | null;
    userId:  string;
    career:    { value: string } | null;
    residence: { value: string } | null;
    memberships: Array<{
        group:     { name: string };
        groupRole: { name: string; subName: string | null };
    }>;
};

export function buildInfoCardComponents(character: CharacterForCard): unknown[] {
    const careerText    = character.career ? character.career.value : 'None';
    const residenceText = character.residence ? character.residence.value : 'None';
    const bioText       = character.bio ? character.bio : '*No bio set.*';

    const membershipLines = character.memberships.length > 0
        ? character.memberships.map(m => `**${m.group.name}**: ${m.groupRole.name}${m.groupRole.subName ? ` - *${m.groupRole.subName}*` : ''}`)
        : ['*Not currently in any groups.*'];

    return [{
        type:       17,
        components: [
            { type: 10, content: `## ${character.name}` },
            { type: 10, content: `*${careerText}* - **${residenceText}**` },
            { type: 14, divider: true },
            { type: 10, content: bioText },
            { type: 14, divider: true },
            { type: 10, content: membershipLines.join('\n') },
            { type: 14, divider: true },
            { type: 10, content: `-# Owner: <@${character.userId}>` },
        ],
    }];
}

const characterInclude = {
    career:    { select: { value: true } },
    residence: { select: { value: true } },
    memberships: {
        include: {
            group:     { select: { name: true } },
            groupRole: { select: { name: true, subName: true } },
        },
    },
} as const;

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId    = interaction.guildId!;
    const targetUser = interaction.options.getUser('user') ?? interaction.user;
    const isSelf     = targetUser.id === interaction.user.id;

    const characters = await db.character.findMany({
        where:   { guildId, userId: targetUser.id },
        orderBy: { name: 'asc' },
        include: characterInclude,
    });

    if (characters.length === 0) {
        const content = isSelf
            ? 'You do not have any characters in this server yet.'
            : `${targetUser} does not have any characters in this server.`;
        await interaction.editReply({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content }] }],
        } as never);
        return;
    }

    if (characters.length === 1) {
        await interaction.editReply({
            flags:      MessageFlags.IsComponentsV2,
            components: buildInfoCardComponents(characters[0]),
        } as never);
        return;
    }

    const options = characters.map(c => ({
        label:       c.name,
        value:       c.id,
        description: c.career ? c.career.value : undefined,
    }));

    await interaction.editReply({
        flags:      MessageFlags.IsComponentsV2,
        components: [{
            type:       17,
            components: [
                { type: 10, content: isSelf ? 'Select a character to view:' : `Select one of ${targetUser}'s characters to view:` },
                { type: 1,  components: [{
                    type:        3,
                    custom_id:   'character_info_select',
                    placeholder: 'Select a character',
                    options,
                }]},
            ],
        }],
    } as never);
}
