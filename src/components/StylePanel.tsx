import {
  BringToFront,
  Copy,
  SendToBack,
  Trash2,
} from "lucide-react";
import {
  BACKGROUND_COLORS,
  STROKE_COLORS,
  type FillStyle,
  type StrokeStyle,
  type Style,
} from "../scene/types";

interface StylePanelProps {
  visible: boolean;
  style: Style;
  showFontSize: boolean;
  selectedCount: number;
  onChange: (patch: Partial<Style>) => void;
  onDuplicate: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onDelete: () => void;
}

const FILL_STYLES: FillStyle[] = ["hachure", "cross-hatch", "solid", "dots"];
const STROKE_STYLES: StrokeStyle[] = ["solid", "dashed", "dotted"];
const WIDTHS = [1.5, 3, 5];
const FONT_SIZES = [
  { size: 18, label: "S" },
  { size: 26, label: "M" },
  { size: 36, label: "L" },
  { size: 52, label: "XL" },
];

export function StylePanel({
  visible,
  style,
  showFontSize,
  selectedCount,
  onChange,
  onDuplicate,
  onBringToFront,
  onSendToBack,
  onDelete,
}: StylePanelProps) {
  if (!visible) return null;

  return (
    <aside className="style-panel" aria-label="Element style">
      <section className="style-section">
        <div className="style-label">Stroke</div>
        <div className="swatch-row">
          {STROKE_COLORS.map((color) => (
            <button
              key={color}
              className={`swatch${style.stroke === color ? " selected" : ""}`}
              style={{ background: color }}
              aria-label={`Stroke ${color}`}
              aria-pressed={style.stroke === color}
              onClick={() => onChange({ stroke: color })}
            />
          ))}
        </div>
      </section>

      <section className="style-section">
        <div className="style-label">Fill</div>
        <div className="swatch-row">
          {BACKGROUND_COLORS.map((color) => (
            <button
              key={color}
              className={`swatch${color === "transparent" ? " transparent" : ""}${
                style.background === color ? " selected" : ""
              }`}
              style={color === "transparent" ? undefined : { background: color }}
              aria-label={color === "transparent" ? "No fill" : `Fill ${color}`}
              aria-pressed={style.background === color}
              onClick={() => onChange({ background: color })}
            />
          ))}
        </div>
        <div className="option-row fill-options">
          {FILL_STYLES.map((fill) => (
            <button
              key={fill}
              className={`option${style.fillStyle === fill ? " active" : ""}`}
              aria-label={fill}
              aria-pressed={style.fillStyle === fill}
              onClick={() => onChange({ fillStyle: fill })}
            >
              <span className={`fill-preview ${fill}`} />
            </button>
          ))}
        </div>
      </section>

      <section className="style-section">
        <div className="style-label">Stroke width</div>
        <div className="option-row">
          {WIDTHS.map((width) => (
            <button
              key={width}
              className={`option${style.strokeWidth === width ? " active" : ""}`}
              aria-label={`Width ${width}`}
              aria-pressed={style.strokeWidth === width}
              onClick={() => onChange({ strokeWidth: width })}
            >
              <span
                className="width-preview"
                style={{ height: Math.max(1.5, width - 0.5) }}
              />
            </button>
          ))}
        </div>
      </section>

      <section className="style-section">
        <div className="style-label">Stroke style</div>
        <div className="option-row">
          {STROKE_STYLES.map((stroke) => (
            <button
              key={stroke}
              className={`option${style.strokeStyle === stroke ? " active" : ""}`}
              aria-label={stroke}
              aria-pressed={style.strokeStyle === stroke}
              onClick={() => onChange({ strokeStyle: stroke })}
            >
              <span className={`stroke-preview ${stroke}`} />
            </button>
          ))}
        </div>
      </section>

      <section className="style-section">
        <div className="style-label">Sloppiness</div>
        <div className="option-row">
          {[0.55, 1.2, 2.1].map((roughness, index) => (
            <button
              key={roughness}
              className={`option${style.roughness === roughness ? " active" : ""}`}
              aria-label={["Architect", "Artist", "Cartoonist"][index]}
              aria-pressed={style.roughness === roughness}
              onClick={() => onChange({ roughness })}
            >
              <RoughIcon level={index} />
            </button>
          ))}
        </div>
      </section>

      {showFontSize && (
        <section className="style-section">
          <div className="style-label">Font size</div>
          <div className="option-row">
            {FONT_SIZES.map(({ size, label }) => (
              <button
                key={size}
                className={`option font-option${style.fontSize === size ? " active" : ""}`}
                aria-label={`Font size ${label}`}
                aria-pressed={style.fontSize === size}
                onClick={() => onChange({ fontSize: size })}
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      )}

      {selectedCount > 0 && (
        <section className="style-section actions-section">
          <div className="style-label">
            {selectedCount === 1 ? "1 element" : `${selectedCount} elements`}
          </div>
          <div className="action-row">
            <button
              className="action-button"
              data-tip="Duplicate · ⌘D"
              aria-label="Duplicate"
              onClick={onDuplicate}
            >
              <Copy size={16} />
            </button>
            <button
              className="action-button"
              data-tip="Bring to front"
              aria-label="Bring to front"
              onClick={onBringToFront}
            >
              <BringToFront size={16} />
            </button>
            <button
              className="action-button"
              data-tip="Send to back"
              aria-label="Send to back"
              onClick={onSendToBack}
            >
              <SendToBack size={16} />
            </button>
            <button
              className="action-button danger"
              data-tip="Delete · Del"
              aria-label="Delete"
              onClick={onDelete}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </section>
      )}
    </aside>
  );
}

function RoughIcon({ level }: { level: number }) {
  if (level === 0) {
    return (
      <svg width="26" height="16" viewBox="0 0 26 16" aria-hidden="true">
        <path
          d="M3 8h20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (level === 1) {
    return (
      <svg width="26" height="16" viewBox="0 0 26 16" aria-hidden="true">
        <path
          d="M2 9c3-3 5 3 8 0s5 3 8 0 4 2 6 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width="26" height="16" viewBox="0 0 26 16" aria-hidden="true">
      <path
        d="M2 10c2-6 4 5 6-1s4 7 6 0 4 5 6-1 3 3 4 1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
