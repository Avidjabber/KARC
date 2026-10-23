import { ContainerBuilder, GuildMember, MessageFlags, PartialGuildMember, TextDisplayBuilder } from 'discord.js';
import { colors } from '../core/colors.js';
import { db } from '../db/index.js';

/**
 * Notify-only cleanup hook: when a member leaves, nothing in the database or on Discord is
 * touched automatically. If they still held a role in any group, each affected group's owner
 * gets a DM summarizing what they held, so the owner can decide whether to run
 * `/roles remove` or `/character purge`.
 */
export default async function onGuildMemberRemove(member: GuildMember | PartialGuildMember): Promise<void> {
    try {
        const guildId = member.guild.id;
        const userId  = member.id;

        const characters = await db.character.findMany({
            where:   { guildId, userId },
            orderBy: { name: 'asc' },
            include: {
                memberships: {
                    include: {
                        group:     { select: { id: true, name: true, ownerId: true } },
                        groupRole: { select: { name: true } },
                    },
                },
            },
        });

        // Group affected characters by the owner of each group they held a role in, so an
        // owner with multiple groups (or multiple characters in the same group) gets one DM.
        const byOwner = new Map<string, Map<string, { groupName: string; entries: string[] }>>();
        for (const character of characters) {
            for (const m of character.memberships) {
                if (m.group.ownerId === userId) continue; // the departing member owns this group themselves

                const ownerGroups = byOwner.get(m.group.ownerId) ?? new Map();
                const entry = ownerGroups.get(m.group.id) ?? { groupName: m.group.name, entries: [] };
                entry.entries.push(`${character.name} — ${m.groupRole.name}`);
                ownerGroups.set(m.group.id, entry);
                byOwner.set(m.group.ownerId, ownerGroups);
            }
        }

        for (const [ownerId, groups] of byOwner) {
            const lines = [...groups.values()]
                .map(g => `**${g.groupName}**\n${g.entries.map(e => `- ${e}`).join('\n')}`)
                .join('\n\n');

            const container = new ContainerBuilder()
                .setAccentColor(colors.warning)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `**${member.user.tag}** just left **${member.guild.name}** while still holding a role in your group(s):\n\n${lines}\n\n`
                        + `-# Nothing has been changed. Run \`/roles remove\` or \`/character purge\` if you want to clean this up.`,
                    ),
                );

            try {
                const owner = await member.client.users.fetch(ownerId);
                await owner.send({ flags: MessageFlags.IsComponentsV2, components: [container] } as never);
            } catch (err) {
                console.error(`[onGuildMemberRemove] Failed to DM group owner ${ownerId}:`, err);
            }
        }
    } catch (err) {
        console.error('[onGuildMemberRemove] Failed to process member leave:', err);
    }
}
