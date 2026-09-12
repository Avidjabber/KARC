import { MessageFlags, StringSelectMenuInteraction } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { db } from '../../../db/index.js';
import { createProgression } from './setProgression.js';

// customId: roles_setprog_group_select  (value: "<fromRoleId>:<toRoleId>")
export async function handleSetProgressionGroupSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const [fromRoleId, toRoleId] = interaction.values[0].split(':');
    const guildId = interaction.guildId!;

    const [fromRole, toRole] = await Promise.all([
        db.groupRole.findUnique({ where: { id: fromRoleId }, include: { group: true } }),
        db.groupRole.findUnique({ where: { id: toRoleId } }),
    ]);

    if (!fromRole || !toRole || fromRole.group.guildId !== guildId) {
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'One or both roles no longer exist.' }] }],
        } as never);
        return;
    }

    await createProgression(interaction, fromRoleId, toRoleId, fromRole.name, toRole.name, fromRole.group.name, true);
}
