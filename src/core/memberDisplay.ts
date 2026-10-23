import { Collection, Guild, GuildMember } from 'discord.js';

/** `Owner: username` per user ID, with a visible warning for anyone no longer in the server. */
export async function fetchOwnerLabels(guild: Guild, userIds: string[]): Promise<Map<string, string>> {
    const ids = [...new Set(userIds)];
    // Anyone missing from the batch fetch is no longer in the server — look up their username directly instead.
    const present: Collection<string, GuildMember> = ids.length > 0
        ? await guild.members.fetch({ user: ids }).catch(() => new Collection<string, GuildMember>())
        : new Collection<string, GuildMember>();

    const labels = new Map<string, string>();
    for (const id of ids) {
        const member = present.get(id);
        if (member) {
            labels.set(id, `Owner: **${member.user.username}**`);
        } else {
            const user = await guild.client.users.fetch(id).catch(() => null);
            labels.set(id, `Owner: ⚠️ ~~${user?.username ?? id}~~ — *no longer in this server*`);
        }
    }
    return labels;
}
