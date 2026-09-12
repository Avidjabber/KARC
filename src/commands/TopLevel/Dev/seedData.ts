import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { db } from '../../../db/index.js';

function hexToNumber(hex: string): number {
    return parseInt(hex.replace('#', ''), 16);
}

const ALLOWED_USER_ID = '447183935437406218';

export const data = new SlashCommandBuilder()
    .setName('seeddata')
    .setDescription('Seed test data (dev only)');

type RoleSeed = {
    name:                  string;
    position:              number;
    subName:               string;
    color:                 string;
    canManageGroup?:       boolean;
    canManageAssignments?: boolean;
};

const ROLES: RoleSeed[] = [
    // Universal — pale silver-blue moonlight
    { name: 'Moon Seeker',           position: 1, subName: "Kha'jay Tosuv",           color: '#C8D4EC' },
    { name: 'Acolyte',               position: 2, subName: "Ifa Kha'jay",             color: '#A8BCDC' },
    // Warrior path — blues growing more intense (not darker) with rank
    { name: 'Warrior Adept',         position: 3, subName: "Jrantith Kha'jay Rakiit", color: '#9FC1EE' },
    { name: 'Lunar Guard',           position: 4, subName: "Kha'jay Rasiniit",        color: '#6FA0E0' },
    { name: 'Moon Monk',             position: 4, subName: "Kha'jay Rakiit",          color: '#6FA0E0' },
    { name: 'Lead Moon Monk',        position: 5, subName: "T'harith Kha'jay Siniit", color: '#4C82D6', canManageGroup: true, canManageAssignments: true },
    // Priest path — teal growing more intense (not darker) with rank
    { name: 'Disciple',              position: 3, subName: 'Deliit',                  color: '#8FE0D8' },
    { name: 'Moon Priest/Priestess', position: 4, subName: "Kha'jay Siniit",          color: '#5CC9BE' },
    { name: 'High Priest/Priestess', position: 5, subName: "Kha'jay Ali Siniit",      color: '#33AFA2', canManageGroup: true, canManageAssignments: true },
    // Scribe path — purple growing more intense (not darker) with rank
    { name: 'Lunar Scribe',          position: 3, subName: 'Jabo Durrarriit',         color: '#C79FEE' },
    { name: 'Lunar Archivist',       position: 4, subName: "Kha'jay Durrarriit",      color: '#A96FE0' },
    { name: 'Moon Keeper',           position: 5, subName: "T'harith Kha'jay Durrarriit", color: '#8B4CD6', canManageGroup: true, canManageAssignments: true },
    // Leadership — moonlit gold
    { name: 'Moon Bishop',           position: 7, subName: "Tarmo Kha'jay",           color: '#E8C84A', canManageGroup: true, canManageAssignments: true },
];

const EDGES: [string, string][] = [
    ['Moon Seeker',           'Acolyte'],
    ['Acolyte',               'Warrior Adept'],
    ['Acolyte',               'Disciple'],
    ['Acolyte',               'Lunar Scribe'],
    ['Warrior Adept',         'Lunar Guard'],
    ['Warrior Adept',         'Moon Monk'],
    ['Lunar Guard',           'Lead Moon Monk'],
    ['Moon Monk',             'Lead Moon Monk'],
    ['Disciple',              'Moon Priest/Priestess'],
    ['Moon Priest/Priestess', 'High Priest/Priestess'],
    ['Lunar Scribe',          'Lunar Archivist'],
    ['Lunar Archivist',       'Moon Keeper'],
];

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (interaction.user.id !== ALLOWED_USER_ID) {
        await interaction.editReply({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'You are not authorized to run this command.' }] }],
        } as never);
        return;
    }

    const guildId = interaction.guildId!;
    const lines:  string[] = [];

    const group = await db.group.upsert({
        where:  { codeName: 'p2_lunar_clergy' },
        update: { name: 'Lunar Clergy', ownerId: ALLOWED_USER_ID, guildId },
        create: { codeName: 'p2_lunar_clergy', name: 'Lunar Clergy', ownerId: ALLOWED_USER_ID, guildId },
    });
    lines.push(`Group: **${group.name}** (\`${group.codeName}\`)`);

    // Fetch the guild's existing Discord roles once
    const guild           = interaction.guild!;
    const guildRoles      = await guild.roles.fetch();
    let discordCreated    = 0;
    let discordLinked     = 0;
    let discordRecolored  = 0;

    const roleIdMap = new Map<string, string>();
    for (const r of ROLES) {
        // Find or create a matching Discord server role
        let discordRole = guildRoles.find(dr => dr.name === r.name) ?? null;
        const targetColor = hexToNumber(r.color);
        if (!discordRole) {
            discordRole = await guild.roles.create({
                name:   r.name,
                color:  targetColor,
                reason: 'seeddata — Lunar Clergy group role',
            });
            discordCreated++;
        } else {
            discordLinked++;
            if (discordRole.color !== targetColor) {
                discordRole = await discordRole.edit({
                    color:  targetColor,
                    reason: 'seeddata — sync role color with seed data',
                });
                discordRecolored++;
            }
        }

        const role = await db.groupRole.upsert({
            where:  { groupId_name: { groupId: group.id, name: r.name } },
            update: {
                position:             r.position,
                subName:              r.subName,
                color:                r.color,
                discordRoleId:        discordRole.id,
                canManageGroup:       r.canManageGroup       ?? false,
                canManageAssignments: r.canManageAssignments ?? false,
            },
            create: {
                groupId:              group.id,
                name:                 r.name,
                position:             r.position,
                subName:              r.subName,
                color:                r.color,
                discordRoleId:        discordRole.id,
                canManageGroup:       r.canManageGroup       ?? false,
                canManageAssignments: r.canManageAssignments ?? false,
            },
        });
        roleIdMap.set(r.name, role.id);
    }
    lines.push(`Roles: ${ROLES.length} upserted (${discordCreated} Discord roles created, ${discordLinked} linked, ${discordRecolored} recolored)`);

    let edgeCount = 0;
    for (const [from, to] of EDGES) {
        const fromId = roleIdMap.get(from);
        const toId   = roleIdMap.get(to);
        if (!fromId || !toId) continue;
        await db.groupRoleProgression.upsert({
            where:  { fromRoleId_toRoleId: { fromRoleId: fromId, toRoleId: toId } },
            update: {},
            create: { fromRoleId: fromId, toRoleId: toId },
        });
        edgeCount++;
    }
    lines.push(`Progressions: ${edgeCount} upserted`);
    lines.push('-# Done.');

    await interaction.editReply({
        flags:      MessageFlags.IsComponentsV2,
        components: [{
            type:         17,
            accent_color: colors.success,
            components:   [{ type: 10, content: lines.join('\n') }],
        }],
    } as never);
}
