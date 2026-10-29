import { ButtonInteraction, MessageFlags, StringSelectMenuInteraction } from 'discord.js';
import { db } from '../../../db/index.js';
import { loadAuthorizedSession, renderPanel } from './editShared.js';

// Discord caps a select menu at 25 options; one is always '— None —'.
const PAGE_SIZE = 24;

function buildCareerSelectComponents(
    sessionId:       string,
    careers:         Array<{ id: string; value: string }>,
    currentCareerId: string | null,
    page:            number,
): unknown[] {
    const totalPages = Math.max(1, Math.ceil(careers.length / PAGE_SIZE));
    const safePage   = Math.min(Math.max(page, 0), totalPages - 1);
    const pageItems  = careers.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

    const options = [
        { label: '— None —', value: '__none__', default: currentCareerId === null },
        ...pageItems.map(c => ({ label: c.value, value: c.id, default: c.id === currentCareerId })),
    ];

    const components: unknown[] = [{
        type:       17,
        components: [
            { type: 10, content: 'Select a Career:' },
            { type: 1, components: [{
                type:        3,
                custom_id:   `character_editpanel_career_select:${sessionId}`,
                placeholder: 'Select a career',
                options,
            }] },
        ],
    }];

    if (totalPages > 1) {
        components.push({ type: 1, components: [
            { type: 2, style: 2, label: '◀', custom_id: `character_editpanel_career_page:${sessionId}:${safePage - 1}`, disabled: safePage === 0 },
            { type: 2, style: 2, label: '▶', custom_id: `character_editpanel_career_page:${sessionId}:${safePage + 1}`, disabled: safePage === totalPages - 1 },
        ] });
    }
    components.push({ type: 1, components: [{ type: 2, style: 2, label: 'Back', custom_id: `character_editpanel_back:${sessionId}` }] });

    return components;
}

async function showCareerPage(interaction: ButtonInteraction, sessionId: string, page: number | null): Promise<void> {
    const session = await loadAuthorizedSession(interaction, sessionId);
    if (!session) return;

    const careers   = await db.career.findMany({ orderBy: { value: 'asc' } });
    const currentId = session.draft.career?.id ?? null;

    // With no page given, open on the page holding the current career.
    if (page === null) {
        const currentIndex = currentId ? careers.findIndex(c => c.id === currentId) : -1;
        page = currentIndex >= 0 ? Math.floor(currentIndex / PAGE_SIZE) : 0;
    }

    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: buildCareerSelectComponents(sessionId, careers, currentId, page),
    } as never);
}

// customId: character_editpanel_career:<sessionId>
export async function handleEditPanelCareerButton(interaction: ButtonInteraction): Promise<void> {
    const sessionId = interaction.customId.slice('character_editpanel_career:'.length);
    await showCareerPage(interaction, sessionId, null);
}

// customId: character_editpanel_career_page:<sessionId>:<page>
export async function handleEditPanelCareerPage(interaction: ButtonInteraction): Promise<void> {
    const [, sessionId, pageStr] = interaction.customId.split(':');
    await showCareerPage(interaction, sessionId, parseInt(pageStr, 10) || 0);
}

// customId: character_editpanel_career_select:<sessionId>  (careerId or '__none__' from values[0])
export async function handleEditPanelCareerSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const sessionId = interaction.customId.slice('character_editpanel_career_select:'.length);
    const choice    = interaction.values[0];

    const session = await loadAuthorizedSession(interaction, sessionId);
    if (!session) return;

    if (choice === '__none__') {
        session.draft.career = null;
    } else {
        const career = await db.career.findUnique({ where: { id: choice } });
        session.draft.career = career ? { id: career.id, value: career.value } : null;
    }

    await renderPanel(interaction, sessionId);
}
