import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';

const db = new PrismaClient();

const GUILD_ID  = '1546184626840666132';
const OWNER_ID  = '447183935437406218';
const CODE_NAME = 'p2_lunar_clergy';
const NAME      = 'Lunar Clergy';

type RoleSeed = {
    name:                string;
    position:            number;
    subName:         string;
    canManageGroup?:     boolean;
    canManageAssignments?: boolean;
};

const ROLES: RoleSeed[] = [
    // Universal
    { name: 'Moon Seeker',          position: 1, subName: 'Universal' },
    { name: 'Acolyte',              position: 2, subName: 'Universal' },

    // Warrior path
    { name: 'Warrior Adept',        position: 3, subName: 'Warrior' },
    { name: 'Lunar Guard',          position: 4, subName: 'Warrior' },
    { name: 'Moon Monk',            position: 4, subName: 'Warrior' },
    { name: 'Lead Moon Monk',       position: 5, subName: 'Warrior', canManageGroup: true, canManageAssignments: true },

    // Priest path
    { name: 'Moon Priest/Priestess', position: 3, subName: 'Priest' },
    { name: 'High Priest/Priestess', position: 5, subName: 'Priest', canManageGroup: true, canManageAssignments: true },

    // Scribe path
    { name: 'Moon-Scribe',          position: 3, subName: 'Scribe' },
    { name: 'Lunar Archivist',      position: 4, subName: 'Scribe' },
    { name: 'Moon Keeper',          position: 5, subName: 'Scribe', canManageGroup: true, canManageAssignments: true },

    // Leadership — Moon Bishop outranks all three top ranks
    { name: 'Moon Bishop',          position: 7, subName: 'Leadership', canManageGroup: true, canManageAssignments: true },
];

const EDGES: [string, string][] = [
    // Universal
    ['Moon Seeker',           'Acolyte'],

    // Acolyte branches into all three paths
    ['Acolyte',               'Warrior Adept'],
    ['Acolyte',               'Moon Priest/Priestess'],
    ['Acolyte',               'Moon-Scribe'],

    // Warrior path
    ['Warrior Adept',         'Lunar Guard'],
    ['Warrior Adept',         'Moon Monk'],
    ['Lunar Guard',           'Lead Moon Monk'],
    ['Moon Monk',             'Lead Moon Monk'],

    // Priest path
    ['Moon Priest/Priestess', 'High Priest/Priestess'],

    // Scribe path
    ['Moon-Scribe',           'Lunar Archivist'],
    ['Lunar Archivist',       'Moon Keeper'],

    // All three senior ranks converge to Moon Bishop
    ['Lead Moon Monk',        'Moon Bishop'],
    ['High Priest/Priestess', 'Moon Bishop'],
    ['Moon Keeper',           'Moon Bishop'],
];

async function main(): Promise<void> {
    console.log(`Seeding group "${NAME}" (${CODE_NAME})...`);

    const group = await db.group.upsert({
        where:  { codeName: CODE_NAME },
        update: { name: NAME, ownerId: OWNER_ID, guildId: GUILD_ID },
        create: { codeName: CODE_NAME, name: NAME, ownerId: OWNER_ID, guildId: GUILD_ID },
    });
    console.log(`  Group: ${group.id}`);

    const roleIdMap = new Map<string, string>();
    for (const r of ROLES) {
        const role = await db.groupRole.upsert({
            where:  { groupId_name: { groupId: group.id, name: r.name } },
            update: {
                position:             r.position,
                subName:          r.subName,
                canManageGroup:       r.canManageGroup       ?? false,
                canManageAssignments: r.canManageAssignments ?? false,
            },
            create: {
                groupId:              group.id,
                name:                 r.name,
                position:             r.position,
                subName:          r.subName,
                canManageGroup:       r.canManageGroup       ?? false,
                canManageAssignments: r.canManageAssignments ?? false,
            },
        });
        roleIdMap.set(r.name, role.id);
        console.log(`  Role: ${r.name} (pos ${r.position})`);
    }

    for (const [from, to] of EDGES) {
        const fromId = roleIdMap.get(from);
        const toId   = roleIdMap.get(to);
        if (!fromId || !toId) {
            console.warn(`  SKIP edge "${from}" → "${to}": role not found`);
            continue;
        }
        await db.groupRoleProgression.upsert({
            where:  { fromRoleId_toRoleId: { fromRoleId: fromId, toRoleId: toId } },
            update: {},
            create: { fromRoleId: fromId, toRoleId: toId },
        });
        console.log(`  Edge: ${from} → ${to}`);
    }

    console.log('\nDone.');
}

main()
    .catch(err => { console.error(err); process.exitCode = 1; })
    .finally(() => db.$disconnect());
