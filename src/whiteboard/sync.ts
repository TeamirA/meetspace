import type { BoardElement } from "@/core/domain/entities/Whiteboard";
import { applyOp, createBoard, loadSnapshot, nextClock, snapshot, type BoardOp, type BoardState } from "./model";

/** Wire messages exchanged over the room channel (ops) and data channels (live previews). */
export type WhiteboardMessage =
  | { type: "wb:ops"; ops: BoardOp[] }
  | { type: "wb:preview"; authorId: string; element: BoardElement | null }
  | { type: "wb:state-request" }
  | { type: "wb:state"; elements: BoardElement[]; clearedAt: number; clock: number };

export interface WhiteboardTransport {
  /** Reliable, ordered-enough delivery to everyone (Realtime broadcast). */
  broadcast(msg: WhiteboardMessage): void;
  /** Best-effort low-latency delivery (RTCDataChannel), for in-progress strokes. */
  sendFast(msg: WhiteboardMessage): void;
  sendTo(peerId: string, msg: WhiteboardMessage): void;
}

/**
 * Keeps a local board in sync. Only incremental ops travel over the wire; a full snapshot is
 * sent once to late joiners on request. Persistence is debounced and done by a single
 * "leader" (the earliest-joined participant) to avoid write storms.
 */
export class WhiteboardSync {
  readonly board: BoardState = createBoard();
  private listeners = new Set<() => void>();
  private previews = new Map<string, BoardElement>();
  private saveTimer?: ReturnType<typeof setTimeout>;
  private dirty = false;
  version = 0;

  constructor(
    private readonly selfId: string,
    private readonly transport: WhiteboardTransport,
    private readonly persist: (elements: BoardElement[]) => Promise<void>,
    private readonly isLeader: () => boolean,
  ) {}

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    this.version++;
    for (const fn of this.listeners) fn();
  }

  get livePreviews(): BoardElement[] {
    return [...this.previews.values()];
  }

  loadPersisted(elements: BoardElement[]) {
    loadSnapshot(this.board, { elements, clearedAt: 0, clock: Math.max(0, ...elements.map((e) => e.clock)) });
    this.emit();
  }

  requestState() {
    this.transport.broadcast({ type: "wb:state-request" });
  }

  /** Apply ops produced locally (already applied to the board by the tool) and share them. */
  commit(ops: BoardOp[]) {
    if (!ops.length) return;
    this.transport.broadcast({ type: "wb:ops", ops });
    this.transport.sendFast({ type: "wb:preview", authorId: this.selfId, element: null });
    this.markDirty();
    this.emit();
  }

  /** Apply and share ops in one go (for actions that build ops without touching the board). */
  apply(ops: BoardOp[]) {
    for (const op of ops) applyOp(this.board, op);
    this.commit(ops);
  }

  clear() {
    this.apply([{ kind: "clear", clock: nextClock(this.board) }]);
  }

  preview(element: BoardElement | null) {
    this.transport.sendFast({ type: "wb:preview", authorId: this.selfId, element });
  }

  handle(fromId: string, msg: WhiteboardMessage) {
    switch (msg.type) {
      case "wb:ops": {
        let changed = false;
        for (const op of msg.ops) changed = applyOp(this.board, op) || changed;
        if (this.previews.delete(fromId)) changed = true;
        if (changed) {
          this.markDirty();
          this.emit();
        }
        break;
      }
      case "wb:preview": {
        if (msg.element) this.previews.set(fromId, msg.element);
        else this.previews.delete(fromId);
        this.emit();
        break;
      }
      case "wb:state-request": {
        if (this.isLeader()) this.transport.sendTo(fromId, { type: "wb:state", ...snapshot(this.board) });
        break;
      }
      case "wb:state": {
        loadSnapshot(this.board, msg);
        this.emit();
        break;
      }
    }
  }

  dropPreview(peerId: string) {
    if (this.previews.delete(peerId)) this.emit();
  }

  private markDirty() {
    this.dirty = true;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.flush(), 2500);
  }

  async flush() {
    clearTimeout(this.saveTimer);
    if (!this.dirty || !this.isLeader()) return;
    this.dirty = false;
    try {
      await this.persist(snapshot(this.board).elements);
    } catch {
      this.dirty = true;
    }
  }

  dispose() {
    clearTimeout(this.saveTimer);
    this.listeners.clear();
  }
}
