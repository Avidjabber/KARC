import { ButtonInteraction, MessageFlags, ModalSubmitInteraction, StringSelectMenuInteraction } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { validateDisplayName, validateBio, FILTER_MESSAGES } from '../../../core/contentFilter.js';
import { extractField } from '../../../core/modalUtils.js';
import { db } from '../../../db/index.js';
import { syncCharacterLookupTags } from './lookupTagSync.js';
import { buildEditNameModal, buildEditBioModal } from './editPanel.js';
import { clearSession, loadAuthorizedCharacter, loadAuthorizedSession, renderPanel, startEditSession } from './editShared.js';

function buildErrorWithBack(content: string, sessionId: string): unknown[] {
    return [{
        type:       17,
        accent_color: colors.error,
        components: [
            { type: 10, content },
            { type: 1, components: [{ type: 2, style: 2, label: 'Back', custom_id: `character_editpanel_back:${sessionId}` }] },
        ],
    }];
}

// customId: character_edit_select  (characterId from values[0]) — picking which of several existing characters to edit
export async function handleCharacterEditSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    const characterId = interaction.values[0];

    const character = await loadAuthorizedCharacter(interaction, characterId);
    if (!character) return;

    const { sessionId } = startEditSession(character);
    await renderPanel(interaction, sessionId);
}

// customId: character_editpanel_name:<sessionId>
export async function handleEditPanelNameButton(interaction: ButtonInteraction): Promise<void> {
    const sessionId = interaction.customId.slice('character_editpanel_name:'.length);

    const session = await loadAuthorizedSession(interaction, sessionId);
    if (!session) return;

    await interaction.showModal(buildEditNameModal({ sessionId, name: session.draft.name }) as never);
}

// customId: character_editpanel_bio:<sessionId>
export async function handleEditPanelBioButton(interaction: ButtonInteraction): Promise<void> {
    const sessionId = interaction.customId.slice('character_editpanel_bio:'.length);

    const session = await loadAuthorizedSession(interaction, sessionId);
    if (!session) return;

    await interaction.showModal(buildEditBioModal({ sessionId, bio: session.draft.bio }) as never);
}

// customId: character_editpanel_back:<sessionId>
export async function handleEditPanelBack(interaction: ButtonInteraction): Promise<void> {
    const sessionId = interaction.customId.slice('character_editpanel_back:'.length);
    await renderPanel(interaction, sessionId);
}

// customId: character_editpanel_done:<sessionId>
export async function handleEditPanelDone(interaction: ButtonInteraction): Promise<void> {
    const sessionId = interaction.customId.slice('character_editpanel_done:'.length);

    const session = await loadAuthorizedSession(interaction, sessionId);
    if (!session) return;

    if (!session.draft.name.trim()) {
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: buildErrorWithBack('You must set a **Name** before saving.', sessionId),
        } as never);
        return;
    }

    try {
        if (session.mode === 'create') {
            await db.character.create({
                data: {
                    guildId:     session.guildId,
                    userId:      session.userId,
                    name:        session.draft.name,
                    bio:         session.draft.bio,
                    careerId:    session.draft.career?.id ?? null,
                    residenceId: session.draft.residence?.id ?? null,
                },
            });
        } else {
            await db.character.update({
                where: { id: session.characterId! },
                data: {
                    name:        session.draft.name,
                    bio:         session.draft.bio,
                    careerId:    session.draft.career?.id ?? null,
                    residenceId: session.draft.residence?.id ?? null,
                },
            });
        }
    } catch (err) {
        const isDuplicate = (err as { code?: string }).code === 'P2002';
        const content = isDuplicate
            ? `You already have a character named **${session.draft.name}** in this server.`
            : `Something went wrong ${session.mode === 'create' ? 'creating' : 'saving'} your character. Please try again.`;
        if (!isDuplicate) console.error('[handleEditPanelDone]', err);

        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: buildErrorWithBack(content, sessionId),
        } as never);
        return;
    }

    // Best-effort — the character record is already saved either way.
    try {
        await syncCharacterLookupTags(
            interaction.guild!, session.guildId, session.userId,
            session.original,
            { career: session.draft.career, residence: session.draft.residence },
        );
    } catch (err) {
        console.error('[handleEditPanelDone] lookup tag sync failed:', err);
    }

    clearSession(sessionId);

    const verb = session.mode === 'create' ? 'created' : 'updated';
    await interaction.update({
        flags:      MessageFlags.IsComponentsV2,
        components: [{
            type:         17,
            accent_color: colors.success,
            components:   [{ type: 10, content: `**${session.draft.name}** has been ${verb}.` }],
        }],
    } as never);
}

// customId: character_editpanel_name_modal:<sessionId>
export async function handleEditNameModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.isFromMessage()) return;
    const [, sessionId] = interaction.customId.split(':');

    const rawName    = extractField(interaction, 'name');
    const nameResult = validateDisplayName(rawName);

    if (!nameResult.valid) {
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: buildErrorWithBack(`**Name** ${FILTER_MESSAGES[nameResult.reason]}`, sessionId),
        } as never);
        return;
    }

    const session = await loadAuthorizedSession(interaction, sessionId);
    if (!session) return;

    // Early duplicate check against other real characters (final authority is still the unique constraint at save time)
    const duplicate = await db.character.findFirst({
        where: {
            guildId: session.guildId,
            userId:  session.userId,
            name:    nameResult.value,
            ...(session.characterId ? { NOT: { id: session.characterId } } : {}),
        },
    });
    if (duplicate) {
        const content = session.userId === interaction.user.id
            ? `You already have a character named **${nameResult.value}** in this server.`
            : `<@${session.userId}> already has a character named **${nameResult.value}** in this server.`;
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: buildErrorWithBack(content, sessionId),
        } as never);
        return;
    }

    session.draft.name = nameResult.value;
    await renderPanel(interaction, sessionId);
}

// customId: character_editpanel_bio_modal:<sessionId>
export async function handleEditBioModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.isFromMessage()) return;
    const [, sessionId] = interaction.customId.split(':');

    const rawBio    = extractField(interaction, 'bio');
    const bioResult = validateBio(rawBio);

    if (!bioResult.valid) {
        await interaction.update({
            flags:      MessageFlags.IsComponentsV2,
            components: buildErrorWithBack(`**Bio** ${FILTER_MESSAGES[bioResult.reason]}`, sessionId),
        } as never);
        return;
    }

    const session = await loadAuthorizedSession(interaction, sessionId);
    if (!session) return;

    session.draft.bio = bioResult.value || null;
    await renderPanel(interaction, sessionId);
}
