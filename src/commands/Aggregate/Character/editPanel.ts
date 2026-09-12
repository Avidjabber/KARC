export type PanelDraft = {
    sessionId: string;
    name:      string;
    bio:       string | null;
    career:    { value: string } | null;
    residence: { value: string } | null;
};

export function buildEditPanelComponents(panel: PanelDraft): unknown[] {
    const nameText      = panel.name ? panel.name : '*(not set)*';
    const bioText       = panel.bio ? panel.bio : '*(none set)*';
    const careerText    = panel.career ? panel.career.value : '*(none set)*';
    const residenceText = panel.residence ? panel.residence.value : '*(none set)*';

    return [{
        type:       17,
        components: [
            { type: 10, content: panel.name ? `## Editing ${panel.name}` : '## New Character' },
            { type: 14, divider: true },
            { type: 9, components: [{ type: 10, content: `**Name**\n${nameText}` }], accessory: { type: 2, style: 2, label: 'Edit', custom_id: `character_editpanel_name:${panel.sessionId}` } },
            { type: 9, components: [{ type: 10, content: `**Bio**\n${bioText}` }], accessory: { type: 2, style: 2, label: 'Edit', custom_id: `character_editpanel_bio:${panel.sessionId}` } },
            { type: 9, components: [{ type: 10, content: `**Career**\n${careerText}` }], accessory: { type: 2, style: 2, label: 'Edit', custom_id: `character_editpanel_career:${panel.sessionId}` } },
            { type: 9, components: [{ type: 10, content: `**Residence**\n${residenceText}` }], accessory: { type: 2, style: 2, label: 'Edit', custom_id: `character_editpanel_residence:${panel.sessionId}` } },
            { type: 14, divider: true },
            { type: 1, components: [{ type: 2, style: 3, label: 'Done', custom_id: `character_editpanel_done:${panel.sessionId}` }] },
        ],
    }];
}

export function buildEditNameModal(panel: { sessionId: string; name: string }): object {
    return {
        title:      'Edit Name',
        custom_id:  `character_editpanel_name_modal:${panel.sessionId}`,
        components: [{
            type:      18,
            label:     'Name',
            component: { type: 4, custom_id: 'name', style: 1, max_length: 200, required: true, placeholder: "Ko'har", value: panel.name },
        }],
    };
}

export function buildEditBioModal(panel: { sessionId: string; bio: string | null }): object {
    return {
        title:      'Edit Bio',
        custom_id:  `character_editpanel_bio_modal:${panel.sessionId}`,
        components: [{
            type:        18,
            label:       'Bio',
            description: 'Optional — a small bio or other details',
            component:   { type: 4, custom_id: 'bio', style: 2, max_length: 1000, required: false, placeholder: 'A short description of your character...', value: panel.bio ?? '' },
        }],
    };
}
