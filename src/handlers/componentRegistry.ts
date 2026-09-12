import { ButtonInteraction, MessageComponentInteraction, ModalSubmitInteraction, StringSelectMenuInteraction } from 'discord.js';
import { handleGroupCreateModal } from '../commands/Aggregate/Group/createHandlers.js';
import { handleGroupTransferAccept, handleGroupTransferReject } from '../commands/Aggregate/Group/transferOwnershipHandlers.js';
import { handleGroupInfoPage, handleGroupInfoStats, handleGroupInfoDone } from '../commands/Aggregate/Group/infoHandlers.js';
import { handleRoleCreateModal } from '../commands/Aggregate/Roles/createModalHandlers.js';
import { handleRoleEditModal } from '../commands/Aggregate/Roles/editModalHandlers.js';
import { handleSetProgressionGroupSelect } from '../commands/Aggregate/Roles/setProgressionGroupSelectHandlers.js';
import { handleAssignCharSelect } from '../commands/Aggregate/Roles/assignCharSelectHandlers.js';
import { handleCreateGroupSelect }  from '../commands/Aggregate/Roles/createGroupSelectHandlers.js';
import { handleCreateSetManageGroup, handleCreateSetManageAssignments, handleCreateNext } from '../commands/Aggregate/Roles/createTogglesHandlers.js';
import { handleDeleteGroupSelect }  from '../commands/Aggregate/Roles/deleteGroupSelectHandlers.js';
import { handleRoleDeleteModal }    from '../commands/Aggregate/Roles/deleteModalHandlers.js';
import { handleEditGroupSelect }    from '../commands/Aggregate/Roles/editGroupSelectHandlers.js';
import { handleEditSetManageGroup, handleEditSetManageAssignments, handleEditNext } from '../commands/Aggregate/Roles/editTogglesHandlers.js';
import { handlePromoteCharSelect }  from '../commands/Aggregate/Roles/promoteCharSelectHandlers.js';
import { handlePromoteGroupSelect } from '../commands/Aggregate/Roles/promoteGroupSelectHandlers.js';
import { handlePromoteRoleSelect }  from '../commands/Aggregate/Roles/promoteSelectHandlers.js';
import { handleDemoteCharSelect }  from '../commands/Aggregate/Roles/demoteCharSelectHandlers.js';
import { handleDemoteGroupSelect } from '../commands/Aggregate/Roles/demoteGroupSelectHandlers.js';
import { handleDemoteRoleSelect }  from '../commands/Aggregate/Roles/demoteConfirmHandlers.js';
import { handleViewRolesUpdate } from '../commands/Aggregate/Group/roleUpdateHandlers.js';
import { handleViewMembersUpdate, handleViewMembersPage } from '../commands/Aggregate/Group/viewMembersUpdateHandlers.js';
import { handleGroupPickPage, handleGroupPickView } from '../commands/Aggregate/Group/groupPickHandlers.js';
import { handleRemoveCharSelect } from '../commands/Aggregate/Roles/removeCharSelectHandlers.js';
import { handleRemoveConfirm, handleRemoveCancel } from '../commands/Aggregate/Roles/removeConfirmHandlers.js';
import { handleGroupDeleteGroupSelect } from '../commands/Aggregate/Group/deleteGroupSelectHandlers.js';
import { handleGroupDeleteConfirm, handleGroupDeleteCancel } from '../commands/Aggregate/Group/deleteConfirmHandlers.js';
import { handleCharacterCreateModal } from '../commands/Aggregate/Character/createHandlers.js';
import { handleCharacterEditSelect, handleCharacterEditModal } from '../commands/Aggregate/Character/editHandlers.js';
import { handleCharacterDeleteSelect, handleCharacterDeleteConfirm, handleCharacterDeleteCancel } from '../commands/Aggregate/Character/deleteHandlers.js';

type AnyComponentInteraction =
    | MessageComponentInteraction
    | StringSelectMenuInteraction
    | ModalSubmitInteraction;

export interface ComponentHandler {
    prefix: string;
    handler: (interaction: AnyComponentInteraction) => Promise<void> | void;
}

// ── Modal handlers ─────────────────────────────────────────────────────────────
export const modalHandlers: ComponentHandler[] = [
    { prefix: 'group_create_modal', handler: i => handleGroupCreateModal(i as ModalSubmitInteraction) },
    { prefix: 'roles_create_modal', handler: i => handleRoleCreateModal(i as ModalSubmitInteraction) },
    { prefix: 'roles_delete_modal:', handler: i => handleRoleDeleteModal(i as ModalSubmitInteraction) },
    { prefix: 'roles_edit_modal',             handler: i => handleRoleEditModal(i as ModalSubmitInteraction) },
    { prefix: 'character_create_modal',       handler: i => handleCharacterCreateModal(i as ModalSubmitInteraction) },
    { prefix: 'character_edit_modal:',        handler: i => handleCharacterEditModal(i as ModalSubmitInteraction) },
];

