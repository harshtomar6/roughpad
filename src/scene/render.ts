import rough from "roughjs";
import type { RoughCanvas } from "roughjs/bin/canvas";
import type { Drawable, Options } from "roughjs/bin/core";
import { getStroke } from "perfect-freehand";
import {
  arrowheadPolylines,
  boundsIntersect,
  elementScenePoints,
} from "./geometry";
import { TEXT_LINE_HEIGHT } from "./create";
import type {
  Bounds,
  LinearElement,
  PolyElement,
  SceneElement,
  Style,
  Vec,
} from "./types";
import { isLinear } from "./types";

interface CachedShape {
  key: string;
  drawable: Drawable;
  heads: Drawable[];
}

interface CachedInk {
  key: string;
  outline: number[][];
}

const shapeCache = new Map<string, CachedShape>();
const inkCache = new Map<string, CachedInk>();

function cacheKey(element: SceneElement) {
  const geometry = isLinear(element)
    ? elementScenePoints(element)
        .map((point) => `${point.x},${point.y}`)
        .join(";")
    : `${element.x},${element.y},${element.w},${element.h}`;
  return [
    element.id,
    element.version,
    geometry,
    element.stroke,
    element.background,
    element.fillStyle,
    element.strokeWidth,
    element.strokeStyle,
    element.roughness,
    element.seed,
  ].join(":");
}

function trimCaches() {
  if (shapeCache.size > 900) shapeCache.clear();
  if (inkCache.size > 900) inkCache.clear();
}

function dashFor(style: Style) {
  if (style.strokeStyle === "dashed") return [9, 9];
  if (style.strokeStyle === "dotted") return [1, 7];
  return undefined;
}

function optionsFor(element: SceneElement): Options {
  const filled = element.background !== "transparent";
  return {
    stroke: element.stroke,
    strokeWidth: element.strokeWidth,
    roughness: element.roughness,
    seed: element.seed,
    strokeLineDash: dashFor(element),
    preserveVertices: true,
    ...(filled
      ? {
          fill: element.background,
          fillStyle: element.fillStyle,
          fillWeight: Math.max(element.strokeWidth / 2, 1),
          hachureGap: Math.max(4, element.strokeWidth * 4),
          hachureAngle: -41,
        }
      : {}),
  };
}

function pathFor(points: Vec[]) {
  if (points.length === 4) {
    return `M ${points[0].x} ${points[0].y} C ${points[1].x} ${points[1].y}, ${points[2].x} ${points[2].y}, ${points[3].x} ${points[3].y}`;
  }
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

function buildShape(element: SceneElement): CachedShape {
  const key = cacheKey(element);
  const cached = shapeCache.get(element.id);
  if (cached && cached.key === key) {
    return cached;
  }

  const generator = rough.generator();
  const options = optionsFor(element);
  let drawable: Drawable;

  if (element.kind === "rect") {
    drawable = generator.rectangle(element.x, element.y, element.w, element.h, options);
  } else if (element.kind === "ellipse") {
    drawable = generator.ellipse(
      element.x + element.w / 2,
      element.y + element.h / 2,
      element.w,
      element.h,
      options,
    );
  } else if (isLinear(element)) {
    const points = elementScenePoints(element);
    if (element.kind === "line") {
      const [from, to] = points;
      drawable = generator.line(from.x, from.y, to.x, to.y, options);
    } else if (element.kind === "draw") {
      drawable = generator.line(0, 0, 0, 0, options);
    } else {
      drawable = generator.path(pathFor(points), options);
    }
  } else {
    const polygon = element as PolyElement;
    const points = polygon.points.map((point) => ({
      x: polygon.x + point.x * polygon.w,
      y: polygon.y + point.y * polygon.h,
    }));
    drawable = generator.polygon(
      points.map((point) => [point.x, point.y]),
      options,
    );
  }

  const heads: Drawable[] = [];
  if (element.kind === "arrow" && isLinear(element)) {
    const size =
      14 + element.strokeWidth * 2 + Math.min(8, Math.hypot(element.w, element.h) * 0.02);
    const polylines = arrowheadPolylines(element, size);
    for (const polyline of polylines) {
      heads.push(
        generator.linearPath(
          polyline.map((point) => [point.x, point.y]),
          { ...options, fill: undefined, strokeLineDash: undefined, seed: element.seed + 1 },
        ),
      );
    }
  }

  const entry = { key, drawable, heads };
  shapeCache.set(element.id, entry);
  trimCaches();
  return entry;
}

function inkOutline(points: Vec[], width: number): number[][] {
  return getStroke(
    points.map((point) => [point.x, point.y]),
    {
      size: Math.max(3.2, width * 3.4),
      thinning: 0.56,
      smoothing: 0.54,
      streamline: 0.48,
      simulatePressure: true,
      last: true,
    },
  );
}

export function drawInk(
  ctx: CanvasRenderingContext2D,
  points: Vec[],
  style: Style,
) {
  if (points.length < 2) return;
  const outline = inkOutline(points, style.strokeWidth);
  if (outline.length < 2) return;

  ctx.save();
  ctx.globalAlpha = style.opacity;
  ctx.fillStyle = style.stroke;
  ctx.beginPath();
  ctx.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) {
    const [x0, y0] = outline[i - 1];
    const [x1, y1] = outline[i];
    ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawElementInk(
  ctx: CanvasRenderingContext2D,
  element: LinearElement,
) {
  const key = cacheKey(element);
  const cached = inkCache.get(element.id);
  let outline = cached?.key === key ? cached.outline : null;
  if (!outline) {
    outline = inkOutline(elementScenePoints(element), element.strokeWidth);
    inkCache.set(element.id, { key, outline });
    trimCaches();
  }
  if (outline.length < 2) return;

  ctx.save();
  ctx.globalAlpha = element.opacity;
  ctx.fillStyle = element.stroke;
  ctx.beginPath();
  ctx.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) {
    const [x0, y0] = outline[i - 1];
    const [x1, y1] = outline[i];
    ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, element: SceneElement & { kind: "text" }) {
  const lines = element.text.split("\n");
  ctx.save();
  ctx.globalAlpha = element.opacity;
  ctx.fillStyle = element.stroke;
  ctx.textBaseline = "top";
  ctx.font = `500 ${element.fontSize}px Caveat, cursive`;
  const lineHeight = element.fontSize * TEXT_LINE_HEIGHT;
  lines.forEach((line, index) => {
    ctx.fillText(line, element.x, element.y + index * lineHeight);
  });
  ctx.restore();
}

export function renderElements(
  ctx: CanvasRenderingContext2D,
  renderer: RoughCanvas,
  elements: SceneElement[],
  options: { hideId?: string | null; cull?: Bounds | null } = {},
) {
  const { hideId = null, cull = null } = options;
  for (const element of elements) {
    if (element.id === hideId) continue;
    if (
      cull &&
      !boundsIntersect(cull, {
        x: element.x,
        y: element.y,
        w: element.w,
        h: element.h,
      })
    ) {
      continue;
    }

    if (element.kind === "text") {
      drawText(ctx, element);
    } else if (element.kind === "draw") {
      drawElementInk(ctx, element);
    } else {
      const cached = buildShape(element);
      ctx.save();
      ctx.globalAlpha = element.opacity;
      renderer.draw(cached.drawable);
      for (const head of cached.heads) {
        renderer.draw(head);
      }
      ctx.restore();
    }
  }
}

export function createRenderer(canvas: HTMLCanvasElement) {
  return rough.canvas(canvas);
}
