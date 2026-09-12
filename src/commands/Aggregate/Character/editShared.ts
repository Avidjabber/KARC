import { randomUUID } from 'node:crypto';
import { ButtonInteraction, MessageFlags, ModalMessageModalSubmitInteraction, StringSelectMenuInteraction } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { isServerAdmin } from '../../../core/permissions.js';
import { db } from '../../../db/index.js';
import { buildEditPanelComponents } from './editPanel.js';

export type PanelInteraction = ButtonInteraction | StringSelectMenuInteraction | ModalMessageModalSubmitInteraction;

export type CharacterWithLookups = {
    id:      string;
    guildId: string;
    userId:  string;
    name:    string;
    bio:     string | null;
    career:    { id: string; value: string } | null;
    residence: { id: string; value: string } | null;
};

export type CharacterDraft = {
    name:      string;
    bio:       string | null;
    career:    { id: string; value: string } | null;
    residence: { id: string; value: string } | null;
};

export type EditSession = {
    mode:        'create' | 'edit';
    guildId:     string;
    userId:      string;
    characterId: string | null; // null while creating; the real row's id once one exists
    draft:       CharacterDraft;
};

// sessionId → in-progress session (create or edit). In-memory only; lost on bot restart, which just
// discards unsaved work — nothing is written to the DB until "Done".
const sessions = new Map<string, EditSession>();

export function createNewSession(guildId: string, userId: string): { sessionId: string; session: EditSession } {
    const sessionId = randomUUID();
    const session: EditSession = {
        mode:        'create',
        guildId,
        userId,
        characterId: null,
        draft:       { name: '', bio: null, career: null, residence: null },
    };
    sessions.set(sessionId, session);
    return { sessionId, session };
}

export function startEditSession(character: CharacterWithLookups): { sessionId: string; session: EditSession } {
    const sessionId = character.id;
    const session: EditSession = {
        mode:        'edit',
        guildId:     character.guildId,
        userId:      character.userId,
        characterId: character.id,
        draft: {
            name:      character.name,
            bio:       character.bio,
            career:    character.career,
            residence: character.residence,
        },
    };
    sessions.set(sessionId, session);
    return { sessionId, session };
}

export function clearSession(sessionId: string): void {
    sessions.delete(sessionId);
}

/** Fetches an existing character and verifies the caller may edit it (owner, or a server Administrator). Used only to seed an edit session. */
export async function loadAuthorizedCharacter(interaction: PanelInteraction, characterId: string): Promise<CharacterWithLookups | null> {
    const character = await db.character.findUnique({
        where:   { id: characterId },
        include: {
            career:    { select: { id: true, value: true } },
            residence: { select: { id: true, value: true } },
        },
    });

    if (!character || character.guildId !== interaction.guildId) {
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'That character no longer exists.' }] }],
        } as never);
        return null;
    }

    if (character.userId !== interaction.user.id && !isServerAdmin(interaction)) {
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'Only an Administrator can edit another member\'s characters.' }] }],
        } as never);
        return null;
    }

    return character;
}

/** Verifies the caller may act on this in-progress session (its owner, or a server Administrator). Replies with an error and returns null on failure. */
export async function loadAuthorizedSession(interaction: PanelInteraction, sessionId: string): Promise<EditSession | null> {
    const session = sessions.get(sessionId);

    if (!session || session.guildId !== interaction.guildId) {
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'This session has expired.' }] }],
        } as never);
        return null;
    }

    if (session.userId !== interaction.user.id && !isServerAdmin(interaction)) {
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'Only an Administrator can edit another member\'s characters.' }] }],
        } as never);
        return null;
    }

    return session;
}

/** Redraws the main edit panel from the session's current draft. */
export async function renderPanel(interaction: PanelInteraction, sessionId: string): Promise<void> {
    const session = await loadAuthorizedSession(interaction, sessionId);
    if (!session) return;

    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: buildEditPanelComponents({ sessionId, ...session.draft }),
    } as never);
}
