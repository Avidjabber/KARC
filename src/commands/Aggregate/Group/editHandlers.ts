import { ButtonInteraction, MessageFlags, ModalSubmitInteraction } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { validateDisplayName, validateCodeName, FILTER_MESSAGES } from '../../../core/contentFilter.js';
import { extractField } from '../../../core/modalUtils.js';
import { isGraphTheme } from '../../../core/roleGraph.js';
import { db } from '../../../db/index.js';
import { buildGroupEditModal, canEditGroup } from './edit.js';
import { buildInfoComponents, fetchInfoGroup } from './info.js';

const NO_PERMISSION = 'Only the group owner or members with Can Manage Group can edit this group.';

async function replyError(interaction: ButtonInteraction | ModalSubmitInteraction, content: string): Promise<void> {
    await interaction.reply({
        flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content }] }],
    } as never);
}

// customId: group_info_edit:<groupId>
export async function handleGroupInfoEdit(interaction: ButtonInteraction): Promise<void> {
    const groupId = interaction.customId.split(':')[1];

    const group = await db.group.findUnique({ where: { id: groupId } });
    if (!group || group.guildId !== interaction.guildId) {
        await replyError(interaction, 'This group no longer exists.');
        return;
    }
    if (!(await canEditGroup(group, interaction))) {
        await replyError(interaction, NO_PERMISSION);
        return;
    }

    await interaction.showModal(buildGroupEditModal(group) as never);
}

// customId: group_edit_modal:<groupId>
export async function handleGroupEditModal(interaction: ModalSubmitInteraction): Promise<void> {
    const groupId = interaction.customId.split(':')[1];

    const group = await db.group.findUnique({ where: { id: groupId } });
    if (!group || group.guildId !== interaction.guildId) {
        await replyError(interaction, 'This group no longer exists.');
        return;
    }
    // Re-checked on submit — permissions may have changed while the modal was open
    if (!(await canEditGroup(group, interaction))) {
        await replyError(interaction, NO_PERMISSION);
        return;
    }

    const nameResult     = validateDisplayName(extractField(interaction, 'name'));
    const codeNameResult = validateCodeName(extractField(interaction, 'code_name'));
    const rawTheme       = extractField(interaction, 'background_theme');

    if (!nameResult.valid || !codeNameResult.valid) {
        const lines: string[] = [];
        if (!nameResult.valid)     lines.push(`**Display Name** ${FILTER_MESSAGES[nameResult.reason]}`);
        if (!codeNameResult.valid) lines.push(`**Code Name** ${FILTER_MESSAGES[codeNameResult.reason]}`);
        await replyError(interaction, lines.join('\n'));
        return;
    }

    const name            = nameResult.value;
    const codeName        = codeNameResult.value;
    const backgroundTheme = isGraphTheme(rawTheme) ? rawTheme : group.backgroundTheme;

    if (!name || !codeName) {
        await replyError(interaction, 'Both Display Name and Code Name are required.');
        return;
    }

    try {
        await db.group.update({ where: { id: groupId }, data: { name, codeName, backgroundTheme } });
    } catch (err) {
        const isPrismaUnique = (err as { code?: string }).code === 'P2002';
        if (!isPrismaUnique) console.error('[handleGroupEditModal]', err);
        await replyError(interaction, isPrismaUnique
            ? `A group with code name \`${codeName}\` already exists.`
            : 'Something went wrong. Please try again.');
        return;
    }

    // Keep the linked Discord group tag in step with the display name
    let warning: string | null = null;
    if (name !== group.name && group.discordRoleId) {
        try {
            const discordRole = await interaction.guild!.roles.fetch(group.discordRoleId);
            if (discordRole) await discordRole.edit({ name, reason: `KARC: group renamed from "${group.name}"` });
            else warning = 'The group was updated, but its linked Discord group tag no longer exists — run a role sync to recreate it.';
        } catch (err) {
            console.error('[handleGroupEditModal] Discord role rename failed:', err);
            warning = 'The group was updated, but the Discord group tag could not be renamed. Make sure the bot has Manage Roles permission.';
        }
    }

    // Refresh the info panel the Edit button lives on; fall back to a confirmation otherwise
    const updated = await fetchInfoGroup(groupId);
    if (interaction.isFromMessage() && updated) {
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: await buildInfoComponents(interaction.guild!, updated, 0),
        } as never);
    } else {
        await interaction.reply({
            flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.success, components: [{ type: 10, content: `## Group Updated\n**${name}** (\`${codeName}\`) has been updated.` }] }],
        } as never);
    }

    if (warning) {
        await interaction.followUp({
            flags:      MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: warning }] }],
        } as never);
    }
}
