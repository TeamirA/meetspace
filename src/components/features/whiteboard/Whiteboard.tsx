"use client";

import type Konva from "konva";
import {
  ArrowUpRight,
  Circle,
  Download,
  Eraser,
  Hand,
  Highlighter,
  Maximize,
  Minus,
  MousePointer2,
  Pen,
  Redo2,
  Square,
  Trash2,
  Type,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useCallSession } from "@/components/features/call/context";
import { IconButton } from "@/components/ui/icon-button";
import type { BoardElement, Point } from "@/core/domain/entities/Whiteboard";
import { cn } from "@/lib/utils";
import { useCallStore } from "@/stores/callStore";
import { useUiStore } from "@/stores/uiStore";
import {
  applyOp,
  BoardHistory,
  createElementId,
  elementAt,
  getBounds,
  hitTest,
  nextClock,
  orderedElements,
  textFontSize,
  translate,
  type BoardOp,
} from "@/whiteboard/model";
import { PALETTE, SIZES } from "@/whiteboard/strokes";
import { BoardCanvas, exportPng, fitView, type View } from "./BoardCanvas";

type Tool = "select" | "hand" | "pen" | "highlighter" | "rect" | "ellipse" | "line" | "arrow" | "text" | "eraser";

const TOOLS: { id: Tool; label: string; icon: typeof Pen; key: string }[] = [
  { id: "select", label: "Select & move", icon: MousePointer2, key: "1" },
  { id: "hand", label: "Pan", icon: Hand, key: "2" },
  { id: "pen", label: "Pen", icon: Pen, key: "3" },
  { id: "highlighter", label: "Highlighter", icon: Highlighter, key: "4" },
  { id: "rect", label: "Rectangle", icon: Square, key: "5" },
  { id: "ellipse", label: "Ellipse", icon: Circle, key: "6" },
  { id: "arrow", label: "Arrow", icon: ArrowUpRight, key: "7" },
  { id: "line", label: "Line", icon: Minus, key: "8" },
  { id: "text", label: "Text", icon: Type, key: "9" },
  { id: "eraser", label: "Eraser", icon: Eraser, key: "0" },
];

function useContainerSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setSize({ width: Math.floor(e.contentRect.width), height: Math.floor(e.contentRect.height) }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

type Draft =
  | { kind: "draw"; element: BoardElement }
  | { kind: "erase"; ids: Set<string> }
  | { kind: "move"; element: BoardElement; origin: { x: number; y: number }; moved: BoardElement }
  | { kind: "pan"; start: { x: number; y: number }; view: View };

export function Whiteboard() {
  const session = useCallSession();
  const sync = session.whiteboard;
  const selfId = session.selfId;
  const isHost = useCallStore((s) => s.self?.role === "HOST");
  const setWhiteboard = useUiStore((s) => s.setWhiteboard);
  const version = useSyncExternalStore(
    useCallback((cb) => sync.subscribe(cb), [sync]),
    () => sync.version,
    () => 0,
  );
  const [containerRef, size] = useContainerSize();
  const stageRef = useRef<Konva.Stage>(null);
  const [history] = useState(() => new BoardHistory());
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(PALETTE[0]);
  const [strokeSize, setStrokeSize] = useState(SIZES[1]);
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [textEdit, setTextEdit] = useState<{ x: number; y: number; value: string } | null>(null);
  const [, forceHistory] = useState(0);
  const previewFrame = useRef(0);

  // `version` is the change signal for the mutable board.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const elements = useMemo(() => orderedElements(sync.board), [sync, version]);
  const selected = selectedId ? sync.board.elements.get(selectedId) : undefined;

  const toBoard = (stage: Konva.Stage) => {
    const p = stage.getPointerPosition() ?? { x: 0, y: 0 };
    return { x: (p.x - view.x) / view.scale, y: (p.y - view.y) / view.scale };
  };

  const commit = useCallback(
    (ops: BoardOp[], before: Map<string, BoardElement | undefined>, after: Map<string, BoardElement | undefined>) => {
      if (!ops.length) return;
      history.record(before, after);
      sync.commit(ops);
      forceHistory((n) => n + 1);
    },
    [history, sync],
  );

  const sendPreview = (el: BoardElement | null) => {
    cancelAnimationFrame(previewFrame.current);
    previewFrame.current = requestAnimationFrame(() => sync.preview(el));
  };

  const onPointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    const stage = e.target.getStage();
    if (!stage || textEdit) return;
    const pt = toBoard(stage);
    const pressure = e.evt.pressure && e.evt.pointerType === "pen" ? e.evt.pressure : 0.5;
    const middle = e.evt.button === 1;
    if (tool === "hand" || middle) {
      setDraft({ kind: "pan", start: { x: e.evt.clientX, y: e.evt.clientY }, view });
      return;
    }
    const base = { id: "", authorId: selfId, color, size: strokeSize, clock: 0 };
    switch (tool) {
      case "pen":
      case "highlighter":
        setDraft({ kind: "draw", element: { ...base, id: "draft", type: tool, points: [[pt.x, pt.y, pressure]] } });
        break;
      case "rect":
      case "ellipse":
        setDraft({
          kind: "draw",
          element: { ...base, id: "draft", type: tool, x: pt.x, y: pt.y, width: 0, height: 0 },
        });
        break;
      case "line":
      case "arrow":
        setDraft({
          kind: "draw",
          element: { ...base, id: "draft", type: tool, x: pt.x, y: pt.y, points: [0, 0, 0, 0] },
        });
        break;
      case "text":
        setTextEdit({ x: pt.x, y: pt.y, value: "" });
        break;
      case "eraser": {
        const ids = new Set<string>();
        for (const el of sync.board.elements.values()) if (hitTest(el, pt.x, pt.y, 8 / view.scale)) ids.add(el.id);
        setDraft({ kind: "erase", ids });
        break;
      }
      case "select": {
        const hit = elementAt(sync.board, pt.x, pt.y, 8 / view.scale);
        setSelectedId(hit?.id ?? null);
        if (hit) setDraft({ kind: "move", element: hit, origin: pt, moved: hit });
        break;
      }
    }
  };

  const onPointerMove = (e: Konva.KonvaEventObject<PointerEvent>) => {
    if (!draft) return;
    const stage = e.target.getStage();
    if (!stage) return;
    if (draft.kind === "pan") {
      setView({
        ...draft.view,
        x: draft.view.x + e.evt.clientX - draft.start.x,
        y: draft.view.y + e.evt.clientY - draft.start.y,
      });
      return;
    }
    const pt = toBoard(stage);
    if (draft.kind === "erase") {
      const ids = new Set(draft.ids);
      for (const el of sync.board.elements.values()) if (hitTest(el, pt.x, pt.y, 8 / view.scale)) ids.add(el.id);
      if (ids.size !== draft.ids.size) setDraft({ kind: "erase", ids });
      return;
    }
    if (draft.kind === "move") {
      const moved = translate(draft.element, pt.x - draft.origin.x, pt.y - draft.origin.y);
      setDraft({ ...draft, moved });
      sendPreview(moved);
      return;
    }
    const el = draft.element;
    let next: BoardElement = el;
    if (el.type === "pen" || el.type === "highlighter") {
      if (el.points.length >= 4000) return;
      const pressure = e.evt.pressure && e.evt.pointerType === "pen" ? e.evt.pressure : 0.5;
      next = { ...el, points: [...el.points, [pt.x, pt.y, pressure] as Point] };
    } else if (el.type === "rect" || el.type === "ellipse") {
      next = { ...el, width: pt.x - el.x, height: pt.y - el.y };
    } else if (el.type === "line" || el.type === "arrow") {
      next = { ...el, points: [0, 0, pt.x - el.x, pt.y - el.y] };
    }
    setDraft({ kind: "draw", element: next });
    sendPreview(next);
  };

  const onPointerUp = () => {
    if (!draft) return;
    setDraft(null);
    if (draft.kind === "pan") return;
    if (draft.kind === "erase") {
      if (!draft.ids.size) return;
      const before = new Map([...draft.ids].map((id) => [id, sync.board.elements.get(id)]));
      const op: BoardOp = { kind: "delete", ids: [...draft.ids], clock: nextClock(sync.board) };
      applyOp(sync.board, op);
      commit([op], before, new Map([...draft.ids].map((id) => [id, undefined])));
      return;
    }
    if (draft.kind === "move") {
      if (draft.moved === draft.element) return sync.preview(null);
      const element = { ...draft.moved, clock: nextClock(sync.board) };
      const op: BoardOp = { kind: "upsert", element };
      applyOp(sync.board, op);
      commit([op], new Map([[element.id, draft.element]]), new Map([[element.id, element]]));
      return;
    }
    const el = draft.element;
    const tiny =
      ((el.type === "rect" || el.type === "ellipse") && Math.abs(el.width) < 3 && Math.abs(el.height) < 3) ||
      ((el.type === "line" || el.type === "arrow") && Math.hypot(el.points[2], el.points[3]) < 3);
    if (tiny) return sync.preview(null);
    const clock = nextClock(sync.board);
    const element = { ...el, id: createElementId(clock, selfId), clock } as BoardElement;
    const op: BoardOp = { kind: "upsert", element };
    applyOp(sync.board, op);
    commit([op], new Map([[element.id, undefined]]), new Map([[element.id, element]]));
  };

  const commitText = () => {
    if (!textEdit) return;
    const text = textEdit.value.trim().slice(0, 2000);
    setTextEdit(null);
    if (!text) return;
    const clock = nextClock(sync.board);
    const element: BoardElement = {
      id: createElementId(clock, selfId),
      authorId: selfId,
      color,
      size: strokeSize,
      clock,
      type: "text",
      x: textEdit.x,
      y: textEdit.y,
      text,
    };
    const op: BoardOp = { kind: "upsert", element };
    applyOp(sync.board, op);
    commit([op], new Map([[element.id, undefined]]), new Map([[element.id, element]]));
  };

  const zoomAt = (factor: number, center = { x: size.width / 2, y: size.height / 2 }) => {
    setView((v) => {
      const scale = Math.min(6, Math.max(0.1, v.scale * factor));
      const k = scale / v.scale;
      return { scale, x: center.x - (center.x - v.x) * k, y: center.y - (center.y - v.y) * k };
    });
  };

  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    if (e.evt.ctrlKey || e.evt.metaKey) {
      const p = stage?.getPointerPosition() ?? undefined;
      zoomAt(Math.exp(-e.evt.deltaY * 0.01), p);
    } else {
      setView((v) => ({ ...v, x: v.x - e.evt.deltaX, y: v.y - e.evt.deltaY }));
    }
  };

  const undo = useCallback(() => {
    const ops = history.undo(sync.board);
    if (ops.length) sync.commit(ops);
    forceHistory((n) => n + 1);
  }, [history, sync]);
  const redo = useCallback(() => {
    const ops = history.redo(sync.board);
    if (ops.length) sync.commit(ops);
    forceHistory((n) => n + 1);
  }, [history, sync]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    const el = sync.board.elements.get(selectedId);
    if (!el) return;
    const op: BoardOp = { kind: "delete", ids: [selectedId], clock: nextClock(sync.board) };
    applyOp(sync.board, op);
    commit([op], new Map([[selectedId, el]]), new Map([[selectedId, undefined]]));
    setSelectedId(null);
  }, [selectedId, sync, commit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA)$/.test(t.tagName)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        deleteSelected();
      } else if (!mod && !e.altKey) {
        const t2 = TOOLS.find((x) => x.key === e.key);
        if (t2) setTool(t2.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, deleteSelected, selectedId]);

  const overlay: BoardElement[] = [...sync.livePreviews];
  if (draft?.kind === "draw") overlay.push(draft.element);
  if (draft?.kind === "move") overlay.push(draft.moved);
  const hidden = draft?.kind === "erase" ? draft.ids : draft?.kind === "move" ? new Set([draft.element.id]) : undefined;
  const selection =
    selected && draft?.kind !== "move" ? getBounds(selected) : draft?.kind === "move" ? getBounds(draft.moved) : null;
  const cursor =
    tool === "hand"
      ? draft?.kind === "pan"
        ? "grabbing"
        : "grab"
      : tool === "select"
        ? "default"
        : tool === "text"
          ? "text"
          : "crosshair";

  return (
    <div className="shadow-soft relative size-full overflow-hidden rounded-2xl border bg-white" data-shortcuts-off="">
      <div ref={containerRef} className="absolute inset-0">
        {size.width > 0 && (
          <BoardCanvas
            ref={stageRef}
            width={size.width}
            height={size.height}
            view={view}
            elements={elements}
            overlay={overlay}
            hiddenIds={hidden}
            selection={tool === "select" ? selection : null}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onWheel={onWheel}
            cursor={cursor}
          />
        )}
      </div>

      {textEdit && (
        <textarea
          autoFocus
          aria-label="Whiteboard text"
          value={textEdit.value}
          onChange={(e) => setTextEdit({ ...textEdit, value: e.target.value })}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === "Escape") setTextEdit(null);
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commitText();
            }
          }}
          className="absolute z-10 min-w-40 resize-none rounded-md border-2 border-dashed border-violet-500 bg-white/90 p-1 outline-none"
          style={{
            left: textEdit.x * view.scale + view.x,
            top: textEdit.y * view.scale + view.y,
            color,
            fontSize: textFontSize(strokeSize) * view.scale,
            lineHeight: 1.25,
          }}
        />
      )}

      {/* Toolbar */}
      <div
        className="bg-popover/95 shadow-float absolute top-3 left-1/2 z-10 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 scrollbar-thin items-center gap-1 overflow-x-auto rounded-2xl border p-1.5 backdrop-blur"
        role="toolbar"
        aria-label="Whiteboard tools"
      >
        {TOOLS.map(({ id, label, icon: Icon, key }) => (
          <IconButton
            key={id}
            label={label}
            shortcut={key}
            size="sm"
            tooltipSide="bottom"
            tone={tool === id ? "active" : "default"}
            className={tool === id ? "" : "bg-transparent"}
            aria-pressed={tool === id}
            onClick={() => {
              setTool(id);
              if (id !== "select") setSelectedId(null);
            }}
          >
            <Icon />
          </IconButton>
        ))}
        <span className="bg-border mx-1 h-6 w-px shrink-0" aria-hidden />
        <IconButton
          label="Undo"
          shortcut="⌘Z"
          size="sm"
          tooltipSide="bottom"
          className="bg-transparent"
          disabled={!history.canUndo}
          onClick={undo}
        >
          <Undo2 />
        </IconButton>
        <IconButton
          label="Redo"
          shortcut="⇧⌘Z"
          size="sm"
          tooltipSide="bottom"
          className="bg-transparent"
          disabled={!history.canRedo}
          onClick={redo}
        >
          <Redo2 />
        </IconButton>
        {tool === "select" && selectedId && (
          <IconButton
            label="Delete selection"
            size="sm"
            tooltipSide="bottom"
            className="bg-transparent"
            onClick={deleteSelected}
          >
            <Trash2 />
          </IconButton>
        )}
        {isHost && (
          <IconButton
            label="Clear board for everyone"
            size="sm"
            tooltipSide="bottom"
            className="text-destructive bg-transparent"
            onClick={() => {
              if (confirm("Clear the whiteboard for everyone? This can't be undone.")) {
                sync.clear();
                history.clear();
                forceHistory((n) => n + 1);
              }
            }}
          >
            <Trash2 />
          </IconButton>
        )}
      </div>

      {/* Style picker */}
      <div
        className="bg-popover/95 shadow-float absolute bottom-3 left-3 z-10 flex flex-col gap-2 rounded-2xl border p-2 backdrop-blur"
        role="group"
        aria-label="Stroke style"
      >
        <div className="grid grid-cols-4 gap-1.5">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              className={cn(
                "ring-offset-popover size-6 rounded-full ring-offset-2 transition",
                color === c && "ring-primary ring-2",
              )}
              style={{ background: c }}
            />
          ))}
        </div>
        <div className="flex items-center justify-between gap-1">
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              aria-label={`Stroke width ${s}`}
              aria-pressed={strokeSize === s}
              onClick={() => setStrokeSize(s)}
              className={cn(
                "hover:bg-muted flex size-8 items-center justify-center rounded-lg",
                strokeSize === s && "bg-muted",
              )}
            >
              <span
                className="bg-foreground rounded-full"
                style={{ width: Math.min(20, s + 2), height: Math.min(20, s + 2) }}
              />
            </button>
          ))}
        </div>
      </div>

      {/* View controls */}
      <div className="bg-popover/95 shadow-float absolute right-3 bottom-3 z-10 flex items-center gap-1 rounded-2xl border p-1.5 backdrop-blur">
        <IconButton label="Zoom out" size="sm" className="bg-transparent" onClick={() => zoomAt(1 / 1.2)}>
          <ZoomOut />
        </IconButton>
        <button
          type="button"
          onClick={() => setView({ x: 0, y: 0, scale: 1 })}
          className="hover:bg-muted min-w-12 rounded-lg px-1 text-xs font-medium tabular-nums"
          aria-label="Reset zoom"
        >
          {Math.round(view.scale * 100)}%
        </button>
        <IconButton label="Zoom in" size="sm" className="bg-transparent" onClick={() => zoomAt(1.2)}>
          <ZoomIn />
        </IconButton>
        <IconButton
          label="Zoom to fit"
          size="sm"
          className="bg-transparent"
          onClick={() => setView(fitView(orderedElements(sync.board), size.width, size.height))}
        >
          <Maximize />
        </IconButton>
        <IconButton
          label="Export as PNG"
          size="sm"
          className="bg-transparent"
          onClick={() => exportPng(stageRef.current, `whiteboard-${session.code}.png`)}
        >
          <Download />
        </IconButton>
        <IconButton label="Close whiteboard" size="sm" className="bg-transparent" onClick={() => setWhiteboard(false)}>
          <X />
        </IconButton>
      </div>
    </div>
  );
}
