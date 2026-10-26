import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { RoughCanvas } from "roughjs/bin/canvas";
import {
  boundsIntersect,
  elementScenePoints,
  hitTest,
  hitTestElement,
  pathLength,
  resizeBounds,
  sceneToScreen,
  screenToScene,
  unionBounds,
  withEndpoint,
  zoomAt,
  type ResizeHandle,
} from "../scene/geometry";
import { inkElement, shapeToElement } from "../scene/create";
import { createRenderer, drawInk, renderElements } from "../scene/render";
import type {
  Bounds,
  Draft,
  LinearElement,
  Marquee,
  SceneElement,
  Style,
  TextElement,
  Tool,
  Vec,
  Viewport,
} from "../scene/types";
import { SHAPE_LABELS, isLinear, isText } from "../scene/types";

type HandleHit =
  | { type: "resize"; handle: ResizeHandle }
  | { type: "endpoint"; index: number };

interface DrawInteraction {
  type: "draw";
  points: Vec[];
  last: Vec;
  tool: Tool;
  style: Style;
  token: number;
}

interface MoveInteraction {
  type: "move";
  start: Vec;
  ids: string[];
  snapshot: SceneElement[];
  changed: boolean;
}

interface ResizeInteraction {
  type: "resize";
  start: Vec;
  handle: ResizeHandle;
  snapshot: SceneElement[];
  original: SceneElement;
  changed: boolean;
}

interface EndpointInteraction {
  type: "endpoint";
  start: Vec;
  index: number;
  snapshot: SceneElement[];
  original: LinearElement;
  changed: boolean;
}

interface PanInteraction {
  type: "pan";
  startScreen: Vec;
  startViewport: Viewport;
}

interface EraseInteraction {
  type: "erase";
  snapshot: SceneElement[];
}

interface MarqueeInteraction {
  type: "marquee";
  start: Vec;
  base: string[];
}

type Interaction =
  | DrawInteraction
  | MoveInteraction
  | ResizeInteraction
  | EndpointInteraction
  | PanInteraction
  | EraseInteraction
  | MarqueeInteraction;

interface CanvasProps {
  elements: SceneElement[];
  selection: string[];
  setSelection: (ids: string[]) => void;
  tool: Tool;
  style: Style;
  viewport: Viewport;
  setViewport: (next: Viewport | ((previous: Viewport) => Viewport)) => void;
  onLiveElements: (updater: (previous: SceneElement[]) => SceneElement[]) => void;
  onCommitSnapshot: (snapshot: SceneElement[]) => void;
  onAddElement: (element: SceneElement) => void;
  onNotify: (message: string) => void;
  recognize:
    | ((
        points: Vec[],
        options?: { rotation?: "snapped" | "upright" | "free" },
      ) => Promise<import("@desert-ant-labs/shapes").Shape | null>)
    | null;
  editing: boolean;
  editingId: string | null;
  onStartText: (point: Vec, centered?: boolean) => void;
  onEditText: (element: TextElement) => void;
}

const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  nw: "nwse-resize",
  n: "ns-resize",
  ne: "nesw-resize",
  e: "ew-resize",
  se: "nwse-resize",
  s: "ns-resize",
  sw: "nesw-resize",
  w: "ew-resize",
};

function handleScenePoints(bounds: Bounds): { key: ResizeHandle; point: Vec }[] {
  const { x, y, w, h } = bounds;
  return [
    { key: "nw", point: { x, y } },
    { key: "n", point: { x: x + w / 2, y } },
    { key: "ne", point: { x: x + w, y } },
    { key: "e", point: { x: x + w, y: y + h / 2 } },
    { key: "se", point: { x: x + w, y: y + h } },
    { key: "s", point: { x: x + w / 2, y: y + h } },
    { key: "sw", point: { x, y: y + h } },
    { key: "w", point: { x, y: y + h / 2 } },
  ];
}

function canResize(element: SceneElement) {
  return !isText(element);
}

function hasEndpointHandles(element: SceneElement) {
  return isLinear(element) && element.kind !== "draw";
}

