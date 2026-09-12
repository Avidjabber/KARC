import { createCanvas, type SKRSContext2D } from '@napi-rs/canvas';

// ── Seeded PRNG (xorshift32) ──────────────────────────────────────────────────
function seededRng(seed: string): () => number {
    let h = 5381;
    for (let i = 0; i < seed.length; i++) {
        h = (((h << 5) + h) ^ seed.charCodeAt(i)) >>> 0;
    }
    if (h === 0) h = 1;
    return () => {
        h ^= h << 13;  h >>>= 0;
        h ^= h >> 17;  h >>>= 0;
        h ^= h << 5;   h >>>= 0;
        return h / 0xffffffff;
    };
}

export type GraphRole = {
    id:              string;
    name:            string;
    position:        number;
    subName:         string | null;
    color:           string | null;
    progressionsFrom: Array<{ toRoleId: string }>;
    members:         Array<{ character: { name: string } }>;
};

// ── Theme ─────────────────────────────────────────────────────────────────────

const BG              = '#313338';
const NODE_BG         = '#1e1f22';
const TEXT            = '#FFFFFF';
const FALLBACK_RGB: [number, number, number] = [114, 137, 218];

function hexToRgb(hex: string | null): [number, number, number] {
    if (!hex) return FALLBACK_RGB;
    const c = hex.replace('#', '');
    if (c.length !== 6) return FALLBACK_RGB;
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    return (isNaN(r) || isNaN(g) || isNaN(b)) ? FALLBACK_RGB : [r, g, b];
}

