import { ButtonInteraction, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { isServerAdmin } from '../../../core/permissions.js';
import { db } from '../../../db/index.js';
import { syncCharacterLookupTags } from './lookupTagSync.js';

// customId: character_purge_confirm:<userId>
export async function handlePurgeConfirm(interaction: ButtonInteraction): Promise<void> {
    const targetId = interaction.customId.slice('character_purge_confirm:'.length);
    const guildId  = interaction.guildId!;

    // Re-check permission in case roles changed since the command ran
    if (!isServerAdmin(interaction)) {
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'You no longer have permission to do this.' }] }],
        } as never);
        return;
    }

    const characters = await db.character.findMany({
        where:   { guildId, userId: targetId },
        orderBy: { name: 'asc' },
        include: {
            career:    { select: { id: true, value: true } },
            residence: { select: { id: true, value: true } },
            memberships: {
                include: {
                    group:     true,
                    groupRole: true,
                },
            },
        },
    });

    if (characters.length === 0) {
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: `<@${targetId}> no longer has any characters in this server.` }] }],
        } as never);
        return;
    }

    // Fetched once up front — if the target has left the server this is null, and every Discord
    // role removal below is simply skipped (there's nothing to clean up on the Discord side).
    const discordMember = await interaction.guild!.members.fetch(targetId).catch(() => null);

    const groupsLeft = new Set<string>();

    for (const character of characters) {
        for (const membership of character.memberships) {
            groupsLeft.add(membership.group.name);

            if (!discordMember) continue;
            try {
                if (membership.groupRole.discordRoleId) {
                    await discordMember.roles.remove(
                        membership.groupRole.discordRoleId,
                        `KARC: purged character ${character.name}`,
                    );
                }
                // A member holds at most one role per group, so losing this role means leaving the group entirely.
                if (membership.group.discordRoleId) {
                    await discordMember.roles.remove(
                        membership.group.discordRoleId,
                        `KARC: purged character ${character.name}`,
                    );
                }
            } catch (err) {
                console.error('[character purge confirm] Discord role remove failed:', err);
            }
        }

        // Cascades to GroupRoleMember rows for this character.
        await db.character.delete({ where: { id: character.id } });

        // Best-effort — drop Career/Residence tags no other remaining character of theirs still carries.
        try {
            await syncCharacterLookupTags(
                interaction.guild!, guildId, targetId,
                { career: character.career, residence: character.residence },
                { career: null, residence: null },
            );
        } catch (err) {
            console.error('[character purge confirm] lookup tag sync failed:', err);
        }
    }

    const summary = groupsLeft.size > 0
        ? `\n-# Removed from: ${[...groupsLeft].map(n => `**${n}**`).join(', ')}.`
        : '';
    const leftNote = discordMember ? '' : '\n-# They are no longer in this server, so no Discord roles needed to be removed.';

    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: [{
            type:         17,
            accent_color: colors.success,
            components:   [{ type: 10, content: `Deleted **${characters.length}** character(s) belonging to <@${targetId}>.${summary}${leftNote}` }],
        }],
    } as never);
}

export async function handlePurgeCancel(interaction: ButtonInteraction): Promise<void> {
    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: [{ type: 17, components: [{ type: 10, content: 'Cancelled.' }] }],
    } as never);
}
