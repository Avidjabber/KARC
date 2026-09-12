import { ButtonInteraction, MessageFlags, StringSelectMenuInteraction } from 'discord.js';
import { buildCreateRoleModal, buildCreateTogglesComponents } from './create.js';

// customId: roles_create_setmg:<groupId>:<currentCanManageAssignments>
export async function handleCreateSetManageGroup(interaction: StringSelectMenuInteraction): Promise<void> {
    const [, groupId, currentAssign] = interaction.customId.split(':');
    const canManageGroup       = interaction.values[0] === 'true';
    const canManageAssignments = currentAssign === 'true';

    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: buildCreateTogglesComponents(groupId, canManageGroup, canManageAssignments),
    } as never);
}

// customId: roles_create_setma:<groupId>:<currentCanManageGroup>
export async function handleCreateSetManageAssignments(interaction: StringSelectMenuInteraction): Promise<void> {
    const [, groupId, currentGroup] = interaction.customId.split(':');
    const canManageAssignments = interaction.values[0] === 'true';
    const canManageGroup       = currentGroup === 'true';

    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: buildCreateTogglesComponents(groupId, canManageGroup, canManageAssignments),
    } as never);
}

// customId: roles_create_next:<groupId>:<canManageGroup>:<canManageAssignments>
export async function handleCreateNext(interaction: ButtonInteraction): Promise<void> {
    const [, groupId, canManageGroup, canManageAssignments] = interaction.customId.split(':');
    await interaction.showModal(buildCreateRoleModal(groupId, canManageGroup === 'true', canManageAssignments === 'true') as never);
}
