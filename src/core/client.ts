import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';

declare module 'discord.js' {
    interface Client {
        commands: Map<string, CommandModule>;
    }
}

export interface CommandModule {
    data: { name: string; toJSON?: () => object };
    execute: (interaction: unknown) => Promise<void>;
    usesModal?: boolean;
    modalSubcommands?: Set<string>;
    publicSubcommands?: Set<string>;
    /**
     * Subcommands that issue their own first reply instead of being auto-deferred. Needed
     * whenever whether the result should be public or ephemeral depends on data the command
     * only knows after its own checks run (e.g. an otherwise-public view that replies
     * ephemerally when there's nothing to show) — ephemeral-vs-public is fixed by Discord at
     * the first reply/defer and can't be changed by a later editReply.
     */
    manualAckSubcommands?: Set<string>;
}

export const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.User,
        Partials.GuildMember,
    ],
});