// ── Select menu handlers ───────────────────────────────────────────────────────
export const selectMenuHandlers: ComponentHandler[] = [
    { prefix: 'roles_create_group_select', handler: i => handleCreateGroupSelect(i as StringSelectMenuInteraction) },
    { prefix: 'roles_create_setmg:', handler: i => handleCreateSetManageGroup(i as StringSelectMenuInteraction) },
    { prefix: 'roles_create_setma:', handler: i => handleCreateSetManageAssignments(i as StringSelectMenuInteraction) },
    { prefix: 'roles_delete_group_select', handler: i => handleDeleteGroupSelect(i as StringSelectMenuInteraction) },
    { prefix: 'roles_edit_group_select',   handler: i => handleEditGroupSelect(i as StringSelectMenuInteraction) },
    { prefix: 'roles_edit_setmg:', handler: i => handleEditSetManageGroup(i as StringSelectMenuInteraction) },
    { prefix: 'roles_edit_setma:', handler: i => handleEditSetManageAssignments(i as StringSelectMenuInteraction) },
    { prefix: 'roles_promote_char:',       handler: i => handlePromoteCharSelect(i as StringSelectMenuInteraction) },
    { prefix: 'roles_promote_group',  handler: i => handlePromoteGroupSelect(i as StringSelectMenuInteraction) },
    { prefix: 'roles_promote_role:',  handler: i => handlePromoteRoleSelect(i as StringSelectMenuInteraction) },
    { prefix: 'roles_demote_char:',   handler: i => handleDemoteCharSelect(i as StringSelectMenuInteraction) },
    { prefix: 'roles_demote_group',   handler: i => handleDemoteGroupSelect(i as StringSelectMenuInteraction) },
    { prefix: 'roles_demote_role:',          handler: i => handleDemoteRoleSelect(i as StringSelectMenuInteraction) },
    { prefix: 'roles_remove_char_select',   handler: i => handleRemoveCharSelect(i as StringSelectMenuInteraction) },
    { prefix: 'roles_setprog_group_select', handler: i => handleSetProgressionGroupSelect(i as StringSelectMenuInteraction) },
    { prefix: 'group_delete_group_select', handler: i => handleGroupDeleteGroupSelect(i as StringSelectMenuInteraction) },
    { prefix: 'roles_assign_char_select:', handler: i => handleAssignCharSelect(i as StringSelectMenuInteraction) },
    { prefix: 'character_edit_select', handler: i => handleCharacterEditSelect(i as StringSelectMenuInteraction) },
    { prefix: 'character_delete_select', handler: i => handleCharacterDeleteSelect(i as StringSelectMenuInteraction) },
];

// ── Button handlers ────────────────────────────────────────────────────────────
export const buttonHandlers: ComponentHandler[] = [
    { prefix: 'group_transfer_accept:', handler: i => handleGroupTransferAccept(i as ButtonInteraction) },
    { prefix: 'group_transfer_reject:', handler: i => handleGroupTransferReject(i as ButtonInteraction) },
    { prefix: 'group_info_page:',       handler: i => handleGroupInfoPage(i as ButtonInteraction) },
    { prefix: 'group_info_stats:',      handler: i => handleGroupInfoStats(i as ButtonInteraction) },
    { prefix: 'group_info_done:',        handler: i => handleGroupInfoDone(i as ButtonInteraction) },
    { prefix: 'group_viewroles_update:', handler: i => handleViewRolesUpdate(i as ButtonInteraction) },
    { prefix: 'group_viewmembers_update:', handler: i => handleViewMembersUpdate(i as ButtonInteraction) },
    { prefix: 'group_viewmembers_page:',   handler: i => handleViewMembersPage(i as ButtonInteraction) },
    { prefix: 'roles_remove_confirm:',   handler: i => handleRemoveConfirm(i as ButtonInteraction) },
    { prefix: 'roles_remove_cancel',    handler: i => handleRemoveCancel(i as ButtonInteraction) },
    { prefix: 'group_pick_page:', handler: i => handleGroupPickPage(i as ButtonInteraction) },
    { prefix: 'group_pick_view:', handler: i => handleGroupPickView(i as ButtonInteraction) },
    { prefix: 'roles_create_next:', handler: i => handleCreateNext(i as ButtonInteraction) },
    { prefix: 'roles_edit_next:', handler: i => handleEditNext(i as ButtonInteraction) },
    { prefix: 'group_delete_confirm:', handler: i => handleGroupDeleteConfirm(i as ButtonInteraction) },
    { prefix: 'group_delete_cancel',   handler: i => handleGroupDeleteCancel(i as ButtonInteraction) },
    { prefix: 'character_delete_confirm:', handler: i => handleCharacterDeleteConfirm(i as ButtonInteraction) },
    { prefix: 'character_delete_cancel',   handler: i => handleCharacterDeleteCancel(i as ButtonInteraction) },
];
