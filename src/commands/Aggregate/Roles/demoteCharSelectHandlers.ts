import { MessageFlags, StringSelectMenuInteraction } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { db } from '../../../db/index.js';
import { runDemoteRoleStep } from './demoteFlowHelper.js';

// customId: roles_demote_char:<targetUserId>
export async function handleDemoteCharSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const targetUserId  = interaction.customId.slice('roles_demote_char:'.length);
    const characterName = interaction.values[0];
    const callerId      = interaction.user.id;
    const guildId       = interaction.guildId!;

    const members = await db.groupRoleMember.findMany({
        where:   { userId: targetUserId, characterName, group: { guildId } },
        include: { group: true },
    });

    if (members.length === 0) {
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'Character not found.' }] }],
        } as never);
        return;
    }

    // Multiple groups: show group select
    if (members.length > 1) {
        const options = members.map(m => ({
            label:       m.group.name,
            value:       m.id,
            description: m.group.codeName,
        }));

        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: [{
                type:       17,
                components: [
                    { type: 10, content: `**${characterName}** is in multiple groups. Select one:` },
                    { type: 1,  components: [{
                        type:        3,
                        custom_id:   'roles_demote_group',
                        placeholder: 'Select a group',
                        options,
                    }]},
                ],
            }],
        } as never);
        return;
    }

    // Single group: go to role step
    await runDemoteRoleStep(
        members[0].id, callerId, guildId, interaction.guild!,
        p => interaction.update(p),
    );
}
