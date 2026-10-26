import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, HelpCircle, Trash2 } from "lucide-react";
import { Canvas } from "./components/Canvas";
import { Toolbar } from "./components/Toolbar";
import { StylePanel } from "./components/StylePanel";
import { ZoomBar } from "./components/ZoomBar";
import { ConfirmDialog, HelpDialog } from "./components/Dialogs";
import { TextEditor } from "./components/TextEditor";
import { useHistory } from "./hooks/useHistory";
import { useShapes } from "./hooks/useShapes";
import { exportPng } from "./lib/export";
import { measureText, textElement } from "./scene/create";
import {
  elementBoundsAll,
  fitViewport,
  makeId,
  randomSeed,
  zoomAt,
} from "./scene/geometry";
import {
  DEFAULT_STYLE,
  styleOf,
  type SceneElement,
  type Style,
  type TextElement,
  type Tool,
  type Vec,
  type Viewport,
} from "./scene/types";

const STORAGE_KEY = "roughpad.board.v1";

interface EditingSession {
  id: string | null;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
  centered: boolean;
}

function isSceneElement(value: unknown): value is SceneElement {
  if (!value || typeof value !== "object") return false;
  const element = value as Record<string, unknown>;
  return (
    typeof element.id === "string" &&
    typeof element.kind === "string" &&
    ["x", "y", "w", "h"].every(
      (key) => typeof element[key] === "number" && Number.isFinite(element[key]),
    )
  );
}

function loadBoard(): SceneElement[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    const list = Array.isArray(parsed)
      ? parsed
      : parsed &&
          typeof parsed === "object" &&
          Array.isArray((parsed as { elements?: unknown }).elements)
        ? (parsed as { elements: unknown[] }).elements
        : [];
    return list.filter(isSceneElement);
  } catch {
    return [];
  }
}

function stylesEqual(a: Style, b: Style) {
  return (
    a.stroke === b.stroke &&
    a.background === b.background &&
    a.fillStyle === b.fillStyle &&
    a.strokeWidth === b.strokeWidth &&
    a.strokeStyle === b.strokeStyle &&
    a.roughness === b.roughness &&
    a.opacity === b.opacity &&
    a.fontSize === b.fontSize
  );
}

