import { Guild } from 'discord.js';

type LookupValue = { id: string; value: string };

/**
 * Ensures a single lookup value (a specific Career, Residence, ...) has a linked Discord tag in
 * this guild, finding one by name or creating it, and persists the link. Returns null if creation
 * failed (e.g. the bot lacks Manage Roles).
 */
export async function ensureLookupRoleId(
    guild:          Guild,
    label:          string,
    valueId:        string,
    valueName:      string,
    existingRoleId: string | undefined,
    persistRole:    (valueId: string, discordRoleId: string) => Promise<void>,
): Promise<string | null> {
    let discordRoleId = existingRoleId && guild.roles.cache.has(existingRoleId) ? existingRoleId : undefined;

    if (!discordRoleId) {
        try {
            const existing = guild.roles.cache.find(r => r.name === valueName);
            if (existing) {
                discordRoleId = existing.id;
            } else {
                const created = await guild.roles.create({ name: valueName, reason: `KARC: ${label.toLowerCase()} tag created for "${valueName}"` });
                discordRoleId = created.id;
            }
            await persistRole(valueId, discordRoleId);
        } catch (err) {
            console.error(`[ensureLookupRoleId] ${label} tag creation failed:`, err);
            return null;
        }
    }

    return discordRoleId;
}

/**
 * Ensures every lookup value (Career, Residence, ...) has a linked Discord tag in this guild —
 * creating one if missing — then reconciles who holds it against `membersByValueId`.
 */
export async function syncLookupTags(
    guild:             Guild,
    label:             string,
    values:            LookupValue[],
    existingRoleIds:   Map<string, string>,
    membersByValueId:  Map<string, Set<string>>,
    persistRole:       (valueId: string, discordRoleId: string) => Promise<void>,
): Promise<string[]> {
    const lines: string[] = [];

    for (const value of values) {
        const hadRole      = existingRoleIds.has(value.id);
        const discordRoleId = await ensureLookupRoleId(guild, label, value.id, value.value, existingRoleIds.get(value.id), persistRole);

        if (!discordRoleId) {
            lines.push(`⚠️ **${value.value}** — could not set up a Discord ${label.toLowerCase()} tag.`);
            continue;
        }

        if (!hadRole || existingRoleIds.get(value.id) !== discordRoleId) {
            lines.push(`**${value.value}** _(${label} tag)_\n-# Linked a Discord role as this ${label.toLowerCase()}'s tag.`);
        }

        const discordRole = guild.roles.cache.get(discordRoleId);
        if (!discordRole) continue;

        const expected = membersByValueId.get(value.id) ?? new Set<string>();
        const current  = new Set(discordRole.members.map(m => m.id));

        const toAdd    = [...expected].filter(id => !current.has(id));
        const toRemove = [...current].filter(id => !expected.has(id));

        for (const id of toAdd) {
            try {
                const member = await guild.members.fetch(id);
                await member.roles.add(discordRoleId, `KARC: sync — ${label.toLowerCase()} set to ${value.value}`);
            } catch (err) {
                console.error(`[sync] ${label} tag add failed:`, err);
            }
        }
        for (const id of toRemove) {
            try {
                const member = await guild.members.fetch(id);
                await member.roles.remove(discordRoleId, `KARC: sync — ${label.toLowerCase()} no longer ${value.value}`);
            } catch (err) {
                console.error(`[sync] ${label} tag remove failed:`, err);
            }
        }

        if (toAdd.length > 0 || toRemove.length > 0) {
            const parts = [`**${value.value}** _(${label} tag)_`];
            if (toAdd.length > 0)    parts.push(`-# Applied to ${toAdd.length} member${toAdd.length === 1 ? '' : 's'}.`);
            if (toRemove.length > 0) parts.push(`-# Removed from ${toRemove.length} member${toRemove.length === 1 ? '' : 's'}.`);
            lines.push(parts.join('\n'));
        }
    }

    return lines;
}
