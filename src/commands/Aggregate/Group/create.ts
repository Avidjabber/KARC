import { ChatInputCommandInteraction } from 'discord.js';

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.showModal({
        title:      'Create Group',
        custom_id:  'group_create_modal',
        components: [
            {
                type:      18,
                label:     'Display Name',
                component: { type: 4, custom_id: 'name', style: 1, max_length: 200, required: true, placeholder: 'Group Display Name' },
            },
            {
                type:        18,
                label:       'Code Name',
                description: 'Lowercase letters, numbers, and underscores only — must be globally unique',
                component:   { type: 4, custom_id: 'code_name', style: 1, max_length: 200, required: true, placeholder: 'group_code_name' },
            },
        ],
    } as never);
}
