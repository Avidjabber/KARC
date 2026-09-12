import { ColorResolvable, MessageFlags, ModalSubmitInteraction } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { validateDisplayName, FILTER_MESSAGES } from '../../../core/contentFilter.js';
import { extractField } from '../../../core/modalUtils.js';
import { db } from '../../../db/index.js';

function parsePosition(raw: string): number | null {
    const trimmed = raw.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const n = parseInt(trimmed, 10);
    if (n < 1 || n > 1000) return null;
    return n;
}

function parseColor(raw: string): string | null | false {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
    return false;
}

async function replyError(interaction: ModalSubmitInteraction, content: string): Promise<void> {
    await interaction.reply({
        flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content }] }],
    } as never);
}

// customId: roles_edit_modal:<groupId>:<roleId>:<canManageGroup>:<canManageAssignments>
export async function handleRoleEditModal(interaction: ModalSubmitInteraction): Promise<void> {
    const [, groupId, roleId, canManageGroupStr, canManageAssignmentsStr] = interaction.customId.split(':');
    const canManageGroup       = canManageGroupStr === 'true';
    const canManageAssignments = canManageAssignmentsStr === 'true';
    const guildId              = interaction.guildId!;
    const userId               = interaction.user.id;

    const rawName    = extractField(interaction, 'name');
    const rawPosition = extractField(interaction, 'position');
    const rawColor    = extractField(interaction, 'color');
    const rawSubName  = extractField(interaction, 'sub_name');

    const nameResult = validateDisplayName(rawName);
    if (!nameResult.valid) {
        await replyError(interaction, `**Role Name** ${FILTER_MESSAGES[nameResult.reason]}`);
        return;
    }

    let subName: string | null = null;
    if (rawSubName.trim()) {
        const subNameResult = validateDisplayName(rawSubName);
        if (!subNameResult.valid) {
            await replyError(interaction, `**Subname** ${FILTER_MESSAGES[subNameResult.reason]}`);
            return;
        }
        subName = subNameResult.value;
    }

    const position = parsePosition(rawPosition);
    if (position === null) {
        await replyError(interaction, '**Rank** must be a whole number between 1 and 1000.');
        return;
    }

    const color = parseColor(rawColor);
    if (color === false) {
        await replyError(interaction, '**Color** must be a valid hex code (e.g. `#7289da`) or left blank.');
        return;
    }

    const group = await db.group.findUnique({ where: { id: groupId } });
    if (!group || group.guildId !== guildId) {
        await replyError(interaction, 'This group no longer exists.');
        return;
    }

    if (group.ownerId !== userId) {
        const hasPermission = await db.groupRoleMember.findFirst({
            where: { groupId, userId, groupRole: { canManageGroup: true } },
        });
        if (!hasPermission) {
            await replyError(interaction, 'You do not have permission to manage roles for this group.');
            return;
        }
    }

    const existingRole = await db.groupRole.findUnique({ where: { id: roleId } });
    if (!existingRole) {
        await replyError(interaction, 'This role no longer exists.');
        return;
    }

    const name = nameResult.value;

    // Update or recreate the Discord role
    if (existingRole.discordRoleId) {
        try {
            const discordRole = await interaction.guild!.roles.fetch(existingRole.discordRoleId);
            if (discordRole) {
                await discordRole.edit({
                    name,
                    color:  (color ?? 'Default') as ColorResolvable,
                    reason: `KARC: role updated in group "${group.name}"`,
                });
            } else {
                const newDiscordRole = await interaction.guild!.roles.create({
                    name,
                    color:  (color ?? 'Default') as ColorResolvable,
                    reason: `KARC: recreating deleted Discord role for group "${group.name}"`,
                });
                await db.groupRole.update({ where: { id: roleId }, data: { discordRoleId: newDiscordRole.id } });
            }
        } catch (err) {
            console.error('[handleRoleEditModal] Discord role update failed:', err);
            await replyError(interaction, 'Failed to update the Discord role. Please try again.');
            return;
        }
    } else {
        try {
            const discordRole = await interaction.guild!.roles.create({
                name,
                color:  (color ?? 'Default') as ColorResolvable,
                reason: `KARC: role created for group "${group.name}"`,
            });
            await db.groupRole.update({ where: { id: roleId }, data: { discordRoleId: discordRole.id } });
        } catch (err) {
            console.error('[handleRoleEditModal] Discord role create failed:', err);
            await replyError(interaction, 'Failed to create the Discord role. Please try again.');
            return;
        }
    }

    try {
        await db.groupRole.update({
            where: { id: roleId },
            data:  { name, position, canManageAssignments, canManageGroup, color, subName },
        });
    } catch (err) {
        const isPrismaUnique = (err as { code?: string }).code === 'P2002';
        const content = isPrismaUnique
            ? `A role named **${name}** already exists in this group.`
            : 'Something went wrong saving the role. Please try again.';
        if (!isPrismaUnique) console.error('[handleRoleEditModal] DB error:', err);
        await replyError(interaction, content);
        return;
    }

    await interaction.reply({
        flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        components: [{
            type:         17,
            accent_color: colors.success,
            components:   [{ type: 10, content: `## Role Updated\n**${name}** (Rank ${position}) has been saved.` }],
        }],
    } as never);
}
