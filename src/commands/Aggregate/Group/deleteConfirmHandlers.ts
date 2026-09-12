import { ButtonInteraction, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { db } from '../../../db/index.js';

// customId: group_delete_confirm:<groupId>
export async function handleGroupDeleteConfirm(interaction: ButtonInteraction): Promise<void> {
    const groupId = interaction.customId.slice('group_delete_confirm:'.length);
    const guildId  = interaction.guildId!;
    const userId   = interaction.user.id;

    const group = await db.group.findUnique({ where: { id: groupId } });

    if (!group || group.guildId !== guildId || group.ownerId !== userId) {
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'This group no longer exists, or you no longer own it.' }] }],
        } as never);
        return;
    }

    // Cascades to GroupRole, GroupRoleMember, and GroupRoleProgression — Discord roles are untouched.
    await db.group.delete({ where: { id: groupId } });

    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: [{
            type:         17,
            accent_color: colors.success,
            components:   [{ type: 10, content: `**${group.name}** (\`${group.codeName}\`) has been deleted from KARC's database. Its Discord roles were left untouched.` }],
        }],
    } as never);
}

export async function handleGroupDeleteCancel(interaction: ButtonInteraction): Promise<void> {
    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: [{ type: 17, components: [{ type: 10, content: 'Cancelled.' }] }],
    } as never);
}
