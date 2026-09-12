import { MessageFlags, StringSelectMenuInteraction } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { buildCreateCharacterModal } from '../Character/create.js';
import { db } from '../../../db/index.js';
import { linkCharacterToRole } from './assignLinkHelper.js';

async function checkAssignPermission(groupId: string, groupRolePosition: number, assignerId: string): Promise<boolean> {
    const group = await db.group.findUnique({ where: { id: groupId } });
    if (!group) return false;
    if (group.ownerId === assignerId) return true;

    const manageGroupMembership = await db.groupRoleMember.findFirst({
        where: { groupId, userId: assignerId, groupRole: { canManageGroup: true } },
    });
    if (manageGroupMembership) return true;

    const assignerMembership = await db.groupRoleMember.findFirst({
        where:   { groupId, userId: assignerId, groupRole: { canManageAssignments: true } },
        orderBy: { groupRole: { position: 'desc' } },
        include: { groupRole: true },
    });
    return !!(assignerMembership && assignerMembership.groupRole.position >= groupRolePosition);
}

// customId: roles_assign_char_select:<groupRoleId>:<targetUserId>  (characterId or '__new__' from values[0])
export async function handleAssignCharSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const [, groupRoleId, targetUserId] = interaction.customId.split(':');
    const choice      = interaction.values[0];
    const assignerId  = interaction.user.id;
    const guildId     = interaction.guildId!;

    const groupRole = await db.groupRole.findUnique({ where: { id: groupRoleId }, include: { group: true } });
    if (!groupRole || groupRole.group.guildId !== guildId) {
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'This role no longer exists.' }] }],
        } as never);
        return;
    }

    if (choice === '__new__') {
        await interaction.showModal(buildCreateCharacterModal(`roles_assign_modal_new:${groupRoleId}:${targetUserId}`) as never);
        return;
    }

    const permitted = await checkAssignPermission(groupRole.groupId, groupRole.position, assignerId);
    if (!permitted) {
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: `You do not have permission to assign the **${groupRole.name}** role.` }] }],
        } as never);
        return;
    }

    const character = await db.character.findUnique({ where: { id: choice } });
    if (!character || character.guildId !== guildId || character.userId !== targetUserId) {
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'That character no longer exists.' }] }],
        } as never);
        return;
    }

    const { group } = groupRole;
    const outcome = await linkCharacterToRole(character, groupRole, group, interaction.guild!);

    const content = outcome.kind === 'already'
        ? `**${character.name}** already holds **${groupRole.name}** in **${group.name}**.`
        : outcome.kind === 'moved'
            ? `**${character.name}** has been moved from **${outcome.oldRoleName}** to **${groupRole.name}** in **${group.name}**.`
            : `**${character.name}** has been assigned to **${groupRole.name}** in **${group.name}**.`;

    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: [{ type: 17, accent_color: colors.success, components: [{ type: 10, content }] }],
    } as never);
}
