import 'dotenv/config';
import fs from 'fs';
import { buildRoleGraphBuffer } from '../src/core/roleGraph.js';

const mockRoles = [
    { id: '1',  name: 'Moon Seeker',           position: 1, subName: 'Universal',  color: '#C8D4EC', progressionsFrom: [{ toRoleId: '2' }],                                    members: [{ characterName: 'Aelindra' }] },
    { id: '2',  name: 'Acolyte',               position: 2, subName: 'Universal',  color: '#A8BCDC', progressionsFrom: [{ toRoleId: '3' }, { toRoleId: '4' }, { toRoleId: '8' }], members: [{ characterName: "Mi'Na" }, { characterName: 'Vorath' }] },
    { id: '3',  name: 'Warrior Adept',         position: 3, subName: 'Warrior',    color: '#6090D8', progressionsFrom: [{ toRoleId: '5' }, { toRoleId: '6' }],                 members: [] },
    { id: '4',  name: 'Disciple',              position: 3, subName: 'Priest',     color: '#A87ED8', progressionsFrom: [{ toRoleId: '7' }],                                    members: [{ characterName: 'Serath' }] },
    { id: '8',  name: 'Lunar Scribe',          position: 3, subName: 'Scribe',     color: '#4CB8B4', progressionsFrom: [{ toRoleId: '9' }],                                    members: [] },
    { id: '5',  name: 'Lunar Guard',           position: 4, subName: 'Warrior',    color: '#4878C4', progressionsFrom: [{ toRoleId: '10' }],                                   members: [] },
    { id: '6',  name: 'Moon Monk',             position: 4, subName: 'Warrior',    color: '#6878C8', progressionsFrom: [{ toRoleId: '10' }],                                   members: [] },
    { id: '7',  name: 'Moon Priest/Priestess', position: 4, subName: 'Priest',     color: '#9068C8', progressionsFrom: [{ toRoleId: '11' }],                                   members: [] },
    { id: '9',  name: 'Lunar Archivist',       position: 4, subName: 'Scribe',     color: '#3CA8A4', progressionsFrom: [{ toRoleId: '12' }],                                   members: [] },
    { id: '10', name: 'Lead Moon Monk',        position: 5, subName: 'Warrior',    color: '#3860B0', progressionsFrom: [],                                                       members: [] },
    { id: '11', name: 'High Priest/Priestess', position: 5, subName: 'Priest',     color: '#7850B8', progressionsFrom: [],                                                       members: [] },
    { id: '12', name: 'Moon Keeper',           position: 5, subName: 'Scribe',     color: '#2C9898', progressionsFrom: [],                                                       members: [] },
    { id: '13', name: 'Moon Bishop',           position: 7, subName: 'Leadership', color: '#E8C84A', progressionsFrom: [],                                                       members: [{ characterName: 'Nyvara Thornweave' }] },
];

const buf = buildRoleGraphBuffer(mockRoles, 'Lunar Clergy');
fs.writeFileSync('scripts/test-output.png', buf);
console.log('Written to scripts/test-output.png');
