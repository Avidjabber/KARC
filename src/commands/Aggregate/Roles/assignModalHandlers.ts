import { MessageFlags, ModalSubmitInteraction } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { validateDisplayName, FILTER_MESSAGES } from '../../../core/contentFilter.js';
import { extractField } from '../../../core/modalUtils.js';
import { db } from '../../../db/index.js';

async function replyError(interaction: ModalSubmitInteraction, content: string): Promise<void> {
    await interaction.reply({
        flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content }] }],
    } as never);
}

// customId: roles_assign_modal:<groupRoleId>:<targetUserId>
export async function handleAssignModal(interaction: ModalSubmitInteraction): Promise<void> {
    const [, groupRoleId, targetUserId] = interaction.customId.split(':');
    const assignerId = interaction.user.id;
    const guildId    = interaction.guildId!;

    const rawCharacter = extractField(interaction, 'character_name');
    const nameResult   = validateDisplayName(rawCharacter);
    if (!nameResult.valid) {
        await replyError(interaction, `**Character Name** ${FILTER_MESSAGES[nameResult.reason]}`);
        return;
    }
    const characterName = nameResult.value;

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

    // Does this exact character name already belong to a DIFFERENT role for this user in this group?
    const existingNameRow = await db.groupRoleMember.findUnique({
        where:   { groupId_characterName_userId: { groupId: group.id, characterName, userId: targetUserId } },
        include: { groupRole: true },
    });

    if (existingNameRow && existingNameRow.groupRoleId !== groupRole.id) {
        await interaction.reply({
            flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            components: [{
                type:       17,
                components: [
                    { type: 10, content: `**${characterName}** already holds **${existingNameRow.groupRole.name}** in **${group.name}**. Move them to **${groupRole.name}** instead?` },
                    { type: 1,  components: [
                        { type: 2, style: 4, label: 'Yes',    custom_id: `roles_assign_move_confirm:${existingNameRow.id}:${groupRole.id}` },
                        { type: 2, style: 2, label: 'Cancel', custom_id: 'roles_assign_move_cancel' },
                    ]},
                ],
            }],
        } as never);
        return;
    }

    // Does this user already hold this exact role (possibly under a different character name)?
    const existingRoleRow = await db.groupRoleMember.findFirst({
        where: { groupId: group.id, groupRoleId: groupRole.id, userId: targetUserId },
    });

    if (existingRoleRow) {
        if (existingRoleRow.characterName !== characterName) {
            await db.groupRoleMember.update({ where: { id: existingRoleRow.id }, data: { characterName } });
        }

        try {
            const member = await interaction.guild!.members.fetch(targetUserId);
            if (groupRole.discordRoleId) {
                await member.roles.add(groupRole.discordRoleId, `KARC: assigned to ${groupRole.name} in ${group.name}`);
            }
        } catch (err) {
            console.error('[handleAssignModal] Discord role assign failed:', err);
        }

        await interaction.reply({
            flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            components: [{
                type:         17,
                accent_color: colors.success,
                components:   [{ type: 10, content: `**${characterName}** already holds **${groupRole.name}** in **${group.name}**; character name set.` }],
            }],
        } as never);
        return;
    }

    try {
        await db.groupRoleMember.create({
            data: {
                groupId:      group.id,
                groupRoleId:  groupRole.id,
                userId:       targetUserId,
                characterName,
            },
        });
    } catch (err) {
        const isDuplicate = (err as { code?: string }).code === 'P2002';
        const content = isDuplicate
            ? `**${characterName}** is already assigned to a role in **${group.name}** for that user.`
            : 'Something went wrong saving the assignment. Please try again.';
        if (!isDuplicate) console.error('[handleAssignModal] DB error:', err);
        await replyError(interaction, content);
        return;
    }

    // Assign the Discord role to the member
    try {
        const member = await interaction.guild!.members.fetch(targetUserId);
        if (groupRole.discordRoleId) {
            await member.roles.add(groupRole.discordRoleId, `KARC: assigned to ${groupRole.name} in ${group.name}`);
        }
    } catch (err) {
        console.error('[handleAssignModal] Discord role assign failed:', err);
    }

    await interaction.reply({
        flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        components: [{
            type:         17,
            accent_color: colors.success,
            components:   [{ type: 10, content: `**${characterName}** has been assigned to **${groupRole.name}** in **${group.name}**.` }],
        }],
    } as never);
}