export function Canvas({
  elements,
  selection,
  setSelection,
  tool,
  style,
  viewport,
  setViewport,
  onLiveElements,
  onCommitSnapshot,
  onAddElement,
  onNotify,
  recognize,
  editing,
  editingId,
  onStartText,
  onEditText,
}: CanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<RoughCanvas | null>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const spaceRef = useRef(false);
  const finishTokenRef = useRef(0);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const [cursor, setCursor] = useState("default");
  const [fontsReady, setFontsReady] = useState(false);

  const elementsRef = useRef(elements);

  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) {
        setSize({ width: rect.width, height: rect.height });
      }
    });
    observer.observe(element);
    setSize({
      width: element.clientWidth,
      height: element.clientHeight,
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let alive = true;
    document.fonts
      .load('500 24px "Caveat"')
      .then(() => {
        if (alive) setFontsReady(true);
      })
      .catch(() => {
        if (alive) setFontsReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const point = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      if (event.ctrlKey || event.metaKey) {
        const factor = Math.exp(-event.deltaY * 0.011);
        setViewport((previous) => zoomAt(previous, point, factor));
      } else {
        setViewport((previous) => ({
          ...previous,
          x: previous.x - event.deltaX,
          y: previous.y - event.deltaY,
        }));
      }
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [setViewport]);

  useEffect(() => {
    const isEditable = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      return (
        element?.tagName === "TEXTAREA" ||
        element?.tagName === "INPUT" ||
        element?.isContentEditable === true
      );
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || isEditable(event.target) || editing) {
        return;
      }
      if (!event.repeat) {
        event.preventDefault();
        spaceRef.current = true;
        setCursor("grab");
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      spaceRef.current = false;
      if (!isEditable(event.target)) {
        setCursor(tool === "hand" ? "grab" : "default");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [editing, tool]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0 || size.height === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const pixelWidth = Math.round(size.width * dpr);
    const pixelHeight = Math.round(size.height * dpr);
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;

    if (!rendererRef.current) {
      rendererRef.current = createRenderer(canvas);
    }
    const renderer = rendererRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y, zoom } = viewport;
    const cull: Bounds = {
      x: -x / zoom - 80,
      y: -y / zoom - 80,
      w: size.width / zoom + 160,
      h: size.height / zoom + 160,
    };

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
    ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, dpr * x, dpr * y);
    renderElements(ctx, renderer, elements, { hideId: editingId, cull });

    if (draft && draft.points.length > 1) {
      const points = draft.points;
      drawInk(ctx, points, draft.style);
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const selected = elements.filter((element) => selection.includes(element.id));
    if (selected.length > 0 && draft == null) {
      drawSelection(
        ctx,
        selected,
        selection.length === 1 ? selected[0] : null,
        viewport,
        tool === "select" && !editing,
      );
    }

    if (marquee) {
      const a = sceneToScreen(marquee.start, viewport);
      const b = sceneToScreen(marquee.current, viewport);
      const left = Math.min(a.x, b.x);
      const top = Math.min(a.y, b.y);
      const width = Math.abs(b.x - a.x);
      const height = Math.abs(b.y - a.y);
      ctx.save();
      ctx.fillStyle = "rgba(91, 87, 209, 0.09)";
      ctx.strokeStyle = "rgba(91, 87, 209, 0.7)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.fillRect(left, top, width, height);
      ctx.strokeRect(left + 0.5, top + 0.5, width, height);
      ctx.restore();
    }

    if (draft?.pending) {
      const last = draft.points[draft.points.length - 1];
      const point = sceneToScreen(last, viewport);
      ctx.save();
      ctx.fillStyle = "rgba(91, 87, 209, 0.85)";
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }, [
    elements,
    selection,
    viewport,
    size,
    draft,
    marquee,
    editing,
    editingId,
    tool,
    fontsReady,
  ]);

  const commitText = useCallback(
    (points: Vec[], strokeStyle: Style, strokeTool: Tool, token: number) => {
      const length = pathLength(points);
      const keepInk = () => {
        onAddElement(inkElement(points, strokeStyle));
        if (finishTokenRef.current === token) setDraft(null);
      };

      if (points.length < 3 || length < 8) {
        if (finishTokenRef.current === token) setDraft(null);
        return;
      }

      if (strokeTool !== "pen" || !recognize) {
        keepInk();
        return;
      }

      void recognize(points, { rotation: "upright" })
        .then((shape) => {
          if (!shape) {
            onAddElement(inkElement(points, strokeStyle));
            return;
          }
          const element = shapeToElement(shape, strokeStyle);
          if (!element) {
            onAddElement(inkElement(points, strokeStyle));
            return;
          }
          onAddElement(element);
          onNotify(`Snapped to ${SHAPE_LABELS[shape.kind] ?? shape.kind}`);
        })
        .catch(() => {
          onAddElement(inkElement(points, strokeStyle));
        })
        .finally(() => {
          if (finishTokenRef.current === token) setDraft(null);
        });
    },
    [onAddElement, onNotify, recognize],
  );

  const handleHit = (screen: Vec): HandleHit | null => {
    if (tool !== "select" || selection.length !== 1 || editing) return null;
    const element = elements.find((candidate) => candidate.id === selection[0]);
    if (!element) return null;

    if (hasEndpointHandles(element)) {
      const points = elementScenePoints(element);
      const endpoints = [points[0], points[points.length - 1]];
      for (let index = 0; index < endpoints.length; index++) {
        const position = sceneToScreen(endpoints[index], viewport);
        if (Math.hypot(position.x - screen.x, position.y - screen.y) <= 10) {
          return { type: "endpoint", index: index === 0 ? 0 : points.length - 1 };
        }
      }
      return null;
    }

    if (!canResize(element)) return null;
    for (const handle of handleScenePoints(element)) {
      const position = sceneToScreen(handle.point, viewport);
      if (Math.hypot(position.x - screen.x, position.y - screen.y) <= 9) {
        return { type: "resize", handle: handle.key };
      }
    }
    return null;
  };

  const getCursorFor = (scene: Vec): string => {
    if (spaceRef.current) return "grab";
    if (tool === "hand") return "grab";
    if (tool === "pen" || tool === "ink" || tool === "eraser") return "crosshair";
    if (tool === "text") return "text";
    const canvas = canvasRef.current;
    if (canvas) {
      const screen = sceneToScreen(scene, viewport);
      const hit = handleHit(screen);
      if (hit) {
        if (hit.type === "endpoint") return "crosshair";
        return HANDLE_CURSORS[hit.handle];
      }
    }
    return hitTest(elements, scene, 8 / viewport.zoom) ? "move" : "default";
  };

  const eraseAt = (scene: Vec) => {
    const tolerance = 12 / viewport.zoom;
    onLiveElements((previous) => {
      const remaining = previous.filter(
        (element) => !hitTestElement(element, scene, tolerance),
      );
      return remaining.length === previous.length ? previous : remaining;
    });
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (event.button !== 0 && event.button !== 1) return;
    if (editing) return;

    const rect = canvas.getBoundingClientRect();
    const screen = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    const scene = screenToScene(screen, viewport);
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);

    if (event.button === 1 || tool === "hand" || spaceRef.current) {
      interactionRef.current = {
        type: "pan",
        startScreen: screen,
        startViewport: viewport,
      };
      setCursor("grabbing");
      return;
    }

    if ((tool === "pen" || tool === "ink") && event.detail > 1) {
      event.preventDefault();
      return;
    }

    if (tool === "select") {
      const handle = handleHit(screen);
      if (handle && selection.length === 1) {
        const original = elements.find((element) => element.id === selection[0]);
        if (original) {
          if (handle.type === "endpoint" && isLinear(original)) {
            interactionRef.current = {
              type: "endpoint",
              start: scene,
              index: handle.index,
              snapshot: elements,
              original,
              changed: false,
            };
          } else if (handle.type === "resize") {
            interactionRef.current = {
              type: "resize",
              start: scene,
              handle: handle.handle,
              snapshot: elements,
              original,
              changed: false,
            };
          }
          return;
        }
      }

      const hit = hitTest(elements, scene, 8 / viewport.zoom);
      if (hit) {
        let nextSelection = selection;
        if (event.shiftKey) {
          nextSelection = selection.includes(hit.id)
            ? selection.filter((id) => id !== hit.id)
            : [...selection, hit.id];
          setSelection(nextSelection);
          if (!nextSelection.includes(hit.id)) {
            return;
          }
        } else if (!selection.includes(hit.id)) {
          nextSelection = [hit.id];
          setSelection(nextSelection);
        }
        interactionRef.current = {
          type: "move",
          start: scene,
          ids: nextSelection,
          snapshot: elements,
          changed: false,
        };
        setCursor("move");
        return;
      }

      const base = event.shiftKey ? selection : [];
      if (!event.shiftKey) setSelection([]);
      const nextMarquee = { start: scene, current: scene, base };
      setMarquee(nextMarquee);
      interactionRef.current = {
        type: "marquee",
        start: scene,
        base,
      };
      return;
    }

    if (tool === "text") {
      const text = [...elements]
        .reverse()
        .find(
          (element) =>
            element.kind === "text" &&
            hitTestElement(element, scene, 4 / viewport.zoom),
        );
      if (text && isText(text)) {
        onEditText(text);
      } else {
        onStartText(scene);
      }
      return;
    }

    if (tool === "eraser") {
      if (selection.length > 0) setSelection([]);
      interactionRef.current = { type: "erase", snapshot: elements };
      eraseAt(scene);
      return;
    }

    if (selection.length > 0) setSelection([]);
    const token = ++finishTokenRef.current;
    const nextStyle = { ...style };
    interactionRef.current = {
      type: "draw",
      points: [scene],
      last: scene,
      tool,
      style: nextStyle,
      token,
    };
    setDraft({ points: [scene], style: nextStyle, pending: false });
    setCursor("crosshair");
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const screen = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    const scene = screenToScene(screen, viewport);
    const interaction = interactionRef.current;

    if (!interaction) {
      setCursor((previous) => {
        const next = getCursorFor(scene);
        return next === previous ? previous : next;
      });
      return;
    }

    if (interaction.type === "pan") {
      setViewport({
        ...interaction.startViewport,
        x:
          interaction.startViewport.x +
          (screen.x - interaction.startScreen.x),
        y:
          interaction.startViewport.y +
          (screen.y - interaction.startScreen.y),
      });
      return;
    }

    if (interaction.type === "draw") {
      const events =
        typeof event.nativeEvent.getCoalescedEvents === "function"
          ? event.nativeEvent.getCoalescedEvents()
          : [event.nativeEvent];
      for (const native of events) {
        const point = screenToScene(
          { x: native.clientX - rect.left, y: native.clientY - rect.top },
          viewport,
        );
        const previous = interaction.points[interaction.points.length - 1];
        if (Math.hypot(point.x - previous.x, point.y - previous.y) > 0.7 / viewport.zoom) {
          interaction.points.push(point);
          interaction.last = point;
        }
      }
      setDraft({
        points: [...interaction.points],
        style: interaction.style,
        pending: false,
      });
      return;
    }

    if (interaction.type === "move") {
      let dx = scene.x - interaction.start.x;
      let dy = scene.y - interaction.start.y;
      if (event.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      if (dx === 0 && dy === 0) return;
      interaction.changed = true;
      const originals = new Map(interaction.snapshot.map((element) => [element.id, element]));
      onLiveElements((previous) =>
        previous.map((element) => {
          if (!interaction.ids.includes(element.id)) return element;
          const original = originals.get(element.id);
          if (!original) return element;
          return {
            ...original,
            x: original.x + dx,
            y: original.y + dy,
            version: original.version + 1,
          };
        }),
      );
      return;
    }

    if (interaction.type === "resize") {
      let dx = scene.x - interaction.start.x;
      let dy = scene.y - interaction.start.y;
      if (event.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      if (dx === 0 && dy === 0) return;
      interaction.changed = true;
      const bounds = resizeBounds(
        {
          x: interaction.original.x,
          y: interaction.original.y,
          w: interaction.original.w,
          h: interaction.original.h,
        },
        interaction.handle,
        dx,
        dy,
        event.shiftKey,
      );
      onLiveElements((previous) =>
        previous.map((element) =>
          element.id === interaction.original.id
            ? { ...interaction.original, ...bounds, version: interaction.original.version + 1 }
            : element,
        ),
      );
      return;
    }

    if (interaction.type === "endpoint") {
      const dx = scene.x - interaction.start.x;
      const dy = scene.y - interaction.start.y;
      if (dx === 0 && dy === 0) return;
      interaction.changed = true;
      const updated = withEndpoint(interaction.original, interaction.index, scene);
      onLiveElements((previous) =>
        previous.map((element) =>
          element.id === interaction.original.id ? updated : element,
        ),
      );
      return;
    }

    if (interaction.type === "erase") {
      eraseAt(scene);
      return;
    }

    if (interaction.type === "marquee") {
      const next = {
        start: interaction.start,
        current: scene,
        base: interaction.base,
      };
      setMarquee(next);
      const bounds = {
        x: Math.min(interaction.start.x, scene.x),
        y: Math.min(interaction.start.y, scene.y),
        w: Math.abs(scene.x - interaction.start.x),
        h: Math.abs(scene.y - interaction.start.y),
      };
      const hits = elementsRef.current
        .filter((element) =>
          boundsIntersect(bounds, {
            x: element.x,
            y: element.y,
            w: element.w,
            h: element.h,
          }),
        )
        .map((element) => element.id);
      setSelection([...new Set([...interaction.base, ...hits])]);
      return;
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const interaction = interactionRef.current;
    interactionRef.current = null;
    if (canvas?.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }

    if (!interaction) return;

    if (interaction.type === "draw") {
      setDraft({
        points: [...interaction.points],
        style: interaction.style,
        pending: true,
      });
      commitText(interaction.points, interaction.style, interaction.tool, interaction.token);
      return;
    }

    if (interaction.type === "move" && interaction.changed) {
      onCommitSnapshot(interaction.snapshot);
    }
    if (interaction.type === "resize" && interaction.changed) {
      onCommitSnapshot(interaction.snapshot);
    }
    if (interaction.type === "endpoint" && interaction.changed) {
      onCommitSnapshot(interaction.snapshot);
    }
    if (interaction.type === "erase") {
      onCommitSnapshot(interaction.snapshot);
    }
    if (interaction.type === "marquee") {
      setMarquee(null);
    }

    const scene = screenToScene(
      {
        x: event.clientX - (canvas?.getBoundingClientRect().left ?? 0),
        y: event.clientY - (canvas?.getBoundingClientRect().top ?? 0),
      },
      viewport,
    );
    setCursor(getCursorFor(scene));
  };

  const handlePointerCancel = () => {
    const interaction = interactionRef.current;
    interactionRef.current = null;
    if (interaction?.type === "move" && interaction.changed) {
      onCommitSnapshot(interaction.snapshot);
    }
    if (interaction?.type === "resize" && interaction.changed) {
      onCommitSnapshot(interaction.snapshot);
    }
    if (interaction?.type === "endpoint" && interaction.changed) {
      onCommitSnapshot(interaction.snapshot);
    }
    if (interaction?.type === "erase") {
      onCommitSnapshot(interaction.snapshot);
    }
    if (interaction?.type === "draw") {
      setDraft(null);
    }
    setMarquee(null);
    setCursor("default");
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === "hand" || editing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scene = screenToScene(
      { x: event.clientX - rect.left, y: event.clientY - rect.top },
      viewport,
    );
    const text = [...elements]
      .reverse()
      .find(
        (element) =>
          element.kind === "text" &&
          hitTestElement(element, scene, 4 / viewport.zoom),
      );
    if (text && isText(text)) {
      onEditText(text);
      return;
    }

    const shape = [...elements]
      .reverse()
      .find(
        (element) =>
          !isText(element) &&
          hitTestElement(element, scene, 8 / viewport.zoom),
      );
    if (shape) {
      const label = [...elements].reverse().find((element) => {
        if (!isText(element)) return false;
        const centerX = element.x + element.w / 2;
        const centerY = element.y + element.h / 2;
        return (
          centerX >= shape.x &&
          centerX <= shape.x + shape.w &&
          centerY >= shape.y &&
          centerY <= shape.y + shape.h
        );
      });
      if (label && isText(label)) {
        onEditText(label);
        return;
      }
      onStartText(
        { x: shape.x + shape.w / 2, y: shape.y + shape.h / 2 },
        true,
      );
      return;
    }

    if (tool === "select" || tool === "text") {
      onStartText(scene);
    }
  };

  const gridStep = (() => {
    let step = 24 * viewport.zoom;
    while (step < 14) step *= 2;
    while (step > 54) step /= 2;
    return step;
  })();

  return (
    <div
      className="board"
      ref={containerRef}
      style={{
        cursor,
        backgroundSize: `${gridStep}px ${gridStep}px`,
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
      }}
    >
      <canvas
        ref={canvasRef}
        className="board-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onDoubleClick={handleDoubleClick}
      />
    </div>
  );
}

function drawSelection(
  ctx: CanvasRenderingContext2D,
  selected: SceneElement[],
  single: SceneElement | null,
  viewport: Viewport,
  showHandles: boolean,
) {
  const accent = "#5b57d1";
  const bounds =
    selected.length === 1
      ? { x: selected[0].x, y: selected[0].y, w: selected[0].w, h: selected[0].h }
      : unionBounds(
          selected.map((element) => ({
            x: element.x,
            y: element.y,
            w: element.w,
            h: element.h,
          })),
        );

  const topLeft = sceneToScreen({ x: bounds.x, y: bounds.y }, viewport);
  const bottomRight = sceneToScreen(
    { x: bounds.x + bounds.w, y: bounds.y + bounds.h },
    viewport,
  );
  const pad = 5;
  const x = topLeft.x - pad;
  const y = topLeft.y - pad;
  const w = bottomRight.x - topLeft.x + pad * 2;
  const h = bottomRight.y - topLeft.y + pad * 2;

  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.4;
  ctx.setLineDash([5, 4]);
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  ctx.setLineDash([]);

  if (!showHandles) {
    ctx.restore();
    return;
  }

  if (single && hasEndpointHandles(single)) {
    const points = elementScenePoints(single);
    const endpoints = [points[0], points[points.length - 1]];
    for (const point of endpoints) {
      const screen = sceneToScreen(point, viewport);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (single && canResize(single)) {
    const handles = handleScenePoints(single);
    for (const handle of handles) {
      const screen = sceneToScreen(handle.point, viewport);
      ctx.beginPath();
      ctx.roundRect(screen.x - 4.5, screen.y - 4.5, 9, 9, 2.5);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
  ctx.restore();
}
