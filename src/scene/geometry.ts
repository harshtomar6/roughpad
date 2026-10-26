import type {
  Bounds,
  LinearElement,
  SceneElement,
  Vec,
  Viewport,
} from "./types";
import { isLinear } from "./types";

export const MIN_ELEMENT_SIZE = 3;
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 5;

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

export function randomSeed() {
  return Math.floor(Math.random() * 2_000_000_000) + 1;
}

export function boundsOfPoints(points: Vec[], pad = 0): Bounds {
  if (points.length === 0) {
    return { x: 0, y: 0, w: 1, h: 1 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return {
    x: minX - pad,
    y: minY - pad,
    w: Math.max(maxX - minX + pad * 2, 1),
    h: Math.max(maxY - minY + pad * 2, 1),
  };
}

export function unionBounds(bounds: Bounds[]): Bounds {
  if (bounds.length === 0) {
    return { x: 0, y: 0, w: 0, h: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of bounds) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function boundsOfElement(element: SceneElement): Bounds {
  return { x: element.x, y: element.y, w: element.w, h: element.h };
}

export function expandBounds(bounds: Bounds, amount: number): Bounds {
  return {
    x: bounds.x - amount,
    y: bounds.y - amount,
    w: bounds.w + amount * 2,
    h: bounds.h + amount * 2,
  };
}

export function normalizePoints(points: Vec[], bounds: Bounds): Vec[] {
  return points.map((point) => ({
    x: (point.x - bounds.x) / bounds.w,
    y: (point.y - bounds.y) / bounds.h,
  }));
}

export function elementScenePoints(
  element: SceneElement,
  start = 0,
  end?: number,
): Vec[] {
  if (!isLinear(element)) {
    return [];
  }
  const points = end == null ? element.points : element.points.slice(start, end);
  return points.map((point) => ({
    x: element.x + point.x * element.w,
    y: element.y + point.y * element.h,
  }));
}

export function pathLength(points: Vec[]) {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(
      points[i].x - points[i - 1].x,
      points[i].y - points[i - 1].y,
    );
  }
  return length;
}

export function distanceToSegment(point: Vec, a: Vec, b: Vec) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return Math.hypot(point.x - a.x, point.y - a.y);
  }
  let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared;
  t = clamp(t, 0, 1);
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

export function cubicPoint(
  from: Vec,
  control1: Vec,
  control2: Vec,
  to: Vec,
  t: number,
): Vec {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return {
    x: a * from.x + b * control1.x + c * control2.x + d * to.x,
    y: a * from.y + b * control1.y + c * control2.y + d * to.y,
  };
}

export function sampleCurve(points: Vec[], samples = 24): Vec[] {
  if (points.length < 4) {
    return points;
  }
  const [from, control1, control2, to] = points;
  const result: Vec[] = [];
  for (let i = 0; i <= samples; i++) {
    result.push(cubicPoint(from, control1, control2, to, i / samples));
  }
  return result;
}

export function hitTestElement(
  element: SceneElement,
  point: Vec,
  tolerance: number,
): boolean {
  const b = boundsOfElement(element);
  const inBox =
    point.x >= b.x - tolerance &&
    point.x <= b.x + b.w + tolerance &&
    point.y >= b.y - tolerance &&
    point.y <= b.y + b.h + tolerance;

  if (!inBox) {
    return false;
  }

  if (element.kind === "text" || element.kind === "rect" || element.kind === "ellipse") {
    return true;
  }

  if (!isLinear(element)) {
    return true;
  }

  const scenePoints = elementScenePoints(element);
  if (element.kind === "curve" || element.kind === "arrow") {
    const sampled = sampleCurve(scenePoints);
    for (let i = 1; i < sampled.length; i++) {
      if (distanceToSegment(point, sampled[i - 1], sampled[i]) <= tolerance + element.strokeWidth / 2) {
        return true;
      }
    }
    return false;
  }

  if (element.kind === "draw") {
    for (let i = 1; i < scenePoints.length; i++) {
      if (distanceToSegment(point, scenePoints[i - 1], scenePoints[i]) <= tolerance + element.strokeWidth / 2) {
        return true;
      }
    }
    return false;
  }

  if (scenePoints.length < 2) {
    return false;
  }
  return (
    distanceToSegment(point, scenePoints[0], scenePoints[scenePoints.length - 1]) <=
    tolerance + element.strokeWidth / 2
  );
}

export function hitTest(
  elements: SceneElement[],
  point: Vec,
  tolerance: number,
): SceneElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    if (hitTestElement(elements[i], point, tolerance)) {
      return elements[i];
    }
  }
  return null;
}

