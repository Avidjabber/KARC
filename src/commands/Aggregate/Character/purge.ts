import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { isServerAdmin } from '../../../core/permissions.js';
import { db } from '../../../db/index.js';

const SNOWFLAKE_RE = /^\d{17,20}$/;

export function buildPurgeConfirmation(
    userId:     string,
    characters: Array<{ name: string; memberships: Array<{ group: { name: string }; groupRole: { name: string } }> }>,
): object {
    const lines = characters.map(c => {
        const roles = c.memberships.length > 0
            ? c.memberships.map(m => `**${m.groupRole.name}** in **${m.group.name}**`).join(', ')
            : '*no roles*';
        return `**${c.name}** — ${roles}`;
    });

    return {
        type:       17,
        components: [
            { type: 10, content: `Are you sure you want to delete all **${characters.length}** character(s) belonging to <@${userId}>?\n${lines.join('\n')}\n-# This removes them from every group they hold a role in (Discord roles included, where still a server member) and permanently deletes them from KARC's database. This cannot be undone.` },
            { type: 1,  components: [
                { type: 2, style: 4, label: 'Delete All', custom_id: `character_purge_confirm:${userId}` },
                { type: 2, style: 2, label: 'Cancel',     custom_id: 'character_purge_cancel' },
            ]},
        ],
    };
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId!;

    if (!isServerAdmin(interaction)) {
        await interaction.editReply({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'Only an Administrator can purge another member\'s characters.' }] }],
        } as never);
        return;
    }

    const targetId = interaction.options.getString('userid', true).trim();

    if (!SNOWFLAKE_RE.test(targetId)) {
        await interaction.editReply({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: `\`${targetId}\` doesn't look like a valid Discord user ID.` }] }],
        } as never);
        return;
    }

    const characters = await db.character.findMany({
        where:   { guildId, userId: targetId },
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
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: `<@${targetId}> does not have any characters in this server.` }] }],
        } as never);
        return;
    }

    await interaction.editReply({
        flags:      MessageFlags.IsComponentsV2,
        components: [buildPurgeConfirmation(targetId, characters)],
    } as never);
}
