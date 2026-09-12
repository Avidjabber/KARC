import { ChatInputCommandInteraction } from 'discord.js';

export function buildCreateCharacterModal(customId: string): object {
    return {
        title:      'Create Character',
        custom_id:  customId,
        components: [
            {
                type:      18,
                label:     'Name',
                component: { type: 4, custom_id: 'name', style: 1, max_length: 200, required: true, placeholder: "Ko'har" },
            },
            {
                type:        18,
                label:       'Bio',
                description: 'Optional — a small bio or other details',
                component:   { type: 4, custom_id: 'bio', style: 2, max_length: 1000, required: false, placeholder: 'A short description of your character...' },
            },
        ],
    };
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.showModal(buildCreateCharacterModal('character_create_modal') as never);
}