export function boundsIntersect(a: Bounds, b: Bounds) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export function resizeBounds(
  original: Bounds,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  keepAspect = false,
): Bounds {
  let left = original.x;
  let top = original.y;
  let right = original.x + original.w;
  let bottom = original.y + original.h;

  if (handle.includes("w")) left += dx;
  if (handle.includes("e")) right += dx;
  if (handle.includes("n")) top += dy;
  if (handle.includes("s")) bottom += dy;

  if (right - left < MIN_ELEMENT_SIZE) {
    if (handle.includes("w")) left = right - MIN_ELEMENT_SIZE;
    else right = left + MIN_ELEMENT_SIZE;
  }
  if (bottom - top < MIN_ELEMENT_SIZE) {
    if (handle.includes("n")) top = bottom - MIN_ELEMENT_SIZE;
    else bottom = top + MIN_ELEMENT_SIZE;
  }

  if (keepAspect && original.w > 0 && original.h > 0) {
    const aspect = original.w / original.h;
    if (handle === "nw" || handle === "ne" || handle === "se" || handle === "sw") {
      const width = right - left;
      const height = bottom - top;
      if (Math.abs(width / aspect) > Math.abs(height)) {
        const targetHeight = width / aspect;
        if (handle.includes("n")) top = bottom - targetHeight;
        else bottom = top + targetHeight;
      } else {
        const targetWidth = height * aspect;
        if (handle.includes("w")) left = right - targetWidth;
        else right = left + targetWidth;
      }
    }
  }

  return { x: left, y: top, w: right - left, h: bottom - top };
}

export function withEndpoint(
  element: LinearElement,
  index: number,
  point: Vec,
): LinearElement {
  const points = elementScenePoints(element);
  if (index < 0 || index >= points.length) {
    return element;
  }
  points[index] = point;
  const bounds = boundsOfPoints(points);
  return {
    ...element,
    x: bounds.x,
    y: bounds.y,
    w: bounds.w,
    h: bounds.h,
    points: normalizePoints(points, bounds),
    version: element.version + 1,
  };
}

export function translateElement(element: SceneElement, dx: number, dy: number): SceneElement {
  return {
    ...element,
    x: element.x + dx,
    y: element.y + dy,
    version: element.version + 1,
  };
}

export function screenToScene(
  screen: Vec,
  viewport: Viewport,
): Vec {
  return {
    x: (screen.x - viewport.x) / viewport.zoom,
    y: (screen.y - viewport.y) / viewport.zoom,
  };
}

export function sceneToScreen(point: Vec, viewport: Viewport): Vec {
  return {
    x: point.x * viewport.zoom + viewport.x,
    y: point.y * viewport.zoom + viewport.y,
  };
}

export function zoomAt(
  viewport: Viewport,
  screen: Vec,
  factor: number,
): Viewport {
  const zoom = clamp(viewport.zoom * factor, ZOOM_MIN, ZOOM_MAX);
  const sceneX = (screen.x - viewport.x) / viewport.zoom;
  const sceneY = (screen.y - viewport.y) / viewport.zoom;
  return {
    zoom,
    x: screen.x - sceneX * zoom,
    y: screen.y - sceneY * zoom,
  };
}

export function fitViewport(
  bounds: Bounds,
  width: number,
  height: number,
  padding = 110,
): Viewport {
  if (bounds.w <= 0 || bounds.h <= 0 || width <= 0 || height <= 0) {
    return { x: 0, y: 0, zoom: 1 };
  }
  const zoom = clamp(
    Math.min(
      (width - padding * 2) / bounds.w,
      (height - padding * 2) / bounds.h,
      1.4,
    ),
    ZOOM_MIN,
    ZOOM_MAX,
  );
  return {
    zoom,
    x: width / 2 - (bounds.x + bounds.w / 2) * zoom,
    y: height / 2 - (bounds.y + bounds.h / 2) * zoom,
  };
}

export function arrowheadPolylines(
  element: LinearElement,
  size: number,
): Vec[][] {
  const points = elementScenePoints(element);
  if (points.length < 2) {
    return [];
  }

  const isCurve = element.kind === "curve" || element.kind === "arrow";
  const from = points[0];
  const to = points[points.length - 1];
  const tail = isCurve && points.length >= 4 ? points[1] : points[1];
  const prev = isCurve && points.length >= 4 ? points[points.length - 2] : points[points.length - 2];

  const result: Vec[][] = [];

  const makeHead = (tip: Vec, direction: Vec) => {
    const length = Math.hypot(direction.x, direction.y);
    if (length === 0) return;
    const ux = direction.x / length;
    const uy = direction.y / length;
    const angle = 0.48;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const barb1 = {
      x: tip.x - (ux * cos - uy * sin) * size,
      y: tip.y - (ux * sin + uy * cos) * size,
    };
    const barb2 = {
      x: tip.x - (ux * cos + uy * sin) * size,
      y: tip.y - (-ux * sin + uy * cos) * size,
    };
    result.push([barb1, tip, barb2]);
  };

  if (element.headStart) {
    const direction = {
      x: from.x - tail.x,
      y: from.y - tail.y,
    };
    makeHead(from, direction);
  }
  if (element.headEnd) {
    const direction = {
      x: to.x - prev.x,
      y: to.y - prev.y,
    };
    makeHead(to, direction);
  }

  return result;
}

export function elementBoundsAll(elements: SceneElement[]): Bounds | null {
  if (elements.length === 0) {
    return null;
  }
  const padding = 12;
  return expandBounds(unionBounds(elements.map(boundsOfElement)), padding);
}
