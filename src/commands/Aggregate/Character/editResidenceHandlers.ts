import { ButtonInteraction, MessageFlags } from 'discord.js';
import { db } from '../../../db/index.js';
import { loadAuthorizedSession, renderPanel } from './editShared.js';

// Each residence row costs 3 components (Section + its text + its accessory button); with the
// container/header/dividers/nav-rows overhead, Discord's 40-component-per-message cap for
// Components V2 caps this well below 10 per page — keep real headroom below that ceiling.
const PAGE_SIZE = 5;

function buildResidenceListComponents(
    sessionId:           string,
    residences:          Array<{ id: string; value: string }>,
    currentResidenceId:  string | null,
    page:                number,
): unknown[] {
    const totalPages = Math.max(1, Math.ceil(residences.length / PAGE_SIZE));
    const safePage    = Math.min(Math.max(page, 0), totalPages - 1);
    const pageItems   = residences.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

    const sections = pageItems.map(r => {
        const isCurrent = r.id === currentResidenceId;
        return {
            type:       9,
            components: [{ type: 10, content: isCurrent ? `**${r.value}** — *current*` : r.value }],
            accessory:  {
                type:      2,
                style:     isCurrent ? 2 : 1,
                label:     isCurrent ? 'Current' : 'Select',
                disabled:  isCurrent,
                custom_id: `character_editpanel_residence_select:${sessionId}:${r.id}`,
            },
        };
    });

    return [{
        type:       17,
        components: [
            { type: 10, content: 'Select a Residence:' },
            { type: 14, divider: true },
            ...sections,
            { type: 14, divider: true },
            { type: 1, components: [
                { type: 2, style: 2, label: '◀', custom_id: `character_editpanel_residence_page:${sessionId}:${safePage - 1}`, disabled: safePage === 0 },
                { type: 2, style: 2, label: `${safePage + 1} / ${totalPages}`, custom_id: 'character_editpanel_noop', disabled: true },
                { type: 2, style: 2, label: '▶', custom_id: `character_editpanel_residence_page:${sessionId}:${safePage + 1}`, disabled: safePage === totalPages - 1 },
            ] },
            { type: 1, components: [
                { type: 2, style: 4, label: 'Clear Residence', custom_id: `character_editpanel_residence_clear:${sessionId}`, disabled: currentResidenceId === null },
                { type: 2, style: 2, label: 'Back', custom_id: `character_editpanel_back:${sessionId}` },
            ] },
        ],
    }];
}

async function showResidencePage(interaction: ButtonInteraction, sessionId: string, page: number): Promise<void> {
    const session = await loadAuthorizedSession(interaction, sessionId);
    if (!session) return;

    const residences = await db.residence.findMany({ orderBy: { value: 'asc' } });

    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: buildResidenceListComponents(sessionId, residences, session.draft.residence?.id ?? null, page),
    } as never);
}

// customId: character_editpanel_residence:<sessionId>
export async function handleEditPanelResidenceButton(interaction: ButtonInteraction): Promise<void> {
    const sessionId = interaction.customId.slice('character_editpanel_residence:'.length);

    const session = await loadAuthorizedSession(interaction, sessionId);
    if (!session) return;

    const residences   = await db.residence.findMany({ orderBy: { value: 'asc' } });
    const currentId     = session.draft.residence?.id ?? null;
    const currentIndex  = currentId ? residences.findIndex(r => r.id === currentId) : -1;
    const initialPage   = currentIndex >= 0 ? Math.floor(currentIndex / PAGE_SIZE) : 0;

    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: buildResidenceListComponents(sessionId, residences, currentId, initialPage),
    } as never);
}

// customId: character_editpanel_residence_page:<sessionId>:<page>
export async function handleEditPanelResidencePage(interaction: ButtonInteraction): Promise<void> {
    const [, sessionId, pageStr] = interaction.customId.split(':');
    await showResidencePage(interaction, sessionId, parseInt(pageStr, 10) || 0);
}

// customId: character_editpanel_residence_select:<sessionId>:<residenceId>
export async function handleEditPanelResidenceSelect(interaction: ButtonInteraction): Promise<void> {
    const [, sessionId, residenceId] = interaction.customId.split(':');

    const session = await loadAuthorizedSession(interaction, sessionId);
    if (!session) return;

    const residence = await db.residence.findUnique({ where: { id: residenceId } });
    session.draft.residence = residence ? { id: residence.id, value: residence.value } : null;

    await renderPanel(interaction, sessionId);
}

// customId: character_editpanel_residence_clear:<sessionId>
export async function handleEditPanelResidenceClear(interaction: ButtonInteraction): Promise<void> {
    const sessionId = interaction.customId.slice('character_editpanel_residence_clear:'.length);

    const session = await loadAuthorizedSession(interaction, sessionId);
    if (!session) return;

    session.draft.residence = null;
    await renderPanel(interaction, sessionId);
}
