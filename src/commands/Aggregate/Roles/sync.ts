import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { splitIntoChunks } from '../../../core/text.js';
import { db } from '../../../db/index.js';

function discordHexOf(color: number): string | null {
    if (color === 0) return null;
    return `#${color.toString(16).padStart(6, '0')}`.toLowerCase();
}

function hexToNumber(hex: string | null): number {
    if (!hex) return 0;
    return parseInt(hex.replace('#', ''), 16);
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId!;
    const userId  = interaction.user.id;

    const groups = await db.group.findMany({
        where: {
            guildId,
            OR: [
                { ownerId: userId },
                { members: { some: { userId, groupRole: { canManageGroup: true } } } },
            ],
        },
        include: {
            roles: {
                where:   { discordRoleId: { not: null } },
                include: { members: true },
            },
        },
        orderBy: { name: 'asc' },
    });

    if (groups.length === 0) {
        await interaction.editReply({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'You do not own or manage any groups in this server.' }] }],
        } as never);
        return;
    }

    const guild = interaction.guild!;
    await guild.members.fetch().catch(() => null);

    const lines: string[] = [];
    let rolesChecked = 0;

    for (const group of groups) {
        for (const role of group.roles) {
            rolesChecked++;
            const discordRole = guild.roles.cache.get(role.discordRoleId!);

            if (!discordRole) {
                lines.push(`⚠️ **${role.name}** (${group.name}) — linked Discord role no longer exists.`);
                continue;
            }

            const changes: string[] = [];
            const discordHex = discordHexOf(discordRole.color);

            if (discordRole.name !== role.name) {
                changes.push(`name: **${role.name}** → **${discordRole.name}**`);
            }
            if (discordRole.color !== hexToNumber(role.color)) {
                changes.push(`color: ${role.color ?? '_default_'} → ${discordHex ?? '_default_'}`);
            }

            if (changes.length > 0) {
                await db.groupRole.update({
                    where: { id: role.id },
                    data:  { name: discordRole.name, color: discordHex },
                });
            }

            const discordMemberIds = new Set(discordRole.members.map(m => m.id));
            const dbUserIds        = new Set(role.members.map(m => m.userId));

            const staleMembers = role.members.filter(m => !discordMemberIds.has(m.userId));
            if (staleMembers.length > 0) {
                await db.groupRoleMember.deleteMany({ where: { id: { in: staleMembers.map(m => m.id) } } });
            }

            const missingCharacterUserIds = [...discordMemberIds].filter(id => !dbUserIds.has(id));

            if (changes.length > 0 || staleMembers.length > 0 || missingCharacterUserIds.length > 0) {
                const parts = [`**${role.name}** (${group.name})`];
                if (changes.length > 0) {
                    parts.push(`-# Updated — ${changes.join(', ')}`);
                }
                if (staleMembers.length > 0) {
                    parts.push(`-# Removed ${staleMembers.length} member${staleMembers.length === 1 ? '' : 's'} no longer holding the Discord role.`);
                }
                if (missingCharacterUserIds.length > 0) {
                    parts.push(`-# No character set up: ${missingCharacterUserIds.map(id => `<@${id}>`).join(', ')}`);
                }
                lines.push(parts.join('\n'));
            }
        }
    }

    if (lines.length === 0) {
        lines.push(`Checked ${rolesChecked} role${rolesChecked === 1 ? '' : 's'} across ${groups.length} group${groups.length === 1 ? '' : 's'} — everything is already in sync.`);
    }

    const chunks = splitIntoChunks(lines);

    await interaction.editReply({
        flags:      MessageFlags.IsComponentsV2,
        components: [{
            type:       17,
            components: [
                { type: 10, content: `## Role Sync\n-# Checked ${rolesChecked} role${rolesChecked === 1 ? '' : 's'} across ${groups.length} group${groups.length === 1 ? '' : 's'}.` },
                { type: 14, divider: true },
                ...chunks.map(chunk => ({ type: 10, content: chunk })),
            ],
        }],
    } as never);
}
