import { AttachmentBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import ExcelJS from 'exceljs';
import { colors } from '../../../core/colors.js';
import { replyError } from '../../../core/reply.js';
import { db } from '../../../db/index.js';

const FORMAT_VERSION = 1;

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const codeName = interaction.options.getString('code_name', true);
    const guildId  = interaction.guildId!;
    const userId   = interaction.user.id;

    const group = await db.group.findUnique({
        where:   { codeName },
        include: {
            roles: {
                orderBy: { position: 'asc' },
                include: { progressionsTo: { include: { toRole: { select: { name: true } } } } },
            },
            members: {
                orderBy: [{ groupRole: { position: 'asc' } }, { character: { name: 'asc' } }],
                include: { groupRole: { select: { name: true } }, character: { select: { userId: true, name: true, bio: true } } },
            },
        },
    });

    if (!group || group.guildId !== guildId) {
        await replyError(interaction, `No group with code name \`${codeName}\` exists in this server.`);
        return;
    }

    let permitted = group.ownerId === userId;
    if (!permitted) {
        const manageGroup = await db.groupRoleMember.findFirst({
            where: { groupId: group.id, userId, groupRole: { canManageGroup: true } },
        });
        if (manageGroup) permitted = true;
    }

    if (!permitted) {
        await replyError(interaction, 'Only the group owner or a member who can manage the group can export it.');
        return;
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'KARC';
    workbook.created = new Date();

    // ── Group ────────────────────────────────────────────────────────────────
    const groupSheet = workbook.addWorksheet('Group');
    groupSheet.columns = [
        { header: 'field', key: 'field', width: 16 },
        { header: 'value', key: 'value', width: 50 },
    ];
    groupSheet.addRows([
        { field: 'formatVersion', value: FORMAT_VERSION },
        { field: 'name',          value: group.name },
        { field: 'codeName',      value: group.codeName },
        { field: 'ownerId',       value: group.ownerId },
        { field: 'guildId',       value: group.guildId },
        { field: 'createdAt',     value: group.createdAt.toISOString() },
        { field: 'exportedAt',    value: new Date().toISOString() },
    ]);

    // ── Roles ────────────────────────────────────────────────────────────────
    const rolesSheet = workbook.addWorksheet('Roles');
    rolesSheet.columns = [
        { header: 'name',                 key: 'name',                 width: 24 },
        { header: 'subName',              key: 'subName',              width: 24 },
        { header: 'position',             key: 'position',             width: 10 },
        { header: 'color',                key: 'color',                width: 10 },
        { header: 'discordRoleId',        key: 'discordRoleId',        width: 22 },
        { header: 'canManageGroup',       key: 'canManageGroup',       width: 16 },
        { header: 'canManageAssignments', key: 'canManageAssignments', width: 20 },
    ];
    for (const role of group.roles) {
        rolesSheet.addRow({
            name:                 role.name,
            subName:              role.subName ?? '',
            position:             role.position,
            color:                role.color ?? '',
            discordRoleId:        role.discordRoleId ?? '',
            canManageGroup:       role.canManageGroup,
            canManageAssignments: role.canManageAssignments,
        });
    }

    // ── Progressions (which roles can promote into which) ───────────────────
    const progressionsSheet = workbook.addWorksheet('Progressions');
    progressionsSheet.columns = [
        { header: 'fromRole', key: 'fromRole', width: 24 },
        { header: 'toRole',   key: 'toRole',   width: 24 },
    ];
    for (const role of group.roles) {
        for (const p of role.progressionsTo) {
            progressionsSheet.addRow({ fromRole: role.name, toRole: p.toRole.name });
        }
    }

    // ── Characters (the characters linked to this group, with their bios) ───
    const charactersSheet = workbook.addWorksheet('Characters');
    charactersSheet.columns = [
        { header: 'userId', key: 'userId', width: 22 },
        { header: 'name',   key: 'name',   width: 28 },
        { header: 'bio',    key: 'bio',    width: 60 },
    ];
    for (const member of group.members) {
        charactersSheet.addRow({
            userId: member.character.userId,
            name:   member.character.name,
            bio:    member.character.bio ?? '',
        });
    }

    // ── Members ──────────────────────────────────────────────────────────────
    const membersSheet = workbook.addWorksheet('Members');
    membersSheet.columns = [
        { header: 'userId',        key: 'userId',        width: 22 },
        { header: 'characterName', key: 'characterName', width: 28 },
        { header: 'role',          key: 'role',          width: 24 },
        { header: 'assignedAt',    key: 'assignedAt',    width: 24 },
    ];
    for (const member of group.members) {
        membersSheet.addRow({
            userId:        member.userId,
            characterName: member.character.name,
            role:          member.groupRole.name,
            assignedAt:    member.assignedAt.toISOString(),
        });
    }

    for (const sheet of [groupSheet, rolesSheet, progressionsSheet, charactersSheet, membersSheet]) {
        sheet.getRow(1).font = { bold: true };
    }

    const buffer        = await workbook.xlsx.writeBuffer();
    const safeCodeName  = group.codeName.replace(/[^a-z0-9_-]/gi, '_');
    const attachment    = new AttachmentBuilder(Buffer.from(buffer), { name: `${safeCodeName}.xlsx` });

    await interaction.editReply({
        flags:      MessageFlags.IsComponentsV2,
        files:      [attachment],
        components: [{
            type:         17,
            accent_color: colors.success,
            components:   [{
                type:    10,
                content: `Exported **${group.name}** (\`${group.codeName}\`) — ${group.roles.length} role(s), ${group.roles.reduce((n, r) => n + r.progressionsTo.length, 0)} progression(s), ${group.members.length} member(s).`,
            }],
        }],
    } as never);
}
