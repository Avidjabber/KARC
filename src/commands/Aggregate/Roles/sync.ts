import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { splitIntoChunks } from '../../../core/text.js';
import { db } from '../../../db/index.js';
import { syncLookupTags } from './lookupRoleSync.js';

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

    const guild = interaction.guild!;
    await guild.members.fetch().catch(() => null);
    await guild.roles.fetch().catch(() => null);

    const lines: string[] = [];
    let rolesChecked = 0;

    for (const group of groups) {
        // Ensure the group has its own Discord tag — find one by name, or create it.
        let groupDiscordRoleId = group.discordRoleId;
        if (!groupDiscordRoleId) {
            try {
                const existing = guild.roles.cache.find(r => r.name === group.name);
                if (existing) {
                    groupDiscordRoleId = existing.id;
                } else {
                    const created = await guild.roles.create({ name: group.name, reason: `KARC: group tag created for "${group.name}"` });
                    groupDiscordRoleId = created.id;
                }
                await db.group.update({ where: { id: group.id }, data: { discordRoleId: groupDiscordRoleId } });
                lines.push(`**${group.name}** _(group tag)_\n-# Linked a Discord role as this group's tag.`);
            } catch (err) {
                console.error('[sync] group tag creation failed:', err);
                lines.push(`⚠️ **${group.name}** — could not set up a Discord group tag.`);
            }
        }

        const expectedTagUserIds = new Set<string>();

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

            for (const id of discordMemberIds) expectedTagUserIds.add(id);

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

        // Reconcile the group's own tag against everyone who actually holds a specific role in it.
        if (groupDiscordRoleId) {
            const groupDiscordRole = guild.roles.cache.get(groupDiscordRoleId);
            if (!groupDiscordRole) {
                lines.push(`⚠️ **${group.name}** (group tag) — linked Discord role no longer exists.`);
            } else {
                const currentTagUserIds = new Set(groupDiscordRole.members.map(m => m.id));
                const toAdd    = [...expectedTagUserIds].filter(id => !currentTagUserIds.has(id));
                const toRemove = [...currentTagUserIds].filter(id => !expectedTagUserIds.has(id));

                for (const id of toAdd) {
                    try {
                        const discordMember = await guild.members.fetch(id);
                        await discordMember.roles.add(groupDiscordRoleId, `KARC: sync — holds a role in ${group.name}`);
                    } catch (err) {
                        console.error('[sync] group tag add failed:', err);
                    }
                }
                for (const id of toRemove) {
                    try {
                        const discordMember = await guild.members.fetch(id);
                        await discordMember.roles.remove(groupDiscordRoleId, `KARC: sync — no longer holds a role in ${group.name}`);
                    } catch (err) {
                        console.error('[sync] group tag remove failed:', err);
                    }
                }

                if (toAdd.length > 0 || toRemove.length > 0) {
                    const parts = [`**${group.name}** _(group tag)_`];
                    if (toAdd.length > 0)    parts.push(`-# Applied to ${toAdd.length} member${toAdd.length === 1 ? '' : 's'} holding a role without the tag.`);
                    if (toRemove.length > 0) parts.push(`-# Removed from ${toRemove.length} member${toRemove.length === 1 ? '' : 's'} no longer holding any role.`);
                    lines.push(parts.join('\n'));
                }
            }
        }
    }

    // Career / Residence tags — one Discord role per lookup value, applied to every user with
    // at least one character in this guild carrying that value. Not scoped to owned/managed groups.
    const careers            = await db.career.findMany({ orderBy: { value: 'asc' } });
    const careerRoles        = await db.careerRole.findMany({ where: { guildId } });
    const careerRoleIds      = new Map(careerRoles.map(r => [r.careerId, r.discordRoleId]));
    const charactersByCareer = await db.character.findMany({ where: { guildId, careerId: { not: null } }, select: { userId: true, careerId: true } });
    const careerMembers      = new Map<string, Set<string>>();
    for (const c of charactersByCareer) {
        if (!c.careerId) continue;
        if (!careerMembers.has(c.careerId)) careerMembers.set(c.careerId, new Set());
        careerMembers.get(c.careerId)!.add(c.userId);
    }

    const careerLines = await syncLookupTags(
        guild, 'Career', careers, careerRoleIds, careerMembers,
        (careerId, discordRoleId) => db.careerRole.upsert({
            where:  { guildId_careerId: { guildId, careerId } },
            update: { discordRoleId },
            create: { guildId, careerId, discordRoleId },
        }).then(() => undefined),
    );
    lines.push(...careerLines);

    const residences            = await db.residence.findMany({ orderBy: { value: 'asc' } });
    const residenceRoles        = await db.residenceRole.findMany({ where: { guildId } });
    const residenceRoleIds      = new Map(residenceRoles.map(r => [r.residenceId, r.discordRoleId]));
    const charactersByResidence = await db.character.findMany({ where: { guildId, residenceId: { not: null } }, select: { userId: true, residenceId: true } });
    const residenceMembers      = new Map<string, Set<string>>();
    for (const c of charactersByResidence) {
        if (!c.residenceId) continue;
        if (!residenceMembers.has(c.residenceId)) residenceMembers.set(c.residenceId, new Set());
        residenceMembers.get(c.residenceId)!.add(c.userId);
    }

    const residenceLines = await syncLookupTags(
        guild, 'Residence', residences, residenceRoleIds, residenceMembers,
        (residenceId, discordRoleId) => db.residenceRole.upsert({
            where:  { guildId_residenceId: { guildId, residenceId } },
            update: { discordRoleId },
            create: { guildId, residenceId, discordRoleId },
        }).then(() => undefined),
    );
    lines.push(...residenceLines);

    if (lines.length === 0) {
        lines.push(`Checked ${rolesChecked} role${rolesChecked === 1 ? '' : 's'} across ${groups.length} group${groups.length === 1 ? '' : 's'}, plus career and residence tags — everything is already in sync.`);
    }

    const chunks = splitIntoChunks(lines);

    await interaction.editReply({
        flags:      MessageFlags.IsComponentsV2,
        components: [{
            type:       17,
            components: [
                { type: 10, content: `## Role Sync\n-# Checked ${rolesChecked} role${rolesChecked === 1 ? '' : 's'} across ${groups.length} group${groups.length === 1 ? '' : 's'}, plus career and residence tags.` },
                { type: 14, divider: true },
                ...chunks.map(chunk => ({ type: 10, content: chunk })),
            ],
        }],
    } as never);
}
