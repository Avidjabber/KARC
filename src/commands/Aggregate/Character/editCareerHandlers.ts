import { ButtonInteraction, MessageFlags, StringSelectMenuInteraction } from 'discord.js';
import { db } from '../../../db/index.js';
import { loadAuthorizedSession, renderPanel } from './editShared.js';

function buildCareerSelectComponents(sessionId: string, careers: Array<{ id: string; value: string }>, currentCareerId: string | null): unknown[] {
    const options = [
        { label: '— None —', value: '__none__', default: currentCareerId === null },
        ...careers.map(c => ({ label: c.value, value: c.id, default: c.id === currentCareerId })),
    ];

    return [{
        type:       17,
        components: [
            { type: 10, content: 'Select a Career:' },
            { type: 1, components: [{
                type:        3,
                custom_id:   `character_editpanel_career_select:${sessionId}`,
                placeholder: 'Select a career',
                options,
            }] },
            { type: 1, components: [{ type: 2, style: 2, label: 'Back', custom_id: `character_editpanel_back:${sessionId}` }] },
        ],
    }];
}

// customId: character_editpanel_career:<sessionId>
export async function handleEditPanelCareerButton(interaction: ButtonInteraction): Promise<void> {
    const sessionId = interaction.customId.slice('character_editpanel_career:'.length);

    const session = await loadAuthorizedSession(interaction, sessionId);
    if (!session) return;

    const careers = await db.career.findMany({ orderBy: { value: 'asc' } });

    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: buildCareerSelectComponents(sessionId, careers, session.draft.career?.id ?? null),
    } as never);
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
