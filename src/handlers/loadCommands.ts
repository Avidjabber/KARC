import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { Client } from 'discord.js';
import type { CommandModule } from '../core/client.js';

/**
 * Loads all commands into client.commands and returns an array for deployment.
 *
 * Directory conventions:
 *   commands/TopLevel/{Category}/{command}.ts   — standalone slash commands
 *   commands/Aggregate/{Name}/index.ts          — subcommand aggregators
 */
export async function loadCommands(baseDir: string, client: Client): Promise<object[]> {
    client.commands.clear();

    const loaded = new Set<string>();
    const forDeploy: object[] = [];

    // ── TopLevel ──────────────────────────────────────────────────────────────
    const topLevelDir = path.join(baseDir, 'TopLevel');
    if (fs.existsSync(topLevelDir)) {
        await loadFolderCommands(topLevelDir, client, loaded, forDeploy);
    }

    // ── Aggregate ─────────────────────────────────────────────────────────────
    const aggregateDir = path.join(baseDir, 'Aggregate');
    if (fs.existsSync(aggregateDir)) {
        for (const folder of fs.readdirSync(aggregateDir)) {
            const folderPath = path.join(aggregateDir, folder);
            if (!fs.statSync(folderPath).isDirectory()) continue;

            const indexFile = findIndexFile(folderPath);
            if (!indexFile) continue;

            await loadCommandFile(indexFile, client, loaded, forDeploy);
        }
    }

    console.log(`[loadCommands] Loaded ${client.commands.size} command(s).`);
    return forDeploy;
}

async function loadFolderCommands(
    dirPath: string,
    client: Client,
    loaded: Set<string>,
    forDeploy: object[],
): Promise<void> {
    for (const entry of fs.readdirSync(dirPath)) {
        const entryPath = path.join(dirPath, entry);
        if (fs.statSync(entryPath).isDirectory()) {
            await loadFolderCommands(entryPath, client, loaded, forDeploy);
        } else if (isCommandFile(entry)) {
            await loadCommandFile(entryPath, client, loaded, forDeploy);
        }
    }
}

async function loadCommandFile(
    filePath: string,
    client: Client,
    loaded: Set<string>,
    forDeploy: object[],
): Promise<void> {
    try {
        const mod = (await import(pathToFileURL(filePath).href)) as Partial<CommandModule>;

        if (!mod.data || !mod.execute) {
            console.warn(`[loadCommands] Missing "data" or "execute" in ${filePath}`);
            return;
        }

        const name = mod.data.name;
        if (loaded.has(name)) {
            console.warn(`[loadCommands] Duplicate command name "${name}" — skipping ${filePath}`);
            return;
        }

        client.commands.set(name, mod as CommandModule);
        forDeploy.push(mod.data.toJSON ? mod.data.toJSON() : mod.data);
        loaded.add(name);
    } catch (err) {
        console.error(`[loadCommands] Failed to load ${filePath}:`, err);
    }
}

function findIndexFile(dir: string): string | null {
    for (const ext of ['.ts', '.js']) {
        const p = path.join(dir, `index${ext}`);
        if (fs.existsSync(p)) return p;
    }
    return null;
}

function isCommandFile(filename: string): boolean {
    return (filename.endsWith('.ts') || filename.endsWith('.js')) && !filename.endsWith('.d.ts');
}
