import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { buildGroupPickerComponents } from './groupPicker.js';
import { db } from '../../../db/index.js';

// channelId → last public viewmembers message in that channel, so re-running deletes the old one
const activeMessages = new Map<string, { channelId: string; messageId: string }>();

export function fetchGroupWithMembers(groupId: string) {
    return db.group.findUnique({
        where:   { id: groupId },
        include: {
            roles: {
                include: { members: { select: { userId: true, characterName: true } } },
                orderBy: { position: 'asc' },
            },
        },
    });
}

// Discord caps a single Text Display's content at 4000 chars — stay well under that.
const MAX_CHARS_PER_PAGE = 3500;

export type GroupWithMemberRoles = {
    id:       string;
    codeName: string;
    name:     string;
    ownerId:  string;
    roles: Array<{
        id:       string;
        name:     string;
        position: number;
        subName:  string | null;
        members:  Array<{ userId: string; characterName: string }>;
    }>;
};

type RoleData = { header: string; contHeader: string; lines: string[] };

function buildRoleData(group: GroupWithMemberRoles): RoleData[] {
    const sortedRoles = [...group.roles].sort((a, b) => b.position - a.position);
    return sortedRoles.map(role => {
        const members = [...role.members].sort((a, b) => a.characterName.localeCompare(b.characterName));
        const lines = members.length > 0
            ? members.map(m => `• ${m.characterName} — <@${m.userId}>`)
            : ['*(empty)*'];
        const subNamePart = role.subName ? ` - *${role.subName}*` : '';
        return {
            header:     `${role.position} - **${role.name}**${subNamePart}`,
            contHeader: `${role.position} - **${role.name}**${subNamePart} (cont.)`,
            lines,
        };
    });
}

// Role name is its own component; the member list is a separate component. If a role's
// member list would push a page past the character budget, it's cut at the last member
// line that still fits, and continues under a repeated "(cont.)" header on the next page.
function paginateRoles(roles: RoleData[]): string[][] {
    const pages: string[][] = [];
    let current: string[] = [];
    let currentChars = 0;

    const flushPage = () => { pages.push(current); current = []; currentChars = 0; };
    const addComponent = (text: string) => { current.push(text); currentChars += text.length + 1; };

    for (const role of roles) {
        if (current.length > 0 && currentChars + role.header.length + 1 > MAX_CHARS_PER_PAGE) flushPage();
        addComponent(role.header);

        let lineIdx = 0;
        while (lineIdx < role.lines.length) {
            const remaining = MAX_CHARS_PER_PAGE - currentChars;

            const chunkLines: string[] = [];
            let chunkChars = 0;
            while (lineIdx < role.lines.length) {
                const line  = role.lines[lineIdx];
                const added = line.length + 1;
                if (chunkChars + added > remaining) break;
                chunkLines.push(line);
                chunkChars += added;
                lineIdx++;
            }

            if (chunkLines.length === 0) {
                // Nothing fits in what's left of the current page — cut off here and
                // continue on a fresh one, repeating the role header as "(cont.)".
                flushPage();
                addComponent(role.contHeader);
                // If a single line still doesn't fit on a completely empty page, include it
                // anyway rather than looping forever — only happens for a pathologically long line.
                const line = role.lines[lineIdx];
                if (line.length + 1 > MAX_CHARS_PER_PAGE - currentChars) {
                    addComponent(line);
                    lineIdx++;
                }
                continue;
            }

            addComponent(chunkLines.join('\n'));

            if (lineIdx < role.lines.length) {
                flushPage();
                addComponent(role.contHeader);
            }
        }
    }

    flushPage();
    return pages.filter(p => p.length > 0).length > 0 ? pages.filter(p => p.length > 0) : [[]];
}

export function buildViewMembersComponents(group: GroupWithMemberRoles, page = 0): unknown[] {
    const pages           = paginateRoles(buildRoleData(group));
    const totalPages      = pages.length;
    const safePage        = Math.min(Math.max(page, 0), totalPages - 1);
    const pageBlocks      = pages[safePage];
    const totalCharacters = group.roles.reduce((sum, r) => sum + r.members.length, 0);

    const inner: unknown[] = [
        { type: 10, content: `## ${group.name}` },
        { type: 10, content: `-# Owner: <@${group.ownerId}>${totalPages > 1 ? ` — page ${safePage + 1}/${totalPages}` : ''}` },
        { type: 10, content: `**Total characters:** ${totalCharacters}` },
        { type: 14, divider: true },
    ];

    if (pageBlocks.length === 0) {
        inner.push({ type: 10, content: '*No roles defined.*' });
    } else {
        for (const block of pageBlocks) inner.push({ type: 10, content: block });
    }

    inner.push({ type: 14, divider: true });

    const buttonRow: unknown[] = [];
    if (totalPages > 1) {
        buttonRow.push(
            { type: 2, style: 2, label: '◀', custom_id: `group_viewmembers_page:${group.id}:${safePage - 1}`, disabled: safePage === 0 },
            { type: 2, style: 2, label: `${safePage + 1} / ${totalPages}`, custom_id: 'group_viewmembers_noop', disabled: true },
            { type: 2, style: 2, label: '▶', custom_id: `group_viewmembers_page:${group.id}:${safePage + 1}`, disabled: safePage === totalPages - 1 },
        );
    }
    buttonRow.push({ type: 2, style: 1, label: 'Update', custom_id: `group_viewmembers_update:${group.codeName}` });

    return [
        {
            type:       17,
            components: [
                ...inner,
                { type: 1, components: buttonRow },
            ],
        },
    ];
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId!;

    // Delete the previous viewmembers post in this channel so it doesn't fill up
    const prev = activeMessages.get(interaction.channelId);
    if (prev) {
        try {
            const ch = await interaction.client.channels.fetch(prev.channelId);
            if (ch?.isTextBased()) {
                const msg = await ch.messages.fetch(prev.messageId);
                await msg.delete();
            }
        } catch { /* already deleted or no permission — ignore */ }
        activeMessages.delete(interaction.channelId);
    }

    const groups = await db.group.findMany({
        where:   { guildId },
        select:  { id: true, codeName: true, name: true },
        orderBy: { name: 'asc' },
    });

    if (groups.length === 0) {
        await interaction.editReply({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'No groups exist in this server.' }] }],
        } as never);
        return;
    }

    if (groups.length === 1) {
        const group = await fetchGroupWithMembers(groups[0].id);
        await interaction.editReply({
            flags:      MessageFlags.IsComponentsV2,
            components: buildViewMembersComponents(group!, 0),
        } as never);
    } else {
        await interaction.editReply({
            flags:      MessageFlags.IsComponentsV2,
            components: buildGroupPickerComponents(groups, 0, 'viewmembers'),
        } as never);
    }

    // Track the new message so the next invocation can remove it
    const posted = await interaction.fetchReply();
    activeMessages.set(interaction.channelId, { channelId: posted.channelId, messageId: posted.id });
}
