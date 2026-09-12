import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { buildCreateCharacterModal } from '../Character/create.js';
import { db } from '../../../db/index.js';

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetUser   = interaction.options.getUser('user', true);
    const discordRole  = interaction.options.getRole('role', true);
    const assignerId   = interaction.user.id;
    const guildId      = interaction.guildId!;

    // Resolve the group role from the Discord role ID
    const groupRole = await db.groupRole.findFirst({
        where:   { discordRoleId: discordRole.id },
        include: { group: true },
    });

    if (!groupRole || groupRole.group.guildId !== guildId) {
        await interaction.reply({
            flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: `**${discordRole.name}** is not linked to any group role in this server.` }] }],
        } as never);
        return;
    }

    const { group } = groupRole;

    // ── Permission check ──────────────────────────────────────────────────────
    let permitted = false;

    if (group.ownerId === assignerId) {
        permitted = true;
    }

    if (!permitted) {
        const manageGroupMembership = await db.groupRoleMember.findFirst({
            where: { groupId: group.id, userId: assignerId, groupRole: { canManageGroup: true } },
        });
        if (manageGroupMembership) permitted = true;
    }

    if (!permitted) {
        // canManageAssignments: assigner's highest eligible role must be >= target role position
        const assignerMembership = await db.groupRoleMember.findFirst({
            where:   { groupId: group.id, userId: assignerId, groupRole: { canManageAssignments: true } },
            orderBy: { groupRole: { position: 'desc' } },
            include: { groupRole: true },
        });
        if (assignerMembership && assignerMembership.groupRole.position >= groupRole.position) {
            permitted = true;
        }
    }

    if (!permitted) {
        await interaction.reply({
            flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: `You do not have permission to assign the **${groupRole.name}** role.` }] }],
        } as never);
        return;
    }

    // Does the target already have characters set up in this server?
    const characters = await db.character.findMany({
        where:   { guildId, userId: targetUser.id },
        orderBy: { name: 'asc' },
    });

    if (characters.length === 0) {
        await interaction.showModal(buildCreateCharacterModal(`roles_assign_modal_new:${groupRole.id}:${targetUser.id}`) as never);
        return;
    }

    const options = [
        ...characters.map(c => ({ label: c.name, value: c.id, description: c.bio ? c.bio.slice(0, 100) : undefined })),
        { label: '+ New Character', value: '__new__', description: `Create a new character for ${targetUser.displayName ?? targetUser.username}` },
    ];

    await interaction.reply({
        flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        components: [{
            type:       17,
            components: [
                { type: 10, content: `Which of ${targetUser}'s characters should hold **${groupRole.name}**?` },
                { type: 1,  components: [{
                    type:        3,
                    custom_id:   `roles_assign_char_select:${groupRole.id}:${targetUser.id}`,
                    placeholder: 'Select a character',
                    options,
                }]},
            ],
        }],
    } as never);
}
