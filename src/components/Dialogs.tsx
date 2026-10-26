import { useEffect } from "react";
import { Sparkles, X } from "lucide-react";

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
  status: "loading" | "ready" | "error";
  progress: number;
}

const SHORTCUTS = [
  ["V", "Select"],
  ["H", "Pan"],
  ["P", "Smart pen"],
  ["B", "Freehand ink"],
  ["T", "Text"],
  ["E", "Eraser"],
  ["Space + drag", "Pan the board"],
  ["⌘ + scroll", "Zoom"],
  ["⇧ 1", "Zoom to fit"],
  ["Double-click", "Add text"],
  ["⌘ Z / ⇧⌘ Z", "Undo / redo"],
  ["⌘ D", "Duplicate"],
  ["⌘ A", "Select all"],
  ["Del", "Delete"],
];

export function HelpDialog({ open, onClose, status, progress }: HelpDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal help-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" aria-label="Close" onClick={onClose}>
          <X size={18} />
        </button>

        <div className="help-kicker">
          <Sparkles size={13} />
          Rough sketch. Perfect shape.
        </div>
        <h2 id="help-title">Welcome to Roughpad</h2>
        <p className="help-lede">
          Draw a rough rectangle, circle, arrow, star or cloud with the smart pen.
          It snaps to clean geometry and keeps a hand-drawn look — so diagrams feel
          human, not plastic.
        </p>

        <div className="help-grid">
          <div>
            <h3>Tools</h3>
            <ShortcutList items={SHORTCUTS.slice(0, 6)} />
          </div>
          <div>
            <h3>Board</h3>
            <ShortcutList items={SHORTCUTS.slice(6, 10)} />
          </div>
          <div>
            <h3>Edit</h3>
            <ShortcutList items={SHORTCUTS.slice(10)} />
          </div>
        </div>

        <div className="help-model">
          <div>
            <strong>On-device shape recognition</strong>
            <span>
              Powered by Shapes from Desert Ant Labs. Once the 1.3&nbsp;MB model
              downloads, recognition runs locally in your browser — your strokes
              never leave the device.
            </span>
          </div>
          <div className={`model-chip ${status}`}>
            <span className="status-dot" />
            {status === "ready"
              ? "Model ready"
              : status === "error"
                ? "Model unavailable"
                : `Loading ${Math.round(progress * 100)}%`}
          </div>
        </div>

        <div className="help-links">
          <a
            href="https://desertant.com/models/shapes/"
            target="_blank"
            rel="noreferrer"
          >
            About Shapes ↗
          </a>
          <a href="https://desertant.com/docs/shapes/" target="_blank" rel="noreferrer">
            Docs ↗
          </a>
          <button className="primary-button" onClick={onClose}>
            Let me draw
          </button>
        </div>
      </div>
    </div>
  );
}

function ShortcutList({ items }: { items: string[][] }) {
  return (
    <ul className="shortcut-list">
      {items.map(([key, label]) => (
        <li key={key}>
          <span>{label}</span>
          <kbd>{key}</kbd>
        </li>
      ))}
    </ul>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({ open, onCancel, onConfirm }: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <div
        className="modal confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-title">Clear the board?</h2>
        <p>
          This removes every element. You can still bring it back with undo.
        </p>
        <div className="confirm-actions">
          <button className="ghost-button" onClick={onCancel}>
            Cancel
          </button>
          <button className="danger-button" onClick={onConfirm}>
            Clear board
          </button>
        </div>
      </div>
    </div>
  );
}
