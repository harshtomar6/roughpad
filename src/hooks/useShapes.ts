import { useEffect, useState } from "react";
import type { Shape, ShapeKind, Shapes } from "@desert-ant-labs/shapes";
import { clamp } from "../scene/geometry";

type Status = "loading" | "ready" | "error";

const SMART_KINDS: ShapeKind[] = [
  "line",
  "curve",
  "arrow",
  "rectangle",
  "ellipse",
  "triangle",
  "diamond",
  "pentagon",
  "hexagon",
  "star",
  "heart",
  "cloud",
];

let runtimePromise: Promise<Shapes> | null = null;
let runtime: Shapes | null = null;
const progressListeners = new Set<(progress: number) => void>();

function loadRuntime() {
  if (!runtimePromise) {
    runtimePromise = import("@desert-ant-labs/shapes")
      .then(({ Shapes: ShapesSdk }) =>
        ShapesSdk.load({
          onProgress: (progress) => {
            const value = clamp(progress, 0, 1);
            for (const listener of progressListeners) {
              listener(value);
            }
          },
        }),
      )
      .then((shapes) => {
        runtime = shapes;
        return shapes;
      })
      .catch((error) => {
        runtimePromise = null;
        throw error;
      });
  }
  return runtimePromise;
}

export interface ShapesRuntime {
  status: Status;
  progress: number;
  recognize:
    | ((
        points: { x: number; y: number }[],
        options?: { rotation?: "snapped" | "upright" | "free" },
      ) => Promise<Shape | null>)
    | null;
  error: string | null;
}

export function useShapes(): ShapesRuntime {
  const [status, setStatus] = useState<Status>(runtime ? "ready" : "loading");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    if (runtime) {
      setStatus("ready");
      return;
    }

    const onProgress = (value: number) => {
      if (alive) {
        setProgress((previous) => Math.max(previous, value));
      }
    };
    progressListeners.add(onProgress);

    const begin = () => {
      loadRuntime()
        .then(() => {
          if (alive) {
            setStatus("ready");
            setProgress(1);
          }
        })
        .catch((reason: unknown) => {
          if (alive) {
            setStatus("error");
            setError(reason instanceof Error ? reason.message : "Could not load Shapes");
          }
        })
        .finally(() => {
          progressListeners.delete(onProgress);
        });
    };

    let idleHandle: number | null = null;
    let timer: number | null = null;
    if (typeof window.requestIdleCallback === "function") {
      idleHandle = window.requestIdleCallback(begin, { timeout: 900 });
    } else {
      timer = window.setTimeout(begin, 400);
    }

    return () => {
      alive = false;
      progressListeners.delete(onProgress);
      if (idleHandle != null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleHandle);
      }
      if (timer != null) window.clearTimeout(timer);
    };
  }, []);

  return {
    status,
    progress,
    error,
    recognize:
      status === "ready" && runtime
        ? (points, options) => {
            const shapes = runtime;
            if (!shapes) return Promise.resolve(null);
            return shapes.recognize(points, {
              rotation: options?.rotation ?? "upright",
              kinds: SMART_KINDS,
            });
          }
        : null,
  };
}