function roleColor(hex: string | null): string {
    const [r, g, b] = hexToRgb(hex);
    return `rgb(${r},${g},${b})`;
}
function roleColorA(hex: string | null, alpha: number): string {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${alpha})`;
}

// ── Layout constants ──────────────────────────────────────────────────────────

const NODE_W         = 170;
const BASE_NODE_H    = 60;   // height when no members
const NODE_R         = 10;
const GAP_X          = 22;   // horizontal gap between nodes in the same level
const LEVEL_GAP_Y    = 50;   // vertical gap between bottom of one level and top of next
const PAD_X          = 55;
const PAD_TOP        = 58;   // room for the title
const PAD_BOT        = 36;

// Fixed Y offsets (from node top) for text lines
const NAME_Y         = 22;   // role name center
const SUB_NAME_Y     = 40;   // subname label center
const FIRST_MEMBER_Y = 54;   // first character name center
const MEMBER_STEP_H  = 13;   // gap between character name lines

function nodeHeight(role: GraphRole): number {
    const n = role.members.length;
    if (n === 0) return BASE_NODE_H;
    return FIRST_MEMBER_Y + n * MEMBER_STEP_H + 8;
}

// ── Background ────────────────────────────────────────────────────────────────

function drawBackground(ctx: SKRSContext2D, w: number, h: number, seed: string): void {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    const rng = seededRng(seed);

    // ── Crescent moon (upper-right quadrant) ──────────────────────────────────
    const moonX = w * 0.80;
    const moonY = h * 0.20;
    const moonR = 68;

    // Soft outer glow
    const glow = ctx.createRadialGradient(moonX, moonY, moonR * 0.2, moonX, moonY, moonR * 2.4);
    glow.addColorStop(0, 'rgba(255, 245, 180, 0.07)');
    glow.addColorStop(1, 'rgba(255, 245, 180, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR * 2.4, 0, Math.PI * 2);
    ctx.fill();

    // Full-moon disc at low opacity
    ctx.globalAlpha = 0.13;
    ctx.fillStyle   = '#FFF6C0';
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Overlay circle in BG colour to carve out the crescent
    ctx.fillStyle = BG;
    ctx.beginPath();
    ctx.arc(moonX + moonR * 0.42, moonY - moonR * 0.06, moonR * 0.84, 0, Math.PI * 2);
    ctx.fill();

    // ── Stars ─────────────────────────────────────────────────────────────────
    for (let i = 0; i < 72; i++) {
        const sx     = rng() * w;
        const sy     = rng() * h;
        const radius = 0.35 + rng() * 1.4;
        const alpha  = 0.07 + rng() * 0.26;
        ctx.globalAlpha = alpha;
        ctx.fillStyle   = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function roundedRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function arrowhead(ctx: SKRSContext2D, tipX: number, tipY: number, color: string, size = 8): void {
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - size * 0.5, tipY - size);
    ctx.lineTo(tipX + size * 0.5, tipY - size);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
}

// Clip text to fit within maxWidth using ctx measurement
function fitText(ctx: SKRSContext2D, text: string, maxW: number): string {
    if (ctx.measureText(text).width <= maxW) return text;
    let s = text;
    while (s.length > 1 && ctx.measureText(s + '…').width > maxW) {
        s = s.slice(0, -1);
    }
    return s + '…';
}

// ── Main export ───────────────────────────────────────────────────────────────

export function buildRoleGraphBuffer(roles: GraphRole[], groupName: string): Buffer {
    if (roles.length === 0) {
        const c = createCanvas(320, 80);
        const x = c.getContext('2d');
        x.fillStyle = BG;
        x.fillRect(0, 0, 320, 80);
        x.fillStyle = TEXT;
        x.font = '14px sans-serif';
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillText('No roles defined.', 160, 40);
        return c.toBuffer('image/png');
    }

    // ── Level grouping ──────────────────────────────────────────────────────
    const levels = [...new Set(roles.map(r => r.position))].sort((a, b) => a - b);

    // Column order within a level follows the average column position of each role's
    // predecessors (a barycenter heuristic), so branches stay visually continuous
    // top-to-bottom without crossing. Roots with no predecessors sort alphabetically
    // and land after positioned roles.
    const columnIndex = new Map<string, number>();
    const byLevel = new Map<number, GraphRole[]>();

    for (const lv of levels) {
        const barycenter = (role: GraphRole): number | null => {
            const preds = roles.filter(r => columnIndex.has(r.id) && r.progressionsFrom.some(e => e.toRoleId === role.id));
            if (preds.length === 0) return null;
            return preds.reduce((sum, p) => sum + columnIndex.get(p.id)!, 0) / preds.length;
        };

        const sorted = roles
            .filter(r => r.position === lv)
            .map(role => ({ role, bary: barycenter(role) }))
            .sort((a, b) => {
                if (a.bary === null || b.bary === null) {
                    if (a.bary === null && b.bary === null) return a.role.name.localeCompare(b.role.name);
                    return a.bary === null ? 1 : -1;
                }
                return a.bary - b.bary || a.role.name.localeCompare(b.role.name);
            })
            .map(x => x.role);

        sorted.forEach((role, i) => columnIndex.set(role.id, i));
        byLevel.set(lv, sorted);
    }

    // ── Canvas size ─────────────────────────────────────────────────────────
    const maxPerLevel = Math.max(...[...byLevel.values()].map(rs => rs.length));
    const canvasW = Math.max(
        420,
        PAD_X * 2 + maxPerLevel * NODE_W + (maxPerLevel - 1) * GAP_X,
    );

    const levelNodeH = (lv: number) =>
        Math.max(...byLevel.get(lv)!.map(r => nodeHeight(r)));

    let totalH = PAD_TOP + PAD_BOT;
    for (let i = 0; i < levels.length; i++) {
        totalH += levelNodeH(levels[i]);
        if (i < levels.length - 1) totalH += LEVEL_GAP_Y;
    }
    const canvasH = totalH;

    // ── Node top-left positions ─────────────────────────────────────────────
    const nodePos = new Map<string, { x: number; y: number; h: number }>();
    let currentY = PAD_TOP;
    levels.forEach((lv, lvIdx) => {
        const row  = byLevel.get(lv)!;
        const rowW = row.length * NODE_W + (row.length - 1) * GAP_X;
        const left = (canvasW - rowW) / 2;
        row.forEach((role, i) => {
            nodePos.set(role.id, { x: left + i * (NODE_W + GAP_X), y: currentY, h: nodeHeight(role) });
        });
        currentY += levelNodeH(lv) + (lvIdx < levels.length - 1 ? LEVEL_GAP_Y : 0);
    });

    // ── Draw ────────────────────────────────────────────────────────────────
    const canvas = createCanvas(canvasW, canvasH);
    const ctx    = canvas.getContext('2d');

    // Background (moon + stars)
    drawBackground(ctx, canvasW, canvasH, groupName);

    // Title
    ctx.globalAlpha  = 1;
    ctx.fillStyle    = TEXT;
    ctx.font         = 'bold 15px sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${groupName} — Roles`, canvasW / 2, PAD_TOP / 2);

    // Edges (drawn before nodes so nodes render on top)
    for (const role of roles) {
        const from = nodePos.get(role.id);
        if (!from) continue;

        const edgeColor  = roleColorA(role.color, 0.67);
        const arrowColor = roleColorA(role.color, 0.80);

        for (const edge of role.progressionsFrom) {
            const to = nodePos.get(edge.toRoleId);
            if (!to) continue;

            const x1 = from.x + NODE_W / 2;
            const y1 = from.y + from.h;        // bottom of source node (dynamic)
            const x2 = to.x   + NODE_W / 2;
            const y2 = to.y;
            const cy = (y1 + y2) / 2;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.bezierCurveTo(x1, cy, x2, cy, x2, y2 - 8);
            ctx.strokeStyle = edgeColor;
            ctx.lineWidth   = 2;
            ctx.stroke();

            arrowhead(ctx, x2, y2, arrowColor);
        }
    }

    // Nodes
    const textPadX = 14;
    for (const role of roles) {
        const pos   = nodePos.get(role.id);
        if (!pos) continue;
        const color = roleColor(role.color);

        // Node fill + border
        roundedRect(ctx, pos.x, pos.y, NODE_W, pos.h, NODE_R);
        ctx.fillStyle = NODE_BG;
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth   = 2;
        ctx.stroke();

        const maxW       = NODE_W - textPadX * 2;
        const cx         = pos.x + NODE_W / 2;
        const hasSubName = !!role.subName;
        const hasMembers = role.members.length > 0;
        const isComplex  = hasSubName || hasMembers;

        // Role name
        const nameY = isComplex ? pos.y + NAME_Y : pos.y + pos.h / 2;
        ctx.globalAlpha  = 1;
        ctx.fillStyle    = TEXT;
        ctx.font         = 'bold 13px sans-serif';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(fitText(ctx, role.name, maxW), cx, nameY);

        // Subname label
        if (hasSubName) {
            ctx.globalAlpha = 1;
            ctx.fillStyle   = color;
            ctx.font        = '11px sans-serif';
            ctx.fillText(role.subName!, cx, pos.y + SUB_NAME_Y);
        }

        // Character names
        if (hasMembers) {
            ctx.font = '10px sans-serif';
            role.members.forEach((m, i) => {
                const memberY = pos.y + FIRST_MEMBER_Y + i * MEMBER_STEP_H;
                ctx.globalAlpha = 0.78;
                ctx.fillStyle   = TEXT;
                ctx.fillText(fitText(ctx, m.character.name, maxW), cx, memberY);
            });
            ctx.globalAlpha = 1;
        }
    }

    return canvas.toBuffer('image/png');
}
