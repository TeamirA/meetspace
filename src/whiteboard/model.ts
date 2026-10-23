import type { BoardElement, Point } from "@/core/domain/entities/Whiteboard";

export type { BoardElement, Point } from "@/core/domain/entities/Whiteboard";

/**
 * Board operations. Each carries a Lamport clock so every participant converges on the same
 * state regardless of delivery order: newer clocks win, deletes leave tombstones, and `clear`
 * drops everything stamped at or before it.
 */
export type BoardOp =
  | { kind: "upsert"; element: BoardElement }
  | { kind: "delete"; ids: string[]; clock: number }
  | { kind: "clear"; clock: number };

export interface BoardState {
  elements: Map<string, BoardElement>;
  tombstones: Map<string, number>;
  clearedAt: number;
  clock: number;
}

export function createBoard(elements: BoardElement[] = []): BoardState {
  const board: BoardState = { elements: new Map(), tombstones: new Map(), clearedAt: 0, clock: 0 };
  for (const el of elements) applyOp(board, { kind: "upsert", element: el });
  return board;
}

export function opClock(op: BoardOp): number {
  return op.kind === "upsert" ? op.element.clock : op.clock;
}

/** Applies an op in place. Returns true when the visible board changed. */
export function applyOp(board: BoardState, op: BoardOp): boolean {
  board.clock = Math.max(board.clock, opClock(op));
  switch (op.kind) {
    case "upsert": {
      const el = op.element;
      if (el.clock <= board.clearedAt) return false;
      const tomb = board.tombstones.get(el.id);
      if (tomb !== undefined && tomb >= el.clock) return false;
      const existing = board.elements.get(el.id);
      if (existing && existing.clock > el.clock) return false;
      if (existing && existing.clock === el.clock && existing.authorId > el.authorId) return false;
      board.tombstones.delete(el.id);
      board.elements.set(el.id, el);
      return true;
    }
    case "delete": {
      let changed = false;
      for (const id of op.ids) {
        const existing = board.elements.get(id);
        if (existing && existing.clock > op.clock) continue;
        board.tombstones.set(id, Math.max(op.clock, board.tombstones.get(id) ?? 0));
        changed = board.elements.delete(id) || changed;
      }
      return changed;
    }
    case "clear": {
      if (op.clock <= board.clearedAt) return false;
      board.clearedAt = op.clock;
      let changed = false;
      for (const [id, el] of board.elements) {
        if (el.clock <= op.clock) {
          board.elements.delete(id);
          changed = true;
        }
      }
      return changed;
    }
  }
}

export function nextClock(board: BoardState): number {
  board.clock += 1;
  return board.clock;
}

