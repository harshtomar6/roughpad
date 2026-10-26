import {
  Brush,
  Eraser,
  Hand,
  MousePointer2,
  PenLine,
  Redo2,
  Type,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import type { Tool } from "../scene/types";

interface ToolbarProps {
  tool: Tool;
  setTool: (tool: Tool) => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}

const TOOLS: {
  id: Tool;
  label: string;
  key: string;
  icon: LucideIcon;
  tip: string;
}[] = [
  { id: "select", label: "Select", key: "V", icon: MousePointer2, tip: "Select" },
  { id: "hand", label: "Pan", key: "H", icon: Hand, tip: "Pan" },
  { id: "pen", label: "Smart pen", key: "P", icon: PenLine, tip: "Smart pen — snaps shapes" },
  { id: "ink", label: "Ink", key: "B", icon: Brush, tip: "Freehand ink" },
  { id: "text", label: "Text", key: "T", icon: Type, tip: "Text" },
  { id: "eraser", label: "Eraser", key: "E", icon: Eraser, tip: "Eraser" },
];

export function Toolbar({
  tool,
  setTool,
  canUndo,
  canRedo,
  undo,
  redo,
}: ToolbarProps) {
  return (
    <div className="toolbar" role="toolbar" aria-label="Tools">
      {TOOLS.slice(0, 2).map((item) => (
        <ToolButton
          key={item.id}
          item={item}
          active={tool === item.id}
          onClick={() => setTool(item.id)}
        />
      ))}
      <div className="toolbar-sep" />
      {TOOLS.slice(2).map((item) => (
        <ToolButton
          key={item.id}
          item={item}
          active={tool === item.id}
          onClick={() => setTool(item.id)}
        />
      ))}
      <div className="toolbar-sep" />
      <button
        className="tool"
        data-tip="Undo · ⌘Z"
        aria-label="Undo"
        disabled={!canUndo}
        onClick={undo}
      >
        <Undo2 size={18} strokeWidth={1.9} />
      </button>
      <button
        className="tool"
        data-tip="Redo · ⇧⌘Z"
        aria-label="Redo"
        disabled={!canRedo}
        onClick={redo}
      >
        <Redo2 size={18} strokeWidth={1.9} />
      </button>
    </div>
  );
}

function ToolButton({
  item,
  active,
  onClick,
}: {
  item: (typeof TOOLS)[number];
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      className={`tool${active ? " active" : ""}`}
      data-tip={`${item.tip} · ${item.key}`}
      aria-label={item.label}
      aria-pressed={active}
      onClick={onClick}
    >
      <Icon size={18} strokeWidth={1.9} />
    </button>
  );
}
