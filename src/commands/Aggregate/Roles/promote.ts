import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { db } from '../../../db/index.js';
import { runPromoteRoleStep } from './promoteFlowHelper.js';

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetUser = interaction.options.getUser('user', true);
    const callerId   = interaction.user.id;
    const guildId    = interaction.guildId!;

    const members = await db.groupRoleMember.findMany({
        where:   { userId: targetUser.id, group: { guildId } },
        include: { group: true },
    });

    if (members.length === 0) {
        await interaction.editReply({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: `${targetUser} has no characters in any group in this server.` }] }],
        } as never);
        return;
    }

    const charNames = [...new Set(members.map(m => m.characterName))];

    // Multiple characters: show character select
    if (charNames.length > 1) {
        const options = charNames.map(name => {
            const inGroups = members.filter(m => m.characterName === name);
            return {
                label:       name,
                value:       name,
                description: inGroups.length > 1
                    ? `In ${inGroups.length} groups`
                    : inGroups[0].group.name,
            };
        });

        await interaction.editReply({
            flags:      MessageFlags.IsComponentsV2,
            components: [{
                type:       17,
                components: [
                    { type: 10, content: `${targetUser} has multiple characters. Select one to promote:` },
                    { type: 1,  components: [{
                        type:        3,
                        custom_id:   `roles_promote_char:${targetUser.id}`,
                        placeholder: 'Select a character',
                        options,
                    }]},
                ],
            }],
        } as never);
        return;
    }

    // Single character, multiple groups: show group select
    if (members.length > 1) {
        const options = members.map(m => ({
            label:       m.group.name,
            value:       m.id,
            description: m.group.codeName,
        }));

        await interaction.editReply({
            flags:      MessageFlags.IsComponentsV2,
            components: [{
                type:       17,
                components: [
                    { type: 10, content: `**${charNames[0]}** is in multiple groups. Select one:` },
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

    // Single character, single group: go straight to role step
    await runPromoteRoleStep(
        members[0].id, callerId, guildId, interaction.guild!,
        p => interaction.editReply(p),
    );
}
