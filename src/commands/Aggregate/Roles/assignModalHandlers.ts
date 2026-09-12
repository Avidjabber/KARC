import { MessageFlags, ModalSubmitInteraction } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { validateDisplayName, validateBio, FILTER_MESSAGES } from '../../../core/contentFilter.js';
import { extractField } from '../../../core/modalUtils.js';
import { db } from '../../../db/index.js';
import { linkCharacterToRole } from './assignLinkHelper.js';

async function replyError(interaction: ModalSubmitInteraction, content: string): Promise<void> {
    await interaction.reply({
        flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content }] }],
    } as never);
}

// customId: roles_assign_modal_new:<groupRoleId>:<targetUserId>
export async function handleAssignModal(interaction: ModalSubmitInteraction): Promise<void> {
    const [, groupRoleId, targetUserId] = interaction.customId.split(':');
    const assignerId = interaction.user.id;
    const guildId    = interaction.guildId!;

    const rawName = extractField(interaction, 'name');
    const rawBio  = extractField(interaction, 'bio');

    const nameResult = validateDisplayName(rawName);
    const bioResult  = validateBio(rawBio);

    if (!nameResult.valid || !bioResult.valid) {
        const lines: string[] = [];
        if (!nameResult.valid) lines.push(`**Name** ${FILTER_MESSAGES[nameResult.reason]}`);
        if (!bioResult.valid)  lines.push(`**Bio** ${FILTER_MESSAGES[bioResult.reason]}`);
        await replyError(interaction, lines.join('\n'));
        return;
    }

    const name = nameResult.value;
    const bio  = bioResult.value || null;

    const groupRole = await db.groupRole.findUnique({
        where:   { id: groupRoleId },
        include: { group: true },
    });

    if (!groupRole || groupRole.group.guildId !== guildId) {
        await replyError(interaction, 'This role no longer exists.');
        return;
    }

    const { group } = groupRole;

    // Re-check permission on submit
    let permitted = false;

    if (group.ownerId === assignerId) {
        permitted = true;
    }

    if (!permitted) {
        const manageGroupMembership = await db.groupRoleMember.findFirst({
            where: { groupId: group.id, userId: assignerId, groupRole: { canManageGroup: true } },
        });
        if (manageGroupMembership) permitted = true;
    }

    if (!permitted) {
        const assignerMembership = await db.groupRoleMember.findFirst({
            where:   { groupId: group.id, userId: assignerId, groupRole: { canManageAssignments: true } },
            orderBy: { groupRole: { position: 'desc' } },
            include: { groupRole: true },
        });
        if (assignerMembership && assignerMembership.groupRole.position >= groupRole.position) {
            permitted = true;
        }
    }

    if (!permitted) {
        await replyError(interaction, `You do not have permission to assign the **${groupRole.name}** role.`);
        return;
    }

    let character;
    try {
        character = await db.character.create({ data: { guildId, userId: targetUserId, name, bio } });
    } catch (err) {
        const isDuplicate = (err as { code?: string }).code === 'P2002';
        const content = isDuplicate
            ? `That character already has someone named **${name}** in this server.`
            : 'Something went wrong saving the character. Please try again.';
        if (!isDuplicate) console.error('[handleAssignModal] DB error:', err);
        await replyError(interaction, content);
        return;
    }

    const outcome = await linkCharacterToRole(character, groupRole, group, interaction.guild!);

    const content = outcome.kind === 'moved'
        ? `**${character.name}** has been created and moved from **${outcome.oldRoleName}** to **${groupRole.name}** in **${group.name}**.`
        : `**${character.name}** has been created and assigned to **${groupRole.name}** in **${group.name}**.`;

    await interaction.reply({
        flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        components: [{ type: 17, accent_color: colors.success, components: [{ type: 10, content }] }],
    } as never);
}
