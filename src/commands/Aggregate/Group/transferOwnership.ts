import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { db } from '../../../db/index.js';

const TRANSFER_TIMEOUT_MS = 10 * 60 * 1000;

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const codeName   = interaction.options.getString('group', true);
    const targetUser = interaction.options.getUser('user', true);
    const guildId    = interaction.guildId!;
    const userId     = interaction.user.id;

    if (targetUser.bot) {
        await interaction.editReply({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'You cannot transfer ownership to a bot.' }] }],
        } as never);
        return;
    }

    if (targetUser.id === userId) {
        await interaction.editReply({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'You are already the owner.' }] }],
        } as never);
        return;
    }

    const member = await interaction.guild!.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
        await interaction.editReply({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: `<@${targetUser.id}> is not a member of this server.` }] }],
        } as never);
        return;
    }

    const group = await db.group.findUnique({ where: { codeName } });

    if (!group || group.guildId !== guildId) {
        await interaction.editReply({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: `No group with code name \`${codeName}\` exists in this server.` }] }],
        } as never);
        return;
    }

    if (group.ownerId !== userId) {
        await interaction.editReply({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'You are not the owner of this group.' }] }],
        } as never);
        return;
    }

    const acceptId = `group_transfer_accept:${group.id}:${userId}:${targetUser.id}`;
    const rejectId = `group_transfer_reject:${group.id}:${userId}:${targetUser.id}`;

    await interaction.editReply({
        flags:      MessageFlags.IsComponentsV2,
        components: [{ type: 17, accent_color: colors.info, components: [{ type: 10, content: `Transfer request sent to <@${targetUser.id}>.` }] }],
    } as never);

    const msg = await interaction.followUp({
        flags:      MessageFlags.IsComponentsV2,
        components: [{
            type:         17,
            accent_color: colors.warning,
            components: [
                {
                    type:    10,
                    content: `<@${targetUser.id}>, <@${userId}> wants to transfer ownership of **${group.name}** (\`${group.codeName}\`) to you.\n\nDo you accept? *This request expires in 10 minutes.*`,
                },
                {
                    type:       1,
                    components: [
                        { type: 2, style: 3, label: 'Accept', custom_id: acceptId },
                        { type: 2, style: 4, label: 'Reject', custom_id: rejectId },
                    ],
                },
            ],
        }],
    } as never);

    setTimeout(async () => {
        await (msg as { edit: (data: unknown) => Promise<unknown> }).edit({
            flags:      MessageFlags.IsComponentsV2,
            components: [{
                type:       17,
                components: [{
                    type:    10,
                    content: `~~<@${targetUser.id}>, <@${userId}> wants to transfer ownership of **${group.name}** (\`${group.codeName}\`) to you.~~\n\n*This transfer request has expired.*`,
                }],
            }],
        }).catch(() => null);
    }, TRANSFER_TIMEOUT_MS);
}
