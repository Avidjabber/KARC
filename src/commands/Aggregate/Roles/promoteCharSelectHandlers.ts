import { MessageFlags, StringSelectMenuInteraction } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { db } from '../../../db/index.js';
import { runPromoteRoleStep } from './promoteFlowHelper.js';

// customId: roles_promote_char:<targetUserId>
export async function handlePromoteCharSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const targetUserId = interaction.customId.slice('roles_promote_char:'.length);
    const characterId  = interaction.values[0];
    const callerId     = interaction.user.id;
    const guildId      = interaction.guildId!;

    const members = await db.groupRoleMember.findMany({
        where:   { userId: targetUserId, characterId, group: { guildId } },
        include: { group: true, character: { select: { name: true } } },
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
                    { type: 10, content: `**${members[0].character.name}** is in multiple groups. Select one:` },
                    { type: 1,  components: [{
                        type:        3,
                        custom_id:   'roles_promote_group',
                        placeholder: 'Select a group',
                        options,
                    }]},
                ],
            }],
        } as never);
        return;
    }

    // Single group: go to role step
    await runPromoteRoleStep(
        members[0].id, callerId, guildId, interaction.guild!,
        p => interaction.update(p),
    );
}