export default function App() {
  const [initialElements] = useState<SceneElement[]>(loadBoard);
  const history = useHistory<SceneElement[]>(initialElements);
  const elements = history.present;
  const setElements = history.set;
  const setLiveElements = history.setLive;
  const commitSnapshot = history.commitSnapshot;

  const [selection, setSelection] = useState<string[]>([]);
  const [tool, setTool] = useState<Tool>("pen");
  const [style, setStyle] = useState<Style>(DEFAULT_STYLE);
  const [editing, setEditing] = useState<EditingSession | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const toastTimer = useRef<number | null>(null);
  const toastId = useRef(0);
  const clipboard = useRef<SceneElement[]>([]);
  const shapes = useShapes();

  const [viewport, setViewport] = useState<Viewport>(() => {
    if (initialElements.length === 0) {
      return { x: 0, y: 0, zoom: 1 };
    }
    const bounds = elementBoundsAll(initialElements);
    return bounds
      ? fitViewport(bounds, window.innerWidth, window.innerHeight)
      : { x: 0, y: 0, zoom: 1 };
  });

  const selectedElements = useMemo(
    () => elements.filter((element) => selection.includes(element.id)),
    [elements, selection],
  );
  const firstSelected = selectedElements[0] ?? null;
  const selectedId = firstSelected?.id;
  const selectedVersion = firstSelected?.version;

  useEffect(() => {
    if (!firstSelected) return;
    const next = styleOf(firstSelected);
    setStyle((previous) => (stylesEqual(previous, next) ? previous : next));
  }, [firstSelected, selectedId, selectedVersion]);

  useEffect(() => {
    setSelection((previous) => {
      const next = previous.filter((id) =>
        elements.some((element) => element.id === id),
      );
      return next.length === previous.length ? previous : next;
    });
  }, [elements]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ version: 1, elements }),
        );
      } catch {
        // Storage can be unavailable or full; the board still works in memory.
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [elements]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const notify = useCallback((text: string) => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ id: ++toastId.current, text });
    toastTimer.current = window.setTimeout(() => setToast(null), 1900);
  }, []);

  const modelErrorShown = useRef(false);
  useEffect(() => {
    if (shapes.status === "error" && !modelErrorShown.current) {
      modelErrorShown.current = true;
      notify("Smart shapes unavailable — drawing in ink");
    }
  }, [shapes.status, notify]);

  const changeTool = useCallback((next: Tool) => {
    setTool(next);
    if (next !== "select" && next !== "hand") {
      setSelection([]);
    }
  }, []);

  const applyStyle = useCallback(
    (patch: Partial<Style>) => {
      setStyle((previous) => ({ ...previous, ...patch }));
      if (selection.length > 0) {
        setElements((previous) =>
          previous.map((element) =>
            selection.includes(element.id)
              ? { ...element, ...patch, version: element.version + 1 }
              : element,
          ),
        );
      }
    },
    [selection, setElements],
  );

  const addElement = useCallback(
    (element: SceneElement) => {
      setElements((previous) => [...previous, element]);
    },
    [setElements],
  );

  const deleteSelection = useCallback(() => {
    if (selection.length === 0) return;
    setElements((previous) =>
      previous.filter((element) => !selection.includes(element.id)),
    );
    setSelection([]);
  }, [selection, setElements]);

  const duplicateSelection = useCallback(() => {
    const chosen = elements.filter((element) => selection.includes(element.id));
    if (chosen.length === 0) return;
    const copies = chosen.map((element) => ({
      ...element,
      id: makeId(),
      seed: randomSeed(),
      x: element.x + 24,
      y: element.y + 24,
      version: 1,
    }));
    setElements((previous) => [...previous, ...copies]);
    setSelection(copies.map((element) => element.id));
  }, [elements, selection, setElements]);

  const bringToFront = useCallback(() => {
    if (selection.length === 0) return;
    const ids = new Set(selection);
    setElements((previous) => [
      ...previous.filter((element) => !ids.has(element.id)),
      ...previous.filter((element) => ids.has(element.id)),
    ]);
  }, [selection, setElements]);

  const sendToBack = useCallback(() => {
    if (selection.length === 0) return;
    const ids = new Set(selection);
    setElements((previous) => [
      ...previous.filter((element) => ids.has(element.id)),
      ...previous.filter((element) => !ids.has(element.id)),
    ]);
  }, [selection, setElements]);

  const copySelection = useCallback(() => {
    const chosen = elements.filter((element) => selection.includes(element.id));
    if (chosen.length > 0) clipboard.current = chosen;
  }, [elements, selection]);

  const pasteClipboard = useCallback(() => {
    if (clipboard.current.length === 0) return;
    const copies = clipboard.current.map((element) => ({
      ...element,
      id: makeId(),
      seed: randomSeed(),
      x: element.x + 24,
      y: element.y + 24,
      version: 1,
    }));
    setElements((previous) => [...previous, ...copies]);
    setSelection(copies.map((element) => element.id));
    clipboard.current = copies;
  }, [setElements]);

  const nudge = useCallback(
    (dx: number, dy: number) => {
      if (selection.length === 0) return;
      setElements((previous) =>
        previous.map((element) =>
          selection.includes(element.id)
            ? {
                ...element,
                x: element.x + dx,
                y: element.y + dy,
                version: element.version + 1,
              }
            : element,
        ),
      );
    },
    [selection, setElements],
  );

  const startText = useCallback(
    (point: Vec, centered = false) => {
      setEditing({
        id: null,
        x: point.x,
        y: point.y,
        text: "",
        fontSize: style.fontSize,
        color: style.stroke,
        centered,
      });
    },
    [style.fontSize, style.stroke],
  );

  const editText = useCallback(
    (element: TextElement) => {
      const container = [...elements]
        .reverse()
        .find((candidate) => {
          if (candidate.kind === "text") return false;
          const centerX = element.x + element.w / 2;
          const centerY = element.y + element.h / 2;
          return (
            centerX >= candidate.x &&
            centerX <= candidate.x + candidate.w &&
            centerY >= candidate.y &&
            centerY <= candidate.y + candidate.h
          );
        });
      setEditing({
        id: element.id,
        x: container ? container.x + container.w / 2 : element.x,
        y: container ? container.y + container.h / 2 : element.y,
        text: element.text,
        fontSize: element.fontSize,
        color: element.stroke,
        centered: Boolean(container),
      });
      setSelection([]);
    },
    [elements, setSelection],
  );

  const commitEditing = useCallback(
    (value: string) => {
      const session = editing;
      if (!session) return;
      setEditing(null);
      const text = value.replace(/\s+$/u, "");

      if (session.id) {
        if (!text.trim()) {
          setElements((previous) =>
            previous.filter((element) => element.id !== session.id),
          );
          setSelection([]);
          return;
        }
        const { w, h } = measureText(text, session.fontSize);
        setElements((previous) =>
          previous.map((element) =>
            element.id === session.id
              ? {
                  ...element,
                  text,
                  x: session.centered ? session.x - w / 2 : session.x,
                  y: session.centered ? session.y - h / 2 : session.y,
                  w,
                  h,
                  fontSize: session.fontSize,
                  stroke: session.color,
                  version: element.version + 1,
                }
              : element,
          ),
        );
        setSelection([session.id]);
        return;
      }

      if (text.trim()) {
        const element = textElement(
          text,
          session.x,
          session.y,
          style,
          session.fontSize,
          session.color,
        );
        if (session.centered) {
          element.x -= element.w / 2;
          element.y -= element.h / 2;
        }
        setElements((previous) => [...previous, element]);
        setSelection([element.id]);
      }
    },
    [editing, setElements, style],
  );

  const cancelEditing = useCallback(() => {
    setEditing(null);
  }, []);

  const clearBoard = useCallback(() => {
    setElements([]);
    setSelection([]);
    setConfirmOpen(false);
    notify("Board cleared — ⌘Z to undo");
  }, [notify, setElements]);

  const zoomBy = useCallback((factor: number) => {
    setViewport((previous) =>
      zoomAt(
        previous,
        { x: window.innerWidth / 2, y: window.innerHeight / 2 },
        factor,
      ),
    );
  }, []);

  const resetZoom = useCallback(() => {
    setViewport((previous) =>
      zoomAt(
        previous,
        { x: window.innerWidth / 2, y: window.innerHeight / 2 },
        1 / previous.zoom,
      ),
    );
  }, []);

  const fitToContent = useCallback(() => {
    const bounds = elementBoundsAll(elements);
    if (!bounds) return;
    setViewport(fitViewport(bounds, window.innerWidth, window.innerHeight));
  }, [elements]);

  const handleExport = useCallback(async () => {
    if (elements.length === 0) return;
    await exportPng(elements);
    notify("PNG exported");
  }, [elements, notify]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "TEXTAREA" ||
          target.tagName === "INPUT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (helpOpen || confirmOpen) return;

      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (mod) {
        if (key === "z") {
          event.preventDefault();
          if (event.shiftKey) history.redo();
          else history.undo();
          return;
        }
        if (key === "y") {
          event.preventDefault();
          history.redo();
          return;
        }
        if (key === "a") {
          event.preventDefault();
          setSelection(elements.map((element) => element.id));
          return;
        }
        if (key === "d") {
          event.preventDefault();
          duplicateSelection();
          return;
        }
        if (key === "c") {
          if (selection.length > 0) {
            event.preventDefault();
            copySelection();
          }
          return;
        }
        if (key === "v") {
          if (clipboard.current.length > 0) {
            event.preventDefault();
            pasteClipboard();
          }
          return;
        }
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        if (selection.length > 0) {
          event.preventDefault();
          deleteSelection();
        }
        return;
      }

      if (event.key === "Escape") {
        if (selection.length > 0) {
          event.preventDefault();
          setSelection([]);
        }
        return;
      }

      if (
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight" ||
        event.key === "ArrowUp" ||
        event.key === "ArrowDown"
      ) {
        if (selection.length > 0) {
          event.preventDefault();
          const step = event.shiftKey ? 10 : 1;
          if (event.key === "ArrowLeft") nudge(-step, 0);
          if (event.key === "ArrowRight") nudge(step, 0);
          if (event.key === "ArrowUp") nudge(0, -step);
          if (event.key === "ArrowDown") nudge(0, step);
        }
        return;
      }

      if (event.code === "Digit1" && event.shiftKey) {
        event.preventDefault();
        fitToContent();
        return;
      }

      if (event.altKey) return;

      if (key === "v") changeTool("select");
      else if (key === "h") changeTool("hand");
      else if (key === "p") changeTool("pen");
      else if (key === "b") changeTool("ink");
      else if (key === "t") changeTool("text");
      else if (key === "e") changeTool("eraser");
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    changeTool,
    confirmOpen,
    copySelection,
    deleteSelection,
    duplicateSelection,
    elements,
    fitToContent,
    helpOpen,
    history,
    nudge,
    pasteClipboard,
    selection,
  ]);

  const showStylePanel =
    tool === "pen" ||
    tool === "ink" ||
    tool === "text" ||
    (tool === "select" && selection.length > 0);
  const showFontSize =
    tool === "text" || selectedElements.some((element) => element.kind === "text");
  const statusText =
    shapes.status === "ready"
      ? "Shapes ready"
      : shapes.status === "error"
        ? "Ink mode"
        : shapes.progress < 0.02
          ? "Shapes loading"
          : `Shapes ${Math.round(shapes.progress * 100)}%`;

  return (
    <div className="app">
      <Canvas
        elements={elements}
        selection={selection}
        setSelection={setSelection}
        tool={tool}
        style={style}
        viewport={viewport}
        setViewport={setViewport}
        onLiveElements={setLiveElements}
        onCommitSnapshot={commitSnapshot}
        onAddElement={addElement}
        onNotify={notify}
        recognize={shapes.recognize}
        editing={editing !== null}
        editingId={editing?.id ?? null}
        onStartText={startText}
        onEditText={editText}
      />

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path
                d="M5.5 17.5C8 11 11 7.5 18 5.5M7.5 6.5c3.4 3 6.6 6.2 8 11.5M4.5 11.5c4.5-1.2 9.4-.9 14 2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="brand-copy">
            <span className="brand-name">roughpad</span>
            <span className="brand-tag">smart sketchboard</span>
          </div>
        </div>

        <div className="top-actions">
          <button
            className="icon-button"
            aria-label="Help and shortcuts"
            title="Help and shortcuts"
            onClick={() => setHelpOpen(true)}
          >
            <HelpCircle size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="Clear board"
            title="Clear board"
            disabled={elements.length === 0}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 size={18} />
          </button>
          <button
            className="export-button"
            disabled={elements.length === 0}
            onClick={() => void handleExport()}
          >
            <Download size={16} />
            Export
          </button>
        </div>
      </header>

      <Toolbar
        tool={tool}
        setTool={changeTool}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        undo={history.undo}
        redo={history.redo}
      />

      <StylePanel
        visible={showStylePanel}
        style={style}
        showFontSize={showFontSize}
        selectedCount={selection.length}
        onChange={applyStyle}
        onDuplicate={duplicateSelection}
        onBringToFront={bringToFront}
        onSendToBack={sendToBack}
        onDelete={deleteSelection}
      />

      <ZoomBar
        zoom={viewport.zoom}
        onZoomIn={() => zoomBy(1.2)}
        onZoomOut={() => zoomBy(1 / 1.2)}
        onResetZoom={resetZoom}
        onFit={fitToContent}
        canFit={elements.length > 0}
      />

      <button
        className={`status-pill ${shapes.status}`}
        title={
          shapes.status === "error"
            ? "Shape snapping could not load. Strokes stay as ink."
            : "Shape recognition runs on-device"
        }
        onClick={() => setHelpOpen(true)}
      >
        <span className="status-dot" />
        {statusText}
      </button>

      {elements.length === 0 && !editing && (
        <div className="empty-hint">
          <div className="empty-title">Rough sketch. Perfect shape.</div>
          <p>
            Pick up the smart pen and draw. Rectangles, ellipses, triangles,
            diamonds, stars, hearts, clouds, arrows — they all snap.
          </p>
          <div className="empty-kinds">
            <span>rect</span>
            <span>ellipse</span>
            <span>triangle</span>
            <span>diamond</span>
            <span>star</span>
            <span>heart</span>
            <span>cloud</span>
            <span>arrow</span>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast" key={toast.id}>
          <span className="toast-spark">✦</span>
          {toast.text}
        </div>
      )}

      {editing && (
        <TextEditor
          key={editing.id ?? `new-${editing.x}-${editing.y}`}
          x={editing.x}
          y={editing.y}
          zoom={viewport.zoom}
          viewport={viewport}
          fontSize={editing.fontSize}
          color={editing.color}
          centered={editing.centered}
          initialValue={editing.text}
          onCommit={commitEditing}
          onCancel={cancelEditing}
        />
      )}

      <HelpDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        status={shapes.status}
        progress={shapes.progress}
      />
      <ConfirmDialog
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={clearBoard}
      />
    </div>
  );
}
