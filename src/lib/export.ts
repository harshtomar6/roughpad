import { createRenderer, renderElements } from "../scene/render";
import { boundsOfElement, unionBounds } from "../scene/geometry";
import type { SceneElement } from "../scene/types";

export async function exportPng(elements: SceneElement[]) {
  if (elements.length === 0) return;

  await document.fonts.ready;

  const padding = 36;
  const raw = unionBounds(elements.map(boundsOfElement));
  const width = raw.w + padding * 2;
  const height = raw.h + padding * 2;
  const maxSide = 8000;
  const scale = Math.max(0.5, Math.min(2, maxSide / Math.max(width, height)));

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#fcfbf7";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(
    scale,
    0,
    0,
    scale,
    (-raw.x + padding) * scale,
    (-raw.y + padding) * scale,
  );

  const renderer = createRenderer(canvas);
  renderElements(ctx, renderer, elements);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) return;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  link.download = `roughpad-${date}.png`;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
