import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { db } from '../../../db/index.js';

const GROUPS_PER_PAGE = 10;

export type ListedGroup = {
    id:       string;
    name:     string;
    codeName: string;
    _count:   { members: number };
};

export function fetchGroupsForList(guildId: string) {
    return db.group.findMany({
        where:   { guildId },
        select:  { id: true, name: true, codeName: true, _count: { select: { members: true } } },
        orderBy: { name: 'asc' },
    });
}

export const noGroupsComponents = [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'No groups exist in this server.' }] }];

export function buildGroupListComponents(groups: ListedGroup[], page: number): unknown[] {
    const totalPages = Math.max(1, Math.ceil(groups.length / GROUPS_PER_PAGE));
    const safePage   = Math.min(Math.max(page, 0), totalPages - 1);
    const pageGroups = groups.slice(safePage * GROUPS_PER_PAGE, (safePage + 1) * GROUPS_PER_PAGE);

    const inner: unknown[] = [
        { type: 10, content: '## Groups' },
        { type: 10, content: `-# ${groups.length} ${groups.length === 1 ? 'group' : 'groups'} in this server` },
        { type: 14, divider: true },
        ...pageGroups.map(g => {
            const count = g._count.members;
            return {
                type:       9,
                components: [{ type: 10, content: `**${g.name}** — ${count} ${count === 1 ? 'member' : 'members'}\n-# ${g.codeName}` }],
                accessory:  { type: 2, style: 1, label: 'Info', custom_id: `group_list_info:${g.id}` },
            };
        }),
    ];

    if (totalPages > 1) {
        inner.push({ type: 14, divider: true });
        inner.push({
            type:       1,
            components: [
                { type: 2, style: 2, label: '◀', custom_id: `group_list_page:${safePage - 1}`, disabled: safePage === 0 },
                { type: 2, style: 2, label: `${safePage + 1} / ${totalPages}`, custom_id: 'group_list_noop', disabled: true },
                { type: 2, style: 2, label: '▶', custom_id: `group_list_page:${safePage + 1}`, disabled: safePage === totalPages - 1 },
            ],
        });
    }

    return [{ type: 17, components: inner }];
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const groups = await fetchGroupsForList(interaction.guildId!);

    await interaction.editReply({
        flags:      MessageFlags.IsComponentsV2,
        components: groups.length === 0 ? noGroupsComponents : buildGroupListComponents(groups, 0),
    } as never);
}
