import { ButtonInteraction, MessageFlags, StringSelectMenuInteraction } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { db } from '../../../db/index.js';
import { buildEditRoleModal, buildEditTogglesComponents } from './edit.js';

// customId: roles_edit_setmg:<groupId>:<roleId>:<currentCanManageAssignments>
export async function handleEditSetManageGroup(interaction: StringSelectMenuInteraction): Promise<void> {
    const [, groupId, roleId, currentAssign] = interaction.customId.split(':');
    const canManageGroup       = interaction.values[0] === 'true';
    const canManageAssignments = currentAssign === 'true';

    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: buildEditTogglesComponents(groupId, roleId, canManageGroup, canManageAssignments),
    } as never);
}

// customId: roles_edit_setma:<groupId>:<roleId>:<currentCanManageGroup>
export async function handleEditSetManageAssignments(interaction: StringSelectMenuInteraction): Promise<void> {
    const [, groupId, roleId, currentGroup] = interaction.customId.split(':');
    const canManageAssignments = interaction.values[0] === 'true';
    const canManageGroup       = currentGroup === 'true';

    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: buildEditTogglesComponents(groupId, roleId, canManageGroup, canManageAssignments),
    } as never);
}

// customId: roles_edit_next:<groupId>:<roleId>:<canManageGroup>:<canManageAssignments>
export async function handleEditNext(interaction: ButtonInteraction): Promise<void> {
    const [, groupId, roleId, canManageGroupStr, canManageAssignmentsStr] = interaction.customId.split(':');

    const role = await db.groupRole.findUnique({ where: { id: roleId } });
    if (!role) {
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'This role no longer exists.' }] }],
        } as never);
        return;
    }

    await interaction.showModal(buildEditRoleModal(
        groupId, canManageGroupStr === 'true', canManageAssignmentsStr === 'true', role,
    ) as never);
}
