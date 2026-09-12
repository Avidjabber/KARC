import { ModalSubmitInteraction } from 'discord.js';

export function extractField(interaction: ModalSubmitInteraction, customId: string): string {
    const rawComponents: unknown[] = (interaction as { data?: { components?: unknown[] } }).data?.components ?? [];

    function search(comps: unknown[]): string | undefined {
        for (const comp of comps as Record<string, unknown>[]) {
            if (comp['custom_id'] === customId) {
                if (comp['value'] !== undefined) return String(comp['value']);
                if (Array.isArray(comp['values']) && comp['values'].length > 0) return String(comp['values'][0]);
            }
            if (Array.isArray(comp['components'])) {
                const v = search(comp['components'] as unknown[]);
                if (v !== undefined) return v;
            }
            const inner = comp['component'] as Record<string, unknown> | undefined;
            if (inner?.['custom_id'] === customId) {
                if (inner['value'] !== undefined) return String(inner['value']);
                if (Array.isArray(inner['values']) && inner['values'].length > 0) return String(inner['values'][0]);
            }
        }
    }

    const raw = search(rawComponents);
    if (raw !== undefined) return raw;
    try { return interaction.fields.getTextInputValue(customId); } catch { return ''; }
}
