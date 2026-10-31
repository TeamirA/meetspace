import { describe, expect, it } from "vitest";
import type { BoardElement, ShapeElement, StrokeElement } from "@/core/domain/entities/Whiteboard";
import {
  applyOp,
  BoardHistory,
  createBoard,
  elementAt,
  getBounds,
  hitTest,
  orderedElements,
  snapshot,
  translate,
  type BoardOp,
} from "@/whiteboard/model";

const stroke = (id: string, clock: number, author = "a"): StrokeElement => ({
  id,
  authorId: author,
  color: "#000000",
  size: 4,
  clock,
  type: "pen",
  points: [
    [0, 0, 0.5],
    [10, 10, 0.5],
  ],
});

const rect = (id: string, clock: number): ShapeElement => ({
  id,
  authorId: "a",
  color: "#000000",
  size: 2,
  clock,
  type: "rect",
  x: 100,
  y: 100,
  width: 50,
  height: 30,
});

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((p) => [item, ...p]),
  );
}

describe("board ops converge regardless of delivery order", () => {
  const ops: BoardOp[] = [
    { kind: "upsert", element: stroke("1", 1) },
    { kind: "upsert", element: rect("2", 2) },
    { kind: "upsert", element: { ...rect("2", 4), x: 300 } },
    { kind: "delete", ids: ["1"], clock: 5 },
    { kind: "upsert", element: stroke("3", 6, "b") },
  ];

  it("produces identical state for every ordering", () => {
    const results = permutations(ops).map((order) => {
      const board = createBoard();
      order.forEach((op) => applyOp(board, op));
      return JSON.stringify(snapshot(board).elements);
    });
    expect(new Set(results).size).toBe(1);
    const final = JSON.parse(results[0]) as BoardElement[];
    expect(final.map((e) => e.id)).toEqual(["2", "3"]);
    expect(final[0]).toMatchObject({ x: 300 });
  });

  it("ignores an upsert older than its tombstone", () => {
    const board = createBoard();
    applyOp(board, { kind: "delete", ids: ["x"], clock: 10 });
    expect(applyOp(board, { kind: "upsert", element: stroke("x", 9) })).toBe(false);
    expect(board.elements.size).toBe(0);
  });

  it("clear drops elements stamped before it but keeps later ones", () => {
    const board = createBoard([stroke("1", 1), stroke("2", 2)]);
    applyOp(board, { kind: "clear", clock: 3 });
    applyOp(board, { kind: "upsert", element: stroke("4", 4) });
    applyOp(board, { kind: "upsert", element: stroke("late", 2) });
    expect(orderedElements(board).map((e) => e.id)).toEqual(["4"]);
  });

  it("advances the Lamport clock past anything it sees", () => {
    const board = createBoard();
    applyOp(board, { kind: "upsert", element: stroke("1", 42) });
    expect(board.clock).toBe(42);
  });
});

describe("undo / redo", () => {
  it("undoes and redoes an added element", () => {
    const board = createBoard();
    const history = new BoardHistory();
    const el = stroke("1", 1);
    applyOp(board, { kind: "upsert", element: el });
    history.record(new Map([["1", undefined]]), new Map([["1", el]]));

    const undoOps = history.undo(board);
    expect(undoOps).toHaveLength(1);
    expect(board.elements.has("1")).toBe(false);

    history.redo(board);
    expect(board.elements.has("1")).toBe(true);
    expect(board.elements.get("1")!.clock).toBeGreaterThan(el.clock);
  });

  it("restores a moved element to its previous position", () => {
    const original = rect("r", 1);
    const board = createBoard([original]);
    const history = new BoardHistory();
    const moved = { ...translate(original, 20, 0), clock: 2 };
    applyOp(board, { kind: "upsert", element: moved });
    history.record(new Map([["r", original]]), new Map([["r", moved]]));
    history.undo(board);
    expect(board.elements.get("r")).toMatchObject({ x: 100 });
  });
});

describe("geometry", () => {
  it("hit-tests strokes near their path only", () => {
    const s = stroke("1", 1);
    expect(hitTest(s, 5, 5, 2)).toBe(true);
    expect(hitTest(s, 50, 5, 2)).toBe(false);
  });

  it("selects filled shapes from inside", () => {
    const board = createBoard([rect("r", 1)]);
    expect(elementAt(board, 120, 110, 4)?.id).toBe("r");
    expect(elementAt(board, 10, 10, 4)).toBeUndefined();
  });

  it("normalizes negative rectangle sizes in bounds", () => {
    expect(getBounds({ ...rect("r", 1), width: -50, height: -30 })).toEqual({ x: 50, y: 70, width: 50, height: 30 });
  });
});
