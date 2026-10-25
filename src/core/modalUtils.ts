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
    // Parsed fields cover every component type (text input, select, radio group, ...)
    try {
        const field = interaction.fields.getField(customId) as { value?: unknown; values?: unknown[] };
        if (field.value !== undefined && field.value !== null) return String(field.value);
        if (Array.isArray(field.values) && field.values.length > 0) return String(field.values[0]);
    } catch { /* field not present */ }
    return '';
}
