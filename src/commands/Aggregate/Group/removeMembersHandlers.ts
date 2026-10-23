import { ButtonInteraction, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { removeUnheldDiscordRoles } from '../../../core/discordRoleCleanup.js';
import { db } from '../../../db/index.js';
import { buildRemoveMemberConfirmation, buildRemoveMembersComponents, callerFrom, canRemoveMembers } from './removeMembers.js';

async function showResult(interaction: ButtonInteraction, content: string, accentColor?: number): Promise<void> {
    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: [{ type: 17, accent_color: accentColor, components: [{ type: 10, content }] }],
    } as never);
}

// customId: group_removemembers_page:<groupId>:<page>
export async function handleRemoveMembersPage(interaction: ButtonInteraction): Promise<void> {
    const [, groupId, pageStr] = interaction.customId.split(':');
    const guildId = interaction.guildId!;

    // Re-checked on every click in case permissions changed since the command ran
    if (!await canRemoveMembers(groupId, guildId, callerFrom(interaction))) {
        await showResult(interaction, 'You no longer have permission to do this.', colors.error);
        return;
    }

    const components = await buildRemoveMembersComponents(interaction.guild!, groupId, parseInt(pageStr ?? '0', 10));
    if (!components) {
        await showResult(interaction, 'This group no longer exists.', colors.error);
        return;
    }
    await interaction.update({ flags: MessageFlags.IsComponentsV2, components } as never);
}

function fetchMember(memberId: string) {
    return db.groupRoleMember.findUnique({
        where:   { id: memberId },
        include: { group: true, groupRole: true, character: { select: { name: true } } },
    });
}

// customId: group_removemembers_remove:<memberId>
export async function handleRemoveMembersRemove(interaction: ButtonInteraction): Promise<void> {
    const memberId = interaction.customId.slice('group_removemembers_remove:'.length);
    const guildId  = interaction.guildId!;

    const member = await fetchMember(memberId);
    if (!member || member.group.guildId !== guildId) {
        await showResult(interaction, 'That character is no longer in this group.', colors.error);
        return;
    }

    if (!await canRemoveMembers(member.groupId, guildId, callerFrom(interaction))) {
        await showResult(interaction, 'You no longer have permission to do this.', colors.error);
        return;
    }

    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: [buildRemoveMemberConfirmation(member)],
    } as never);
}

// customId: group_removemembers_confirm:<memberId>
export async function handleRemoveMembersConfirm(interaction: ButtonInteraction): Promise<void> {
    const memberId = interaction.customId.slice('group_removemembers_confirm:'.length);
    const guildId  = interaction.guildId!;

    const member = await fetchMember(memberId);
    if (!member || member.group.guildId !== guildId) {
        await showResult(interaction, 'That character is no longer in this group.', colors.error);
        return;
    }

    if (!await canRemoveMembers(member.groupId, guildId, callerFrom(interaction))) {
        await showResult(interaction, 'You no longer have permission to do this.', colors.error);
        return;
    }

    const { group, groupRole } = member;

    await db.groupRoleMember.delete({ where: { id: memberId } });

    // The owner may have other characters in this group — only drop Discord roles none of them still hold.
    await removeUnheldDiscordRoles(
        interaction.guild!, member.userId,
        [groupRole.discordRoleId, group.discordRoleId],
        `KARC: ${member.character.name} removed from ${group.name}`,
    );

    await showResult(
        interaction,
        `**${member.character.name}** (owned by <@${member.userId}>) has been removed from **${groupRole.name}** in **${group.name}**.`,
        colors.success,
    );
}

export async function handleRemoveMembersCancel(interaction: ButtonInteraction): Promise<void> {
    await showResult(interaction, 'Cancelled.');
}
