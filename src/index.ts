import 'dotenv/config';
import { client } from './core/client.js';
import interactionCreate from './events/interactionCreate.js';
import onReady from './events/onReady.js';
import onGuildCreate from './events/onGuildCreate.js';
import { db } from './db/index.js';

// ── Timestamps on all console output ──────────────────────────────────────────
const timestamp = () => new Date().toISOString();
const _log = console.log.bind(console);
const _error = console.error.bind(console);
console.log = (...args: unknown[]) => _log(`[${timestamp()}]`, ...args);
console.error = (...args: unknown[]) => _error(`[${timestamp()}]`, ...args);

// ── Commands collection ────────────────────────────────────────────────────────
client.commands = new Map();

// ── Events ────────────────────────────────────────────────────────────────────
client.once('clientReady', () => {
    onReady(client).catch(err => console.error('Error in onReady:', err));
});

client.on('guildCreate', guild =>
    onGuildCreate(guild).catch(err => console.error('Error in onGuildCreate:', err)),
);

client.on('interactionCreate', async interaction => {
    try {
        await interactionCreate(interaction, client);
    } catch (err) {
        console.error('Unhandled error in interactionCreate:', err);
    }
});

// ── Startup ───────────────────────────────────────────────────────────────────
async function start(): Promise<void> {
    console.log('[startup] Connecting to database...');
    await db.$connect();
    console.log('[startup] Database connected.');

    const token = process.env.BOT_TOKEN?.trim();
    console.log(`[startup] BOT_TOKEN length: ${token?.length ?? 'undefined'}`);
    console.log(`[startup] CLIENT_ID: ${process.env.CLIENT_ID ?? 'undefined'}`);
    console.log(`[startup] GUILD_ID: ${process.env.GUILD_ID ?? 'undefined'}`);
    console.log(`[startup] NODE_ENV: ${process.env.NODE_ENV ?? 'undefined'}`);
    console.log(`[startup] env keys containing "TOKEN": ${Object.keys(process.env).filter(k => k.includes('TOKEN')).join(', ') || '(none)'}`);
    await client.login(token);
}

start().catch(err => {
    console.error('[startup] Failed to start:', err);
    process.exit(1);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = async (signal: string) => {
    console.log(`${signal} received, shutting down...`);
    client.destroy();
    await db.$disconnect();
    process.exit(0);
};

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
