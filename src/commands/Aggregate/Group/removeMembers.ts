import { ChatInputCommandInteraction, Guild, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { fetchOwnerLabels } from '../../../core/memberDisplay.js';
import { isServerAdmin } from '../../../core/permissions.js';
import { db } from '../../../db/index.js';
import { buildGroupPickerComponents } from './groupPicker.js';

const PAGE_SIZE = 10;
// Discord caps a message at 4000 characters of text across all text displays — keep each entry well under 4000 / PAGE_SIZE.
const ENTRY_MAX_LENGTH = 360;

type Caller = { userId: string; isAdmin: boolean };

export function callerFrom(interaction: Parameters<typeof isServerAdmin>[0] & { user: { id: string } }): Caller {
    return { userId: interaction.user.id, isAdmin: isServerAdmin(interaction) };
}

/** Groups the caller may remove members from: all of them for server admins, otherwise ones they own or hold Can Manage Group / Can Manage Assignments in. */
export function fetchManageableGroups(guildId: string, caller: Caller) {
    return db.group.findMany({
        where: caller.isAdmin
            ? { guildId }
            : {
                guildId,
                OR: [
                    { ownerId: caller.userId },
                    { members: { some: { userId: caller.userId, groupRole: { canManageGroup: true } } } },
                    { members: { some: { userId: caller.userId, groupRole: { canManageAssignments: true } } } },
                ],
            },
        select:  { id: true, codeName: true, name: true },
        orderBy: { name: 'asc' },
    });
}

/**
 * What the caller may remove in a group: everyone (admin, owner, Can Manage Group), or — via Can Manage
 * Assignments — only characters ranked strictly below `maxRank`. Null if neither.
 */
export type RemoveAccess = { full: true } | { full: false; maxRank: number };

export async function getRemoveAccess(groupId: string, guildId: string, caller: Caller): Promise<RemoveAccess | null> {
    const group = await db.group.findUnique({ where: { id: groupId } });
    if (!group || group.guildId !== guildId) return null;
    if (caller.isAdmin || group.ownerId === caller.userId) return { full: true };

    const manageGroup = await db.groupRoleMember.findFirst({
        where: { groupId, userId: caller.userId, groupRole: { canManageGroup: true } },
    });
    if (manageGroup) return { full: true };

    const assignments = await db.groupRoleMember.findFirst({
        where:   { groupId, userId: caller.userId, groupRole: { canManageAssignments: true } },
        orderBy: { groupRole: { position: 'desc' } },
        include: { groupRole: true },
    });
    return assignments ? { full: false, maxRank: assignments.groupRole.position } : null;
}

export function canRemoveAtRank(access: RemoveAccess, position: number): boolean {
    return access.full || position < access.maxRank;
}

/** Paginated list of every character in a group, each with a Remove button (disabled where `access` doesn't reach). Returns null if the group is gone. */
export async function buildRemoveMembersComponents(guild: Guild, groupId: string, page: number, access: RemoveAccess): Promise<unknown[] | null> {
    const group = await db.group.findUnique({ where: { id: groupId } });
    if (!group || group.guildId !== guild.id) return null;

    const total      = await db.groupRoleMember.count({ where: { groupId } });
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage   = Math.min(Math.max(page, 0), totalPages - 1);

    const members = await db.groupRoleMember.findMany({
        where:   { groupId },
        orderBy: [{ groupRole: { position: 'desc' } }, { character: { name: 'asc' } }, { id: 'asc' }],
        skip:    safePage * PAGE_SIZE,
        take:    PAGE_SIZE,
        include: {
            character: { select: { name: true } },
            groupRole: { select: { name: true, position: true } },
        },
    });

    const ownerLabels = await fetchOwnerLabels(guild, members.map(m => m.userId));

    const inner: unknown[] = [
        { type: 10, content: `## Remove Members — ${group.name}\n-# ${group.codeName} · ${total} member(s)${access.full ? '' : `\n-# You can remove characters ranked below **Rank ${access.maxRank}**.`}` },
        { type: 14, divider: true },
    ];

    if (members.length === 0) {
        inner.push({ type: 10, content: '*No members in this group.*' });
    } else {
        for (const m of members) {
            const text = `### ${m.character.name}\n**${m.groupRole.name}** (Rank ${m.groupRole.position})\n${ownerLabels.get(m.userId)}`;
            inner.push({
                type:       9,
                components: [{ type: 10, content: text.slice(0, ENTRY_MAX_LENGTH) }],
                accessory:  { type: 2, style: 4, label: 'Remove', custom_id: `group_removemembers_remove:${m.id}`, disabled: !canRemoveAtRank(access, m.groupRole.position) },
            });
        }
    }

    const components: unknown[] = [{ type: 17, components: inner }];

    if (totalPages > 1) {
        components.push({
            type:       1,
            components: [
                { type: 2, style: 2, label: '◀', custom_id: `group_removemembers_page:${groupId}:${safePage - 1}`, disabled: safePage === 0 },
                { type: 2, style: 2, label: '▶', custom_id: `group_removemembers_page:${groupId}:${safePage + 1}`, disabled: safePage === totalPages - 1 },
            ],
        });
    }

    return components;
}

export function buildRemoveMemberConfirmation(member: {
    id:        string;
    userId:    string;
    character: { name: string };
    groupRole: { name: string };
    group:     { name: string };
}): object {
    return {
        type:       17,
        components: [
            { type: 10, content: `Are you sure you want to remove **${member.character.name}** (owned by <@${member.userId}>) from **${member.groupRole.name}** in **${member.group.name}**?\n-# Their group role and group tag will be removed on Discord, where the owner is still a server member. The character itself is not deleted.` },
            { type: 1,  components: [
                { type: 2, style: 4, label: 'Remove', custom_id: `group_removemembers_confirm:${member.id}` },
                { type: 2, style: 2, label: 'Cancel', custom_id: 'group_removemembers_cancel' },
            ]},
        ],
    };
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId!;
    const caller  = callerFrom(interaction);
    const groups  = await fetchManageableGroups(guildId, caller);

    if (groups.length === 0) {
        await interaction.editReply({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'You do not own or manage any groups in this server.' }] }],
        } as never);
        return;
    }

    if (groups.length === 1) {
        const access = (await getRemoveAccess(groups[0].id, guildId, caller))!;
        await interaction.editReply({
            flags:      MessageFlags.IsComponentsV2,
            components: (await buildRemoveMembersComponents(interaction.guild!, groups[0].id, 0, access))!,
        } as never);
        return;
    }

    await interaction.editReply({
        flags:      MessageFlags.IsComponentsV2,
        components: buildGroupPickerComponents(groups, 0, 'removemembers'),
    } as never);
}
