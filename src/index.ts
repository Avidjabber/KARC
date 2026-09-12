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

    await client.login(process.env.BOT_TOKEN?.trim());
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
