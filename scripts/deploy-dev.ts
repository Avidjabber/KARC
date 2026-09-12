import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Client, GatewayIntentBits } from 'discord.js';
import { loadCommands } from '../src/handlers/loadCommands.js';
import { deployCommands } from '../src/handlers/deploy.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    client.commands = new Map();

    const commandsDir = join(__dirname, '..', 'src', 'commands');
    const commands = await loadCommands(commandsDir, client);

    await deployCommands(
        commands,
        true,
        process.env.CLIENT_ID!,
        process.env.GUILD_ID,
    );
}

main()
    .then(() => { process.exitCode = 0; })
    .catch(err => {
        console.error('[deploy:dev] Failed:', err);
        process.exitCode = 1;
    });
