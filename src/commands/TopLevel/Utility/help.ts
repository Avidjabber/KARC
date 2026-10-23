import { ButtonInteraction, ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { colors } from '../../../core/colors.js';

export const data = new SlashCommandBuilder()
    .setName('help')
    .setDescription('How to set up your first group, roles, and characters');

type HelpPage = { label: string; title: string; body: string[] };

const PAGES: HelpPage[] = [
    {
        label: 'Overview',
        title: 'Getting Started with KARC',
        body: [
            'KARC tracks the groups in your server, the ranked roles inside them, and which characters hold those roles — and keeps everyone\'s Discord roles in sync.',
            '**Setup in four steps**\n'
            + '**1. Create a group** — `/group create`\n'
            + '**2. Create its roles** — `/roles create`\n'
            + '**3. Link roles into a progression** — `/roles setprogression`\n'
            + '**4. Create characters and assign them** — `/character create`, then `/roles assign`',
            '-# Use the buttons below to walk through each step. **More** covers managing members and other commands.',
        ],
    },
    {
        label: '1 · Group',
        title: 'Step 1 — Create a Group',
        body: [
            'Run `/group create` and fill in:\n'
            + '• **Display Name** — how the group is shown, e.g. *Lunar Clergy*\n'
            + '• **Code Name** — a short unique ID using lowercase letters, numbers, and underscores, e.g. `lunar_clergy`',
            'You become the group\'s **owner**. KARC also creates a Discord role with the group\'s name (or links an existing one with the same name) — every member of the group gets it.',
            '-# Find code names any time with `/group list`. Check a group with `/group info`.',
        ],
    },
    {
        label: '2 · Roles',
        title: 'Step 2 — Create Roles',
        body: [
            'Run `/roles create`. If you manage more than one group, pick the group first. Then set the role\'s permissions:\n'
            + '• **Can Manage Group** — may create, edit, and delete roles and progressions\n'
            + '• **Can Manage Assignments** — may assign members to roles at or below their own rank, and remove, promote, or demote members in roles below it',
            'Press **Next** and fill in:\n'
            + '• **Role Name** — e.g. *Moon Bishop*\n'
            + '• **Rank** — 1 to 1000, higher is more senior\n'
            + '• **Subname** *(optional)* — a secondary label shown beside the name\n'
            + '• **Color** *(optional)* — a hex code like `#7289da`',
            'KARC creates a matching Discord role, or links an existing Discord role with the same name.',
            '-# Only the group owner or a member with Can Manage Group can create roles. Make sure the KARC bot\'s role sits above the roles it manages.',
        ],
    },
    {
        label: '3 · Link',
        title: 'Step 3 — Link Roles into a Progression',
        body: [
            'Progressions define the path members climb through a group. Run `/roles setprogression` and pick two Discord roles:\n'
            + '• **from** — the role that leads forward\n'
            + '• **to** — the role it progresses into',
            'Repeat for each step of the ladder, e.g. *Acolyte → Priest → Moon Bishop*. Once linked, `/roles promote` and `/roles demote` move a member one step along the path — if the path branches, you pick which role they move to.',
            'View the result as a chart with `/group viewroles`.',
            '-# Both roles must belong to the same group, and you must own or manage that group.',
        ],
    },
    {
        label: '4 · Characters',
        title: 'Step 4 — Create Characters and Assign Roles',
        body: [
            '**Create a character**\nEach member runs `/character create`, sets a **Name** using its **Edit** button, then presses **Done**. **Bio**, **Career**, and **Residence** are optional — Career and Residence are picked from a list.',
            '**Assign a character to a role**\nRun `/roles assign`, choose the **user** and the **role**, then pick which of their characters should hold it. The member receives the role\'s Discord role and the group\'s Discord role.',
            'A character holds one role per group — assigning a new role in the same group moves them. Use `/group removemembers` to take them out.',
            '-# Assigning needs group ownership, Can Manage Group, or Can Manage Assignments at a rank at least as high as the role. See everyone with `/group viewmembers`.',
        ],
    },
    {
        label: 'More',
        title: 'Managing Members and Other Commands',
        body: [
            '**Remove members from a group** — `/group removemembers`\n'
            + 'Lists every character in a group you own or manage, with their role and owner. Press **Remove** beside one, then confirm, to take them out of the group. The character itself is kept.\n'
            + '-# With Can Manage Assignments, you can only remove characters ranked below your own role.',
            '**Clean up characters** — `/character purge` *(Administrators only)*\n'
            + 'Lists every character in the server, with their groups and ranks. Owners who have left the server are marked with ⚠️. Press **Delete** beside one, then confirm, to remove it from its groups and delete it permanently.',
            '**Other commands**\n'
            + '• **Characters** — `/character edit`, `/character list`, `/character info`, `/character delete`\n'
            + '• **Roles** — `/roles edit`, `/roles delete`, `/roles sync`\n'
            + '• **Groups** — `/group transferownership`, `/group delete`\n'
            + '• **Data** — `/data exportgroup` exports a group to an Excel file',
            '-# Removing a member or character only drops Discord roles that none of the owner\'s other characters still hold.',
        ],
    },
];

// Discord allows at most 5 buttons per action row
const BUTTONS_PER_ROW = 5;

function buildHelpComponents(page: number): unknown[] {
    const safePage = Math.min(Math.max(page, 0), PAGES.length - 1);
    const current  = PAGES[safePage];

    const buttons = PAGES.map((p, i) => ({
        type:      2,
        style:     i === safePage ? 1 : 2,
        label:     p.label,
        custom_id: `help_page:${i}`,
        disabled:  i === safePage,
    }));
    const rows: unknown[] = [];
    for (let i = 0; i < buttons.length; i += BUTTONS_PER_ROW) {
        rows.push({ type: 1, components: buttons.slice(i, i + BUTTONS_PER_ROW) });
    }

    return [{
        type:         17,
        accent_color: colors.info,
        components: [
            { type: 10, content: `## ${current.title}` },
            { type: 14, divider: true },
            ...current.body.map(content => ({ type: 10, content })),
            { type: 14, divider: true },
            ...rows,
        ],
    }];
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.editReply({
        flags:      MessageFlags.IsComponentsV2,
        components: buildHelpComponents(0),
    } as never);
}

// customId: help_page:<page>
export async function handleHelpPage(interaction: ButtonInteraction): Promise<void> {
    const page = parseInt(interaction.customId.split(':')[1] ?? '0', 10);
    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: buildHelpComponents(page),
    } as never);
}