/** Ids embed the creation clock so z-order (sorted ids) is identical on every client. */
export function createElementId(clock: number, authorId: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${clock.toString(36).padStart(8, "0")}-${authorId.slice(0, 8)}-${rand}`;
}

export function orderedElements(board: BoardState): BoardElement[] {
  return [...board.elements.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function snapshot(board: BoardState) {
  return { elements: orderedElements(board), clearedAt: board.clearedAt, clock: board.clock };
}

export function loadSnapshot(board: BoardState, snap: { elements: BoardElement[]; clearedAt: number; clock: number }) {
  board.clearedAt = Math.max(board.clearedAt, snap.clearedAt);
  board.clock = Math.max(board.clock, snap.clock);
  for (const el of snap.elements) applyOp(board, { kind: "upsert", element: el });
}

// ── Geometry ─────────────────────────────────────────────────────────────────

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getBounds(el: BoardElement): Bounds {
  switch (el.type) {
    case "pen":
    case "highlighter": {
      if (!el.points.length) return { x: 0, y: 0, width: 0, height: 0 };
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const [x, y] of el.points) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      const pad = el.size / 2;
      return { x: minX - pad, y: minY - pad, width: maxX - minX + el.size, height: maxY - minY + el.size };
    }
    case "rect":
    case "ellipse": {
      const x = Math.min(el.x, el.x + el.width);
      const y = Math.min(el.y, el.y + el.height);
      return { x, y, width: Math.abs(el.width), height: Math.abs(el.height) };
    }
    case "line":
    case "arrow": {
      const [x1, y1, x2, y2] = el.points;
      const x = el.x + Math.min(x1, x2);
      const y = el.y + Math.min(y1, y2);
      return { x, y, width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
    }
    case "text": {
      const lines = el.text.split("\n");
      const fontSize = textFontSize(el.size);
      const longest = Math.max(1, ...lines.map((l) => l.length));
      return { x: el.x, y: el.y, width: longest * fontSize * 0.6, height: lines.length * fontSize * 1.25 };
    }
  }
}

export const textFontSize = (size: number) => Math.max(12, size * 6);

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len)) : 0;
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** Whether a circle at (x, y) with `radius` touches the element; used by the eraser and selection. */
export function hitTest(el: BoardElement, x: number, y: number, radius: number): boolean {
  const tolerance = radius + el.size / 2;
  switch (el.type) {
    case "pen":
    case "highlighter": {
      const pts = el.points;
      if (pts.length === 1) return Math.hypot(pts[0][0] - x, pts[0][1] - y) <= tolerance;
      for (let i = 1; i < pts.length; i++) {
        if (distToSegment(x, y, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]) <= tolerance) return true;
      }
      return false;
    }
    case "rect": {
      const b = getBounds(el);
      const inside =
        x >= b.x - tolerance &&
        x <= b.x + b.width + tolerance &&
        y >= b.y - tolerance &&
        y <= b.y + b.height + tolerance;
      const deep =
        x > b.x + tolerance && x < b.x + b.width - tolerance && y > b.y + tolerance && y < b.y + b.height - tolerance;
      return inside && !deep;
    }
    case "ellipse": {
      const b = getBounds(el);
      const rx = b.width / 2;
      const ry = b.height / 2;
      if (rx < 1 || ry < 1) return Math.hypot(b.x + rx - x, b.y + ry - y) <= tolerance;
      const nx = (x - (b.x + rx)) / rx;
      const ny = (y - (b.y + ry)) / ry;
      const d = Math.sqrt(nx * nx + ny * ny);
      return Math.abs(d - 1) * Math.min(rx, ry) <= tolerance;
    }
    case "line":
    case "arrow": {
      const [x1, y1, x2, y2] = el.points;
      return distToSegment(x, y, el.x + x1, el.y + y1, el.x + x2, el.y + y2) <= tolerance;
    }
    case "text": {
      const b = getBounds(el);
      return x >= b.x - radius && x <= b.x + b.width + radius && y >= b.y - radius && y <= b.y + b.height + radius;
    }
  }
}

/** Topmost element under the pointer (selection uses a generous radius). */
export function elementAt(board: BoardState, x: number, y: number, radius: number): BoardElement | undefined {
  const list = orderedElements(board);
  for (let i = list.length - 1; i >= 0; i--) {
    const el = list[i];
    if (el.type === "rect" || el.type === "ellipse") {
      const b = getBounds(el);
      if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) return el;
    }
    if (hitTest(el, x, y, radius)) return el;
  }
  return undefined;
}

export function translate(el: BoardElement, dx: number, dy: number): BoardElement {
  switch (el.type) {
    case "pen":
    case "highlighter":
      return { ...el, points: el.points.map(([x, y, p]) => [x + dx, y + dy, p] as Point) };
    default:
      return { ...el, x: el.x + dx, y: el.y + dy };
  }
}

// ── Undo / redo (local to each participant, expressed as ordinary ops) ──────

interface HistoryEntry {
  /** Element versions before the action (undefined = did not exist). */
  before: Map<string, BoardElement | undefined>;
  /** Element versions after the action (undefined = removed). */
  after: Map<string, BoardElement | undefined>;
}

export class BoardHistory {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];

  record(before: Map<string, BoardElement | undefined>, after: Map<string, BoardElement | undefined>) {
    this.undoStack.push({ before, after });
    if (this.undoStack.length > 200) this.undoStack.shift();
    this.redoStack = [];
  }

  get canUndo() {
    return this.undoStack.length > 0;
  }
  get canRedo() {
    return this.redoStack.length > 0;
  }

  undo(board: BoardState): BoardOp[] {
    const entry = this.undoStack.pop();
    if (!entry) return [];
    this.redoStack.push(entry);
    return restore(board, entry.before);
  }

  redo(board: BoardState): BoardOp[] {
    const entry = this.redoStack.pop();
    if (!entry) return [];
    this.undoStack.push(entry);
    return restore(board, entry.after);
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}

/** Builds fresh-clocked ops that bring each element back to `target`'s version. */
function restore(board: BoardState, target: Map<string, BoardElement | undefined>): BoardOp[] {
  const ops: BoardOp[] = [];
  const toDelete: string[] = [];
  for (const [id, el] of target) {
    if (el) ops.push({ kind: "upsert", element: { ...el, clock: nextClock(board) } });
    else toDelete.push(id);
  }
  if (toDelete.length) ops.push({ kind: "delete", ids: toDelete, clock: nextClock(board) });
  for (const op of ops) applyOp(board, op);
  return ops;
}
