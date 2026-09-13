import 'dotenv/config';
import { db } from '../src/db/index.js';

const CAREERS = [
    'Alchemist',
    'Chef',
    'Tailor',
    'Woodcutter',
    'Prospector',
    'Smith',
    'Enchanter',
    'Hunter',
    'Warrior',
];

const RESIDENCES = [
    'Dawnstar',
    'Falkreath',
    'Markarth',
    'Morthal',
    'Riften',
    'Solitude',
    'Whiterun',
    'Windhelm',
    'Winterhold',
    'Dragon Bridge',
    'Helgen',
    'Ivarstead',
    'Karthwasten',
    'Riverwood',
    'Rorikstead',
    "Shor's Stone",
    'Granite Hill',
    'Markarth Side',
    'Oakwood',
    "Oar's Rest",
];

async function main(): Promise<void> {
    console.log('Seeding Career lookup values...');
    for (const value of CAREERS) {
        await db.career.upsert({ where: { value }, update: {}, create: { value } });
        console.log(`  Career: ${value}`);
    }

    console.log('Seeding Residence lookup values...');
    for (const value of RESIDENCES) {
        await db.residence.upsert({ where: { value }, update: {}, create: { value } });
        console.log(`  Residence: ${value}`);
    }

    console.log(`\nDone. ${CAREERS.length} careers, ${RESIDENCES.length} residences.`);
}

main()
    .catch(err => { console.error(err); process.exitCode = 1; })
    .finally(() => db.$disconnect());
