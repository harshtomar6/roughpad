import { Maximize2, Minus, Plus } from "lucide-react";

interface ZoomBarProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFit: () => void;
  canFit: boolean;
}

export function ZoomBar({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFit,
  canFit,
}: ZoomBarProps) {
  return (
    <div className="zoom-bar" role="group" aria-label="Zoom">
      <button className="zoom-button" aria-label="Zoom out" onClick={onZoomOut}>
        <Minus size={15} />
      </button>
      <button
        className="zoom-value"
        aria-label="Reset zoom to 100%"
        title="Reset zoom"
        onClick={onResetZoom}
      >
        {Math.round(zoom * 100)}%
      </button>
      <button className="zoom-button" aria-label="Zoom in" onClick={onZoomIn}>
        <Plus size={15} />
      </button>
      <div className="zoom-sep" />
      <button
        className="zoom-button"
        aria-label="Zoom to fit"
        title="Zoom to fit · ⇧1"
        onClick={onFit}
        disabled={!canFit}
      >
        <Maximize2 size={15} />
      </button>
    </div>
  );
}
