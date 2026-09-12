import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Client } from 'discord.js';
import { loadCommands } from '../handlers/loadCommands.js';
import { setBotPresence } from '../core/presence.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default async function onReady(client: Client): Promise<void> {
    console.log(`Logged in as ${client.user!.tag}`);

    const commandsDir = join(__dirname, '..', 'commands');
    await loadCommands(commandsDir, client);

    setBotPresence(client, {
        status:   process.env.BOT_STATUS,
        activity: process.env.BOT_ACTIVITY_TEXT,
        type:     process.env.BOT_ACTIVITY_TYPE,
    });
}
