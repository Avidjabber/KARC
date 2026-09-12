import { PermissionFlagsBits } from 'discord.js';

/** True if the interacting member has the server-wide Administrator permission. */
export function isServerAdmin(interaction: { memberPermissions: Readonly<import('discord.js').PermissionsBitField> | null }): boolean {
    return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
}
