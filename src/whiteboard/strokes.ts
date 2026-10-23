import { getStroke } from "perfect-freehand";
import type { StrokeElement } from "@/core/domain/entities/Whiteboard";

const average = (a: number, b: number) => (a + b) / 2;

/** Converts perfect-freehand's outline polygon into a smooth SVG path. */
export function svgPathFromOutline(points: number[][]): string {
  const len = points.length;
  if (len < 4) return "";
  let a = points[0];
  let b = points[1];
  const c = points[2];
  let d = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(2)},${b[1].toFixed(2)} ${average(b[0], c[0]).toFixed(2)},${average(b[1], c[1]).toFixed(2)} T`;
  for (let i = 2, max = len - 1; i < max; i++) {
    a = points[i];
    b = points[i + 1];
    d += `${average(a[0], b[0]).toFixed(2)},${average(a[1], b[1]).toFixed(2)} `;
  }
  return `${d}Z`;
}

export function strokePath(el: Pick<StrokeElement, "type" | "points" | "size">, last = true): string {
  const highlighter = el.type === "highlighter";
  const outline = getStroke(el.points, {
    size: highlighter ? el.size * 3 : el.size,
    thinning: highlighter ? 0 : 0.55,
    smoothing: 0.5,
    streamline: 0.45,
    simulatePressure: el.points.every((p) => p[2] === 0.5),
    last,
    start: { cap: true },
    end: { cap: true },
  });
  return svgPathFromOutline(outline);
}

export const PALETTE = ["#1e1b2e", "#ef4444", "#f59e0b", "#16a34a", "#2563eb", "#7c3aed", "#db2777", "#64748b"];
export const SIZES = [2, 4, 8, 14];
export const BOARD_BACKGROUND = "#ffffff";
