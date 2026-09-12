import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { colors } from '../../../core/colors.js';
import { db } from '../../../db/index.js';

export async function createProgression(
    interaction: { editReply?: Function; update?: Function },
    fromRoleId:  string,
    toRoleId:    string,
    fromName:    string,
    toName:      string,
    groupName:   string,
    useUpdate:   boolean,
): Promise<void> {
    const send = useUpdate
        ? (p: unknown) => (interaction as any).update(p)
        : (p: unknown) => (interaction as any).editReply(p);

    try {
        await db.groupRoleProgression.create({ data: { fromRoleId, toRoleId } });
    } catch (err) {
        const isDuplicate = (err as { code?: string }).code === 'P2002';
        const content = isDuplicate
            ? `A progression **${fromName}** → **${toName}** already exists in **${groupName}**.`
            : 'Something went wrong saving the progression. Please try again.';
        if (!isDuplicate) console.error('[setProgression] DB error:', err);
        await send({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content }] }],
        });
        return;
    }

    await send({
        flags:      MessageFlags.IsComponentsV2,
        components: [{
            type:         17,
            accent_color: colors.success,
            components:   [{ type: 10, content: `Progression set: **${fromName}** → **${toName}** in **${groupName}**.` }],
        }],
    });
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const fromDiscordRole = interaction.options.getRole('from', true);
    const toDiscordRole   = interaction.options.getRole('to',   true);
    const guildId         = interaction.guildId!;
    const userId          = interaction.user.id;

    if (fromDiscordRole.id === toDiscordRole.id) {
        await interaction.editReply({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: 'A role cannot lead to itself.' }] }],
        } as never);
        return;
    }

    const fromName = fromDiscordRole.name;
    const toName   = toDiscordRole.name;

    const groups = await db.group.findMany({
        where: {
            guildId,
            AND: [
                { roles: { some: { name: { equals: fromName, mode: 'insensitive' } } } },
                { roles: { some: { name: { equals: toName,   mode: 'insensitive' } } } },
            ],
            OR: [
                { ownerId: userId },
                { members: { some: { userId, groupRole: { canManageGroup: true } } } },
            ],
        },
        include: { roles: true },
        orderBy: { name: 'asc' },
    });

    const pairs = groups.flatMap(g => {
        const fromRole = g.roles.find(r => r.name.toLowerCase() === fromName.toLowerCase());
        const toRole   = g.roles.find(r => r.name.toLowerCase() === toName.toLowerCase());
        return fromRole && toRole ? [{ group: g, fromRole, toRole }] : [];
    });

    if (pairs.length === 0) {
        await interaction.editReply({
            flags:      MessageFlags.IsComponentsV2,
            components: [{ type: 17, accent_color: colors.error, components: [{ type: 10, content: `No group you manage has both **${fromName}** and **${toName}** as roles.` }] }],
        } as never);
        return;
    }

    if (pairs.length === 1) {
        const { fromRole, toRole, group } = pairs[0];
        await createProgression(interaction, fromRole.id, toRole.id, fromRole.name, toRole.name, group.name, false);
        return;
    }

    // Multiple groups: show group picker; encode both role IDs in the value
    const options = pairs.map(p => ({
        label:       p.group.name,
        value:       `${p.fromRole.id}:${p.toRole.id}`,
        description: p.group.codeName,
    }));

    await interaction.editReply({
        flags:      MessageFlags.IsComponentsV2,
        components: [{
            type:       17,
            components: [
                { type: 10, content: `Both **${fromName}** and **${toName}** exist in multiple groups you manage. Choose one:` },
                { type: 1,  components: [{
                    type:        3,
                    custom_id:   'roles_setprog_group_select',
                    placeholder: 'Select a group',
                    options,
                }]},
            ],
        }],
    } as never);
}
