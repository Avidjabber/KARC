import { REST, Routes } from 'discord.js';

export async function deployCommands(
    commands: object[],
    debug: boolean,
    clientId: string,
    testGuildId?: string,
): Promise<void> {
    const rest = new REST({ version: '10', timeout: 300_000 }).setToken(process.env.BOT_TOKEN!);

    rest.on('rateLimited', info => {
        const resumeAt = new Date(Date.now() + info.timeToReset).toLocaleTimeString();
        const totalSec = Math.ceil(info.timeToReset / 1000);
        const minutes  = Math.floor(totalSec / 60);
        const seconds  = totalSec % 60;
        const duration = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
        console.warn(`Rate limited on ${info.route} — resuming at ${resumeAt} (${duration})`);
    });

    try {
        if (debug && testGuildId) {
            console.log(`[deploy] DEBUG: deploying ${commands.length} commands to guild ${testGuildId}...`);
            await rest.put(Routes.applicationGuildCommands(clientId, testGuildId), { body: commands });
            console.log('[deploy] DEBUG: guild commands deployed.');
        } else {
            console.log(`[deploy] Deploying ${commands.length} global commands...`);
            await rest.put(Routes.applicationCommands(clientId), { body: commands });
            console.log('[deploy] Global commands deployed.');
        }
    } catch (err) {
        console.error('[deploy] Error deploying commands:', err);
    }
}
