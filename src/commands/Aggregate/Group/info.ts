import { ChatInputCommandInteraction, Collection, Guild, GuildMember, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { db } from '../../../db/index.js';

const PAGE_SIZE = 10;

type GroupWithMembers = {
    id:       string;
    name:     string;
    codeName: string;
    ownerId:  string;
    guildId:  string;
    members:  Array<{
        userId:        string;
        characterName: string;
        groupRole: { name: string; position: number };
    }>;
};

export type GroupWithStats = {
    id:       string;
    name:     string;
    codeName: string;
    ownerId:  string;
    roles:    Array<{ name: string; position: number; _count: { members: number } }>;
};

export async function buildInfoComponents(guild: Guild, group: GroupWithMembers, page: number): Promise<unknown[]> {
    const totalPages  = Math.max(1, Math.ceil(group.members.length / PAGE_SIZE));
    const safePage    = Math.min(Math.max(page, 0), totalPages - 1);
    const pageMembers = group.members.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

    // Batch-fetch Discord handles for the owner + current page
    const userIds = [...new Set([group.ownerId, ...pageMembers.map(m => m.userId)])];
    const fetched: Collection<string, GuildMember> = userIds.length > 0
        ? await guild.members.fetch({ user: userIds }).catch(() => new Collection<string, GuildMember>())
        : new Collection<string, GuildMember>();
    const handle = (id: string) => fetched.get(id)?.displayName ?? id;

    const inner: unknown[] = [
        { type: 10, content: `## ${group.name}` },
        { type: 10, content: `-# ${group.codeName} — ${handle(group.ownerId)}` },
        { type: 14, divider: true },
    ];

    if (group.members.length === 0) {
        inner.push({ type: 10, content: '*No members yet.*' });
    } else {
        for (const m of pageMembers) {
            inner.push({
                type:    10,
                content: `${m.groupRole.position} - **${m.groupRole.name}** : ${m.characterName}\n*${handle(m.userId)}*`,
            });
        }
    }

    inner.push({ type: 14, divider: true });

    if (totalPages > 1) {
        inner.push({
            type:       1,
            components: [
                { type: 2, style: 2, label: '◀', custom_id: `group_info_page:${group.id}:${safePage - 1}`, disabled: safePage === 0 },
                { type: 2, style: 2, label: `${safePage + 1} / ${totalPages}`, custom_id: 'group_info_noop', disabled: true },
                { type: 2, style: 2, label: '▶', custom_id: `group_info_page:${group.id}:${safePage + 1}`, disabled: safePage === totalPages - 1 },
            ],
        });
    }

    return [
        { type: 17, components: inner },
        {
            type: 1,
            components: [
                { type: 2, style: 2, label: 'Done',        custom_id: `group_info_done:${group.id}` },
                { type: 2, style: 1, label: 'Group Stats', custom_id: `group_info_stats:${group.id}` },
            ],
        },
    ];
}

export async function buildStatsComponents(guild: Guild, group: GroupWithStats): Promise<unknown[]> {
    const ownerMember = await guild.members.fetch(group.ownerId).catch(() => null);
    const ownerName   = ownerMember?.displayName ?? group.ownerId;

    const inner: unknown[] = [
        { type: 10, content: `## ${group.name}` },
        { type: 10, content: `-# ${group.codeName} — ${ownerName}` },
        { type: 14, divider: true },
    ];

    if (group.roles.length === 0) {
        inner.push({ type: 10, content: '*No roles defined.*' });
    } else {
        for (const role of group.roles) {
            const count = role._count.members;
            inner.push({
                type:    10,
                content: `**${role.position} — ${role.name}** : ${count} ${count === 1 ? 'member' : 'members'}`,
            });
        }
    }

    return [
        { type: 17, components: inner },
        {
            type: 1,
            components: [
                { type: 2, style: 2, label: 'Done', custom_id: `group_info_done:${group.id}` },
                { type: 2, style: 2, label: 'Back', custom_id: `group_info_page:${group.id}:0` },
            ],
        },
    ];
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const codeName = interaction.options.getString('code_name', true);
    const guildId  = interaction.guildId!;

    const group = await db.group.findUnique({
        where:   { codeName },
        include: {
            members: {
                include:  { groupRole: { select: { name: true, position: true } } },
                orderBy:  [{ groupRole: { position: 'desc' } }, { characterName: 'asc' }],
            },
        },
    });

    if (!group || group.guildId !== guildId) {
        await interaction.editReply({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: `No group with code name \`${codeName}\` exists in this server.` }] }],
        } as never);
        return;
    }

    const components = await buildInfoComponents(interaction.guild!, group, 0);
    await interaction.editReply({
        flags:      MessageFlags.IsComponentsV2,
        components,
    } as never);
}
