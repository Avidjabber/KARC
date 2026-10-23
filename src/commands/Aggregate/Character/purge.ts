import { ChatInputCommandInteraction, Collection, Guild, GuildMember, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { isServerAdmin } from '../../../core/permissions.js';
import { db } from '../../../db/index.js';

const PAGE_SIZE = 10;
// Discord caps a message at 4000 characters of text across all text displays — keep each entry well under 4000 / PAGE_SIZE.
const ENTRY_MAX_LENGTH = 360;

function buildEntryText(header: string, roleLines: string[]): string {
    if (roleLines.length === 0) return `${header}\n-# *No groups*`;

    const shown: string[] = [];
    for (let i = 0; i < roleLines.length; i++) {
        const more    = roleLines.length - i - 1;
        const suffix  = more > 0 ? `\n-# …and ${more} more` : '';
        const attempt = [header, ...shown, roleLines[i]].join('\n');
        if (attempt.length + suffix.length > ENTRY_MAX_LENGTH && shown.length > 0) {
            return `${[header, ...shown].join('\n')}\n-# …and ${roleLines.length - i} more`;
        }
        shown.push(roleLines[i]);
    }
    return [header, ...shown].join('\n').slice(0, ENTRY_MAX_LENGTH);
}

/** Paginated admin list of every character in the server, each with a Delete button. `notice` is shown above the list (e.g. after a deletion). */
export async function buildPurgeListComponents(guild: Guild, page: number, notice?: string): Promise<unknown[]> {
    const total      = await db.character.count({ where: { guildId: guild.id } });
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage   = Math.min(Math.max(page, 0), totalPages - 1);

    const characters = await db.character.findMany({
        where:   { guildId: guild.id },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip:    safePage * PAGE_SIZE,
        take:    PAGE_SIZE,
        include: {
            memberships: {
                include: {
                    group:     { select: { name: true } },
                    groupRole: { select: { name: true, position: true } },
                },
                orderBy: { group: { name: 'asc' } },
            },
        },
    });

    // Anyone missing from the batch fetch is no longer in the server — look up their username directly instead.
    const ownerIds = [...new Set(characters.map(c => c.userId))];
    const present: Collection<string, GuildMember> = ownerIds.length > 0
        ? await guild.members.fetch({ user: ownerIds }).catch(() => new Collection<string, GuildMember>())
        : new Collection<string, GuildMember>();

    const ownerLabels = new Map<string, string>();
    for (const id of ownerIds) {
        const member = present.get(id);
        if (member) {
            ownerLabels.set(id, `Owner: **${member.user.username}**`);
        } else {
            const user = await guild.client.users.fetch(id).catch(() => null);
            ownerLabels.set(id, `Owner: ⚠️ ~~${user?.username ?? id}~~ — *no longer in this server*`);
        }
    }

    // Header and notice share one text display — a full page sits close to Discord's 40-component limit.
    const inner: unknown[] = [
        { type: 10, content: `## Character Purge\n-# ${total} character(s) in this server${notice ? `\n${notice}` : ''}` },
        { type: 14, divider: true },
    ];

    if (characters.length === 0) {
        inner.push({ type: 10, content: '*No characters in this server.*' });
    } else {
        for (const c of characters) {
            const roleLines = c.memberships.map(m => `• **${m.groupRole.name}** (Rank ${m.groupRole.position}) in **${m.group.name}**`);
            inner.push({
                type:       9,
                components: [{ type: 10, content: buildEntryText(`### ${c.name}\n${ownerLabels.get(c.userId)}`, roleLines) }],
                accessory:  { type: 2, style: 4, label: 'Delete', custom_id: `character_purge_delete:${c.id}:${safePage}` },
            });
        }
    }

    if (totalPages > 1) {
        inner.push({ type: 14, divider: true });
        inner.push({
            type:       1,
            components: [
                { type: 2, style: 2, label: '◀', custom_id: `character_purge_page:${safePage - 1}`, disabled: safePage === 0 },
                { type: 2, style: 2, label: `${safePage + 1} / ${totalPages}`, custom_id: 'character_purge_noop', disabled: true },
                { type: 2, style: 2, label: '▶', custom_id: `character_purge_page:${safePage + 1}`, disabled: safePage === totalPages - 1 },
            ],
        });
    }

    return [{ type: 17, components: inner }];
}

export function buildPurgeConfirmation(
    character: { id: string; name: string; userId: string; memberships: Array<{ group: { name: string }; groupRole: { name: string } }> },
): object {
    const warning = character.memberships.length > 0
        ? `\n-# This will also remove them from: ${character.memberships.map(m => `**${m.groupRole.name}** in **${m.group.name}**`).join(', ')} (Discord roles included, where the owner is still a server member).`
        : '';

    return {
        type:       17,
        components: [
            { type: 10, content: `Are you sure you want to permanently delete **${character.name}** (owned by <@${character.userId}>)?${warning}\n-# This cannot be undone.` },
            { type: 1,  components: [
                { type: 2, style: 4, label: 'Delete', custom_id: `character_purge_confirm:${character.id}` },
                { type: 2, style: 2, label: 'Cancel', custom_id: 'character_purge_cancel' },
            ]},
        ],
    };
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!isServerAdmin(interaction)) {
        await interaction.editReply({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'Only an Administrator can purge characters.' }] }],
        } as never);
        return;
    }

    await interaction.editReply({
        flags:      MessageFlags.IsComponentsV2,
        components: await buildPurgeListComponents(interaction.guild!, 0),
    } as never);
}
