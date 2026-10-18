export type Point = [x: number, y: number, pressure: number];

interface BaseElement {
  id: string;
  authorId: string;
  color: string;
  size: number;
  /** Lamport timestamp of the last change, used to resolve concurrent edits (last writer wins). */
  clock: number;
}

export interface StrokeElement extends BaseElement {
  type: "pen" | "highlighter";
  points: Point[];
}

export interface ShapeElement extends BaseElement {
  type: "rect" | "ellipse";
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LineElement extends BaseElement {
  type: "line" | "arrow";
  x: number;
  y: number;
  /** Relative to (x, y). */
  points: [number, number, number, number];
}

export interface TextElement extends BaseElement {
  type: "text";
  x: number;
  y: number;
  text: string;
}

export type BoardElement = StrokeElement | ShapeElement | LineElement | TextElement;
export type BoardElementType = BoardElement["type"];

export interface Whiteboard {
  meetingId: string;
  elements: BoardElement[];
  version: number;
  updatedAt: Date;
}

export const MAX_BOARD_ELEMENTS = 5000;
export const MAX_STROKE_POINTS = 4000;
