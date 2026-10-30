"use client";

import type Konva from "konva";
import { forwardRef } from "react";
import { Arrow, Ellipse, Layer, Line, Path, Rect, Stage, Text } from "react-konva";
import type { BoardElement } from "@/core/domain/entities/Whiteboard";
import { getBounds, textFontSize, type Bounds } from "@/whiteboard/model";
import { BOARD_BACKGROUND, strokePath } from "@/whiteboard/strokes";

export interface View {
  x: number;
  y: number;
  scale: number;
}

export function ElementShape({ el, dimmed }: { el: BoardElement; dimmed?: boolean }) {
  const opacity = dimmed ? 0.25 : 1;
  switch (el.type) {
    case "pen":
    case "highlighter":
      return (
        <Path
          data={strokePath(el)}
          fill={el.color}
          opacity={(el.type === "highlighter" ? 0.35 : 1) * opacity}
          listening={false}
          perfectDrawEnabled={false}
        />
      );
    case "rect":
      return (
        <Rect
          x={el.x}
          y={el.y}
          width={el.width}
          height={el.height}
          stroke={el.color}
          strokeWidth={el.size}
          cornerRadius={4}
          opacity={opacity}
          listening={false}
        />
      );
    case "ellipse":
      return (
        <Ellipse
          x={el.x + el.width / 2}
          y={el.y + el.height / 2}
          radiusX={Math.abs(el.width / 2)}
          radiusY={Math.abs(el.height / 2)}
          stroke={el.color}
          strokeWidth={el.size}
          opacity={opacity}
          listening={false}
        />
      );
    case "line":
      return (
        <Line
          x={el.x}
          y={el.y}
          points={el.points}
          stroke={el.color}
          strokeWidth={el.size}
          lineCap="round"
          opacity={opacity}
          listening={false}
        />
      );
    case "arrow":
      return (
        <Arrow
          x={el.x}
          y={el.y}
          points={el.points}
          stroke={el.color}
          fill={el.color}
          strokeWidth={el.size}
          pointerLength={8 + el.size * 2}
          pointerWidth={8 + el.size * 2}
          lineCap="round"
          opacity={opacity}
          listening={false}
        />
      );
    case "text":
      return (
        <Text
          x={el.x}
          y={el.y}
          text={el.text}
          fontSize={textFontSize(el.size)}
          fontFamily="Geist, ui-sans-serif, system-ui"
          fill={el.color}
          lineHeight={1.25}
          opacity={opacity}
          listening={false}
        />
      );
  }
}

export const BoardCanvas = forwardRef<
  Konva.Stage,
  {
    width: number;
    height: number;
    view: View;
    elements: BoardElement[];
    overlay?: BoardElement[];
    hiddenIds?: Set<string>;
    selection?: Bounds | null;
    onPointerDown?: (e: Konva.KonvaEventObject<PointerEvent>) => void;
    onPointerMove?: (e: Konva.KonvaEventObject<PointerEvent>) => void;
    onPointerUp?: (e: Konva.KonvaEventObject<PointerEvent>) => void;
    onWheel?: (e: Konva.KonvaEventObject<WheelEvent>) => void;
    cursor?: string;
  }
>(function BoardCanvas(
  { width, height, view, elements, overlay = [], hiddenIds, selection, cursor, ...handlers },
  ref,
) {
  return (
    <Stage
      ref={ref}
      width={width}
      height={height}
      x={view.x}
      y={view.y}
      scaleX={view.scale}
      scaleY={view.scale}
      style={{ cursor, touchAction: "none" }}
      onPointerDown={handlers.onPointerDown}
      onPointerMove={handlers.onPointerMove}
      onPointerUp={handlers.onPointerUp}
      onPointerLeave={handlers.onPointerUp}
      onWheel={handlers.onWheel}
    >
      <Layer listening={false}>
        <Rect
          x={-view.x / view.scale}
          y={-view.y / view.scale}
          width={width / view.scale}
          height={height / view.scale}
          fill={BOARD_BACKGROUND}
        />
      </Layer>
      <Layer listening={false}>
        {elements.map((el) => (
          <ElementShape key={el.id} el={el} dimmed={hiddenIds?.has(el.id)} />
        ))}
        {overlay.map((el) => (
          <ElementShape key={`o-${el.id}`} el={el} />
        ))}
        {selection && (
          <Rect
            x={selection.x - 6}
            y={selection.y - 6}
            width={selection.width + 12}
            height={selection.height + 12}
            stroke="#7c3aed"
            strokeWidth={1.5 / view.scale}
            dash={[6 / view.scale, 4 / view.scale]}
            cornerRadius={6}
          />
        )}
      </Layer>
    </Stage>
  );
});

/** Fits all elements into the viewport (used by history view and "zoom to fit"). */
export function fitView(elements: BoardElement[], width: number, height: number): View {
  if (!elements.length) return { x: 0, y: 0, scale: 1 };
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const el of elements) {
    const b = getBounds(el);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  const pad = 40;
  const scale = Math.min(
    2,
    Math.max(0.1, Math.min((width - pad * 2) / (maxX - minX || 1), (height - pad * 2) / (maxY - minY || 1))),
  );
  return { scale, x: width / 2 - ((minX + maxX) / 2) * scale, y: height / 2 - ((minY + maxY) / 2) * scale };
}

export function exportPng(stage: Konva.Stage | null, filename: string) {
  if (!stage) return;
  const url = stage.toDataURL({ pixelRatio: 2, mimeType: "image/png" });
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}
