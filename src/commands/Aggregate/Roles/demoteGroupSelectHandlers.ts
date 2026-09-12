import { StringSelectMenuInteraction } from 'discord.js';
import { runDemoteRoleStep } from './demoteFlowHelper.js';

// customId: roles_demote_group  (memberId comes from values[0])
export async function handleDemoteGroupSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const memberId = interaction.values[0];
    const callerId = interaction.user.id;
    const guildId  = interaction.guildId!;

    await runDemoteRoleStep(
        memberId, callerId, guildId, interaction.guild!,
        p => interaction.update(p),
    );
}
