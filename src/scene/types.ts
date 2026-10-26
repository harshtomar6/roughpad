export interface Vec {
  x: number;
  y: number;
}

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export type Tool = "select" | "hand" | "pen" | "ink" | "text" | "eraser";

export type FillStyle = "hachure" | "cross-hatch" | "solid" | "dots";

export type StrokeStyle = "solid" | "dashed" | "dotted";

export interface Style {
  stroke: string;
  background: string;
  fillStyle: FillStyle;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  roughness: number;
  opacity: number;
  fontSize: number;
}

export type ClosedKind =
  | "rect"
  | "ellipse"
  | "triangle"
  | "diamond"
  | "pentagon"
  | "hexagon"
  | "star"
  | "heart"
  | "cloud";

export type LinearKind = "line" | "arrow" | "curve" | "draw";

export type ElementKind = ClosedKind | LinearKind | "text";

interface ElementBase extends Style {
  id: string;
  kind: ElementKind;
  x: number;
  y: number;
  w: number;
  h: number;
  seed: number;
  version: number;
}

export interface BoxElement extends ElementBase {
  kind: "rect" | "ellipse";
}

export interface PolyElement extends ElementBase {
  kind: Exclude<ClosedKind, "rect" | "ellipse">;
  points: Vec[];
}

export interface LinearElement extends ElementBase {
  kind: LinearKind;
  points: Vec[];
  headStart?: boolean;
  headEnd?: boolean;
}

export interface TextElement extends ElementBase {
  kind: "text";
  text: string;
}

export type SceneElement = BoxElement | PolyElement | LinearElement | TextElement;

export interface Draft {
  points: Vec[];
  style: Style;
  pending: boolean;
}

export interface Marquee {
  start: Vec;
  current: Vec;
  base: string[];
}

export const DEFAULT_STYLE: Style = {
  stroke: "#1f1e1b",
  background: "transparent",
  fillStyle: "hachure",
  strokeWidth: 2,
  strokeStyle: "solid",
  roughness: 1.2,
  opacity: 1,
  fontSize: 28,
};

export const STROKE_COLORS = [
  "#1f1e1b",
  "#e03131",
  "#2f9e44",
  "#1971c2",
  "#f08c00",
  "#9c36b5",
  "#0c8599",
  "#8a8478",
];

export const BACKGROUND_COLORS = [
  "transparent",
  "#ffec99",
  "#b2f2bb",
  "#a5d8ff",
  "#ffc9c9",
  "#d0bfff",
  "#ffd8a8",
  "#e9ecef",
];

export const SHAPE_LABELS: Record<string, string> = {
  rect: "rectangle",
  ellipse: "ellipse",
  triangle: "triangle",
  diamond: "diamond",
  pentagon: "pentagon",
  hexagon: "hexagon",
  star: "star",
  heart: "heart",
  cloud: "cloud",
  line: "line",
  arrow: "arrow",
  curve: "curve",
  draw: "ink",
  text: "text",
};

export function styleOf(element: SceneElement): Style {
  return {
    stroke: element.stroke,
    background: element.background,
    fillStyle: element.fillStyle,
    strokeWidth: element.strokeWidth,
    strokeStyle: element.strokeStyle,
    roughness: element.roughness,
    opacity: element.opacity,
    fontSize: element.fontSize,
  };
}

export function isLinear(element: SceneElement): element is LinearElement {
  return (
    element.kind === "line" ||
    element.kind === "arrow" ||
    element.kind === "curve" ||
    element.kind === "draw"
  );
}

export function isText(element: SceneElement): element is TextElement {
  return element.kind === "text";
}
