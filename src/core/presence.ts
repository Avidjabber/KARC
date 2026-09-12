import { ActivityType, Client, PresenceStatusData, PresenceUpdateStatus } from 'discord.js';

type PresenceOptions = {
    status?: string;
    activity?: string;
    type?: string;
};

export function setBotPresence(
    client: Client,
    { status = 'online', activity = 'over things', type = 'WATCHING' }: PresenceOptions = {},
): void {
    if (!client.user) {
        console.warn('setBotPresence called before client is ready — presence not set.');
        return;
    }

    const resolvedStatus =
        (PresenceUpdateStatus as Record<string, PresenceUpdateStatus>)[status.toUpperCase()] ??
        PresenceUpdateStatus.Online;

    const resolvedType =
        (ActivityType as unknown as Record<string, ActivityType>)[type.toUpperCase()] ??
        ActivityType.Watching;

    client.user.setPresence({
        status: resolvedStatus as PresenceStatusData,
        activities: [{ name: activity, type: resolvedType }],
    });
}
