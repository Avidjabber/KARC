import { MessageFlags, ModalSubmitInteraction } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { extractField } from '../../../core/modalUtils.js';
import { db } from '../../../db/index.js';

// customId: roles_delete_modal:<groupId>
export async function handleRoleDeleteModal(interaction: ModalSubmitInteraction): Promise<void> {
    const groupId = interaction.customId.slice('roles_delete_modal:'.length);
    const guildId = interaction.guildId!;
    const userId  = interaction.user.id;
    const name    = extractField(interaction, 'name').trim();

    const group = await db.group.findUnique({ where: { id: groupId } });
    if (!group || group.guildId !== guildId) {
        await interaction.reply({
            flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'This group no longer exists.' }] }],
        } as never);
        return;
    }

    if (group.ownerId !== userId) {
        const hasPermission = await db.groupRoleMember.findFirst({
            where: { groupId, userId, groupRole: { canManageGroup: true } },
        });
        if (!hasPermission) {
            await interaction.reply({
                flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
                components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: `You do not have permission to manage roles for **${group.name}**.` }] }],
            } as never);
            return;
        }
    }

    const groupRole = await db.groupRole.findFirst({
        where: { groupId, name: { equals: name, mode: 'insensitive' } },
    });

    if (!groupRole) {
        await interaction.reply({
            flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: `No role named **${name}** exists in **${group.name}**.` }] }],
        } as never);
        return;
    }

    // Deleting the Discord role removes it from all members automatically
    if (groupRole.discordRoleId) {
        await interaction.guild!.roles
            .delete(groupRole.discordRoleId, `KARC: role deleted from group "${group.name}"`)
            .catch(err => console.error('[roles delete modal] Discord role delete failed:', err));
    }

    // DB cascade removes GroupRoleMembers and GroupRoleProgressions
    await db.groupRole.delete({ where: { id: groupRole.id } });

    await interaction.reply({
        flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        components: [{
            type:         17,
            accent_color: colors.success,
            components:   [{ type: 10, content: `**${groupRole.name}** has been deleted from **${group.name}** and removed from all members.` }],
        }],
    } as never);
}
