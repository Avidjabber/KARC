import { ButtonInteraction, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { isServerAdmin } from '../../../core/permissions.js';
import { db } from '../../../db/index.js';
import { buildPurgeConfirmation, buildPurgeListComponents } from './purge.js';
import { syncCharacterLookupTags } from './lookupTagSync.js';

async function rejectNonAdmin(interaction: ButtonInteraction): Promise<boolean> {
    // Re-checked on every click in case permissions changed since the command ran
    if (isServerAdmin(interaction)) return false;
    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'You no longer have permission to do this.' }] }],
    } as never);
    return true;
}

async function showList(interaction: ButtonInteraction, page: number, notice?: string): Promise<void> {
    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: await buildPurgeListComponents(interaction.guild!, page, notice),
    } as never);
}

// customId: character_purge_page:<page>
export async function handlePurgePage(interaction: ButtonInteraction): Promise<void> {
    if (await rejectNonAdmin(interaction)) return;
    const page = parseInt(interaction.customId.split(':')[1] ?? '0', 10);
    await showList(interaction, page);
}

// customId: character_purge_delete:<characterId>:<page>
export async function handlePurgeDelete(interaction: ButtonInteraction): Promise<void> {
    if (await rejectNonAdmin(interaction)) return;
    const [, characterId, pageStr] = interaction.customId.split(':');
    const page = parseInt(pageStr ?? '0', 10);

    const character = await db.character.findUnique({
        where:   { id: characterId },
        include: {
            memberships: {
                include: {
                    group:     { select: { name: true } },
                    groupRole: { select: { name: true } },
                },
            },
        },
    });

    if (!character || character.guildId !== interaction.guildId) {
        await showList(interaction, page, '-# That character no longer exists.');
        return;
    }

    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: [buildPurgeConfirmation(character)],
    } as never);
}

async function showResult(interaction: ButtonInteraction, content: string, accentColor?: number): Promise<void> {
    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: [{ type: 17, accent_color: accentColor, components: [{ type: 10, content }] }],
    } as never);
}

// customId: character_purge_confirm:<characterId>
export async function handlePurgeConfirm(interaction: ButtonInteraction): Promise<void> {
    if (await rejectNonAdmin(interaction)) return;
    const characterId = interaction.customId.slice('character_purge_confirm:'.length);
    const guildId     = interaction.guildId!;
    const guild   = interaction.guild!;

    const character = await db.character.findUnique({
        where:   { id: characterId },
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

    if (!character || character.guildId !== guildId) {
        await showResult(interaction, 'That character no longer exists.', colors.error);
        return;
    }

    // Cascades to GroupRoleMember rows for this character.
    await db.character.delete({ where: { id: characterId } });

    // If the owner has left the server there's nothing to clean up on the Discord side.
    const discordMember = character.memberships.length > 0
        ? await guild.members.fetch(character.userId).catch(() => null)
        : null;

    if (discordMember) {
        // The owner may have other characters in the same groups/roles — only drop Discord roles none of them still hold.
        const remaining = await db.groupRoleMember.findMany({
            where:   { userId: character.userId, group: { guildId } },
            include: { group: true, groupRole: true },
        });
        const stillHeld = new Set(remaining.flatMap(m => [m.groupRole.discordRoleId, m.group.discordRoleId]));

        const toRemove = new Set(
            character.memberships
                .flatMap(m => [m.groupRole.discordRoleId, m.group.discordRoleId])
                .filter((id): id is string => !!id && !stillHeld.has(id)),
        );

        for (const roleId of toRemove) {
            try {
                await discordMember.roles.remove(roleId, `KARC: character ${character.name} purged by an administrator`);
            } catch (err) {
                console.error('[character purge confirm] Discord role remove failed:', err);
            }
        }
    }

    // Best-effort — drop Career/Residence tags no other remaining character of theirs still carries.
    try {
        await syncCharacterLookupTags(
            guild, guildId, character.userId,
            { career: character.career, residence: character.residence },
            { career: null, residence: null },
        );
    } catch (err) {
        console.error('[character purge confirm] lookup tag sync failed:', err);
    }

    const groupsNote = character.memberships.length > 0
        ? `\n-# Removed from: ${character.memberships.map(m => `**${m.group.name}**`).join(', ')}.`
        : '';
    await showResult(interaction, `**${character.name}** (owned by <@${character.userId}>) has been deleted.${groupsNote}`, colors.success);
}

// customId: character_purge_cancel
export async function handlePurgeCancel(interaction: ButtonInteraction): Promise<void> {
    await showResult(interaction, 'Cancelled.');
}
