import type { Shape } from "@desert-ant-labs/shapes";
import {
  boundsOfPoints,
  makeId,
  normalizePoints,
  randomSeed,
} from "./geometry";
import type {
  LinearElement,
  SceneElement,
  Style,
  TextElement,
  Vec,
} from "./types";

export const TEXT_LINE_HEIGHT = 1.22;

let measureCanvas: HTMLCanvasElement | null = null;

function getMeasureContext() {
  if (!measureCanvas) {
    measureCanvas = document.createElement("canvas");
  }
  return measureCanvas.getContext("2d")!;
}

export function measureText(text: string, fontSize: number) {
  const ctx = getMeasureContext();
  ctx.font = `500 ${fontSize}px Caveat, cursive`;
  const lines = text.split("\n");
  let width = 0;
  for (const line of lines) {
    width = Math.max(width, ctx.measureText(line || " ").width);
  }
  return {
    w: Math.max(width, 6),
    h: Math.max(lines.length, 1) * fontSize * TEXT_LINE_HEIGHT,
  };
}

function baseFromStyle(style: Style) {
  return {
    stroke: style.stroke,
    background: style.background,
    fillStyle: style.fillStyle,
    strokeWidth: style.strokeWidth,
    strokeStyle: style.strokeStyle,
    roughness: style.roughness,
    opacity: style.opacity,
    fontSize: style.fontSize,
    version: 1,
  };
}

export function inkElement(
  points: Vec[],
  style: Style,
  id = makeId(),
  seed = randomSeed(),
): LinearElement {
  const padding = Math.max(2, style.strokeWidth * 1.5);
  const bounds = boundsOfPoints(points, padding);
  return {
    id,
    seed,
    kind: "draw",
    x: bounds.x,
    y: bounds.y,
    w: bounds.w,
    h: bounds.h,
    points: normalizePoints(points, bounds),
    ...baseFromStyle(style),
  };
}

export function lineElement(
  points: Vec[],
  style: Style,
  headStart = false,
  headEnd = false,
  onlyStraight = false,
  id = makeId(),
  seed = randomSeed(),
): LinearElement {
  const bounds = boundsOfPoints(points);
  const kind: LinearElement["kind"] = onlyStraight
    ? "line"
    : headStart || headEnd
      ? "arrow"
      : "curve";
  return {
    id,
    seed,
    kind,
    x: bounds.x,
    y: bounds.y,
    w: bounds.w,
    h: bounds.h,
    points: normalizePoints(points, bounds),
    headStart,
    headEnd,
    ...baseFromStyle(style),
  };
}

export function textElement(
  text: string,
  x: number,
  y: number,
  style: Style,
  fontSize = style.fontSize,
  color = style.stroke,
  id = makeId(),
  seed = randomSeed(),
): TextElement {
  const { w, h } = measureText(text, fontSize);
  return {
    id,
    seed,
    kind: "text",
    x,
    y,
    w,
    h,
    text,
    ...baseFromStyle({ ...style, fontSize, stroke: color }),
  };
}

export function shapeToElement(
  shape: Shape,
  style: Style,
  id = makeId(),
  seed = randomSeed(),
): SceneElement | null {
  const base = { id, seed, ...baseFromStyle(style) };

  if (shape.kind === "scribble" || shape.outline.length === 0) {
    return null;
  }

  if (shape.kind === "rectangle") {
    const bounds = boundsOfPoints(shape.outline);
    return { ...base, kind: "rect", ...bounds };
  }

  if (shape.kind === "ellipse") {
    const bounds = boundsOfPoints(shape.outline);
    return { ...base, kind: "ellipse", ...bounds };
  }

  if (
    shape.kind === "line" ||
    shape.kind === "curve" ||
    shape.kind === "arrow"
  ) {
    if (shape.kind === "line") {
      const points = [shape.from, shape.to];
      const bounds = boundsOfPoints(points);
      return {
        ...base,
        kind: "line",
        ...bounds,
        points: normalizePoints(points, bounds),
      };
    }

    const points = [shape.from, shape.control1, shape.control2, shape.to];
    const bounds = boundsOfPoints(points);
    return {
      ...base,
      kind: shape.kind,
      ...bounds,
      points: normalizePoints(points, bounds),
      headStart: shape.kind === "arrow" ? shape.startHead : false,
      headEnd: shape.kind === "arrow" ? shape.endHead : false,
    };
  }

  const outline = shape.outline;
  const bounds = boundsOfPoints(outline);
  return {
    ...base,
    kind: shape.kind,
    ...bounds,
    points: normalizePoints(outline, bounds),
  };
}
