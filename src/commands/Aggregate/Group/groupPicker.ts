export type PickAction = 'viewroles' | 'viewmembers';

const GROUPS_PER_PAGE = 10;

export type PickableGroup = { id: string; codeName: string; name: string };

export function buildGroupPickerComponents(groups: PickableGroup[], page: number, action: PickAction): unknown[] {
    const totalPages = Math.max(1, Math.ceil(groups.length / GROUPS_PER_PAGE));
    const safePage    = Math.min(Math.max(page, 0), totalPages - 1);
    const pageGroups  = groups.slice(safePage * GROUPS_PER_PAGE, (safePage + 1) * GROUPS_PER_PAGE);

    const inner: unknown[] = [
        { type: 10, content: 'Select a group to view:' },
        { type: 14, divider: true },
        ...pageGroups.map(g => ({
            type:       9,
            components: [{ type: 10, content: `**${g.name}**\n-# ${g.codeName}` }],
            accessory:  { type: 2, style: 1, label: 'View', custom_id: `group_pick_view:${action}:${g.id}` },
        })),
    ];

    if (totalPages > 1) {
        inner.push({ type: 14, divider: true });
        inner.push({
            type:       1,
            components: [
                { type: 2, style: 2, label: '◀', custom_id: `group_pick_page:${action}:${safePage - 1}`, disabled: safePage === 0 },
                { type: 2, style: 2, label: `${safePage + 1} / ${totalPages}`, custom_id: 'group_pick_noop', disabled: true },
                { type: 2, style: 2, label: '▶', custom_id: `group_pick_page:${action}:${safePage + 1}`, disabled: safePage === totalPages - 1 },
            ],
        });
    }

    return [{ type: 17, components: inner }];
}
