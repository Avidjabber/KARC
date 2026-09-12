import { AttachmentBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { buildRoleGraphBuffer } from '../../../core/roleGraph.js';
import { buildGroupPickerComponents } from './groupPicker.js';
import { db } from '../../../db/index.js';

// channelId → last public viewroles message in that channel, so re-running deletes the old one
const activeMessages = new Map<string, { channelId: string; messageId: string }>();

export type GroupWithRoles = {
    id:       string;
    codeName: string;
    name:     string;
    ownerId:  string;
    roles: Array<{
        id:          string;
        name:        string;
        position:    number;
        subName:     string | null;
        color:       string | null;
        progressionsFrom: Array<{ toRoleId: string }>;
        progressionsTo:   Array<{ fromRoleId: string }>;
        members:          Array<{ characterName: string }>;
    }>;
};

export function buildRolePanelComponents(group: GroupWithRoles): unknown[] {
    return [
        {
            type: 17,
            components: [
                { type: 10, content: `## ${group.name}` },
                { type: 10, content: `-# Owner: <@${group.ownerId}>` },
                { type: 14, divider: true },
                { type: 12, items: [{ media: { url: 'attachment://roles.png' } }] },
                { type: 1, components: [
                    { type: 2, style: 1, label: 'Update', custom_id: `group_viewroles_update:${group.codeName}` },
                ]},
            ],
        },
    ];
}

export async function renderRoleView(groupId: string, guildId: string): Promise<{ files: AttachmentBuilder[]; components: unknown[] } | null> {
    const group = await db.group.findUnique({
        where:   { id: groupId },
        include: {
            roles: {
                include: {
                    progressionsFrom: { select: { toRoleId:   true } },
                    progressionsTo:   { select: { fromRoleId: true } },
                    members:          { select: { characterName: true } },
                },
                orderBy: { position: 'asc' },
            },
        },
    });

    if (!group || group.guildId !== guildId) return null;

    const graphBuffer = buildRoleGraphBuffer(group.roles, group.name);
    const attachment  = new AttachmentBuilder(graphBuffer, { name: 'roles.png' });

    return { files: [attachment], components: buildRolePanelComponents(group) };
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId!;

    // Delete the previous viewroles post in this channel so it doesn't fill up
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
        const view = await renderRoleView(groups[0].id, guildId);
        await interaction.editReply({
            flags:      MessageFlags.IsComponentsV2,
            files:      view!.files,
            components: view!.components,
        } as never);
    } else {
        await interaction.editReply({
            flags:      MessageFlags.IsComponentsV2,
            components: buildGroupPickerComponents(groups, 0, 'viewroles'),
        } as never);
    }

    // Track the new message so the next invocation can remove it
    const posted = await interaction.fetchReply();
    activeMessages.set(interaction.channelId, { channelId: posted.channelId, messageId: posted.id });
}
