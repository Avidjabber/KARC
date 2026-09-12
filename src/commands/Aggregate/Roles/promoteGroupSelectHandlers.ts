import { StringSelectMenuInteraction } from 'discord.js';
import { runPromoteRoleStep } from './promoteFlowHelper.js';

// customId: roles_promote_group  (memberId comes from values[0])
export async function handlePromoteGroupSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const memberId = interaction.values[0];
    const callerId = interaction.user.id;
    const guildId  = interaction.guildId!;

    await runPromoteRoleStep(
        memberId, callerId, guildId, interaction.guild!,
        p => interaction.update(p),
    );
}
