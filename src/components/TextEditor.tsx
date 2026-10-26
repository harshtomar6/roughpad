import { useEffect, useMemo, useRef, useState } from "react";
import { measureText, TEXT_LINE_HEIGHT } from "../scene/create";
import type { Viewport } from "../scene/types";

interface TextEditorProps {
  x: number;
  y: number;
  zoom: number;
  viewport: Viewport;
  fontSize: number;
  color: string;
  centered?: boolean;
  initialValue: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

export function TextEditor({
  x,
  y,
  zoom,
  viewport,
  fontSize,
  color,
  centered = false,
  initialValue,
  onCommit,
  onCancel,
}: TextEditorProps) {
  const [value, setValue] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const cancelledRef = useRef(false);
  const committedRef = useRef(false);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    const length = textarea.value.length;
    textarea.setSelectionRange(length, length);
  }, []);

  const metrics = useMemo(
    () => measureText(value || " ", fontSize),
    [value, fontSize],
  );

  const commit = () => {
    if (cancelledRef.current || committedRef.current) return;
    committedRef.current = true;
    onCommit(value);
  };

  const screenX = x * zoom + viewport.x;
  const screenY = y * zoom + viewport.y;
  const width = Math.max(metrics.w * zoom + 22, 130);
  const height = Math.max(metrics.h * zoom + 12, fontSize * zoom * 1.4);
  const left = centered ? screenX - width / 2 : screenX - 3;
  const top = centered ? screenY - height / 2 : screenY - 3;

  return (
    <textarea
      ref={textareaRef}
      className="text-editor"
      value={value}
      placeholder="Type something"
      spellCheck={false}
      autoCorrect="off"
      autoCapitalize="off"
      style={{
        left,
        top,
        width,
        height,
        fontSize: fontSize * zoom,
        lineHeight: TEXT_LINE_HEIGHT,
        color,
      }}
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          cancelledRef.current = true;
          onCancel();
          return;
        }
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          commit();
        }
      }}
    />
  );
}
