import { useCallback, useState } from "react";

type Updater<T> = T | ((previous: T) => T);

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export interface History<T> {
  present: T;
  canUndo: boolean;
  canRedo: boolean;
  set: (updater: Updater<T>) => void;
  setLive: (updater: Updater<T>) => void;
  commitSnapshot: (snapshot: T) => void;
  undo: () => void;
  redo: () => void;
  reset: (next: T) => void;
}

export function useHistory<T>(
  initial: T | (() => T),
  limit = 100,
): History<T> {
  const [state, setState] = useState<HistoryState<T>>(() => ({
    past: [],
    present:
      typeof initial === "function" ? (initial as () => T)() : initial,
    future: [],
  }));

  const set = useCallback(
    (updater: Updater<T>) => {
      setState((current) => {
        const next =
          typeof updater === "function"
            ? (updater as (previous: T) => T)(current.present)
            : updater;
        if (next === current.present) {
          return current;
        }
        return {
          past: [...current.past, current.present].slice(-limit),
          present: next,
          future: [],
        };
      });
    },
    [limit],
  );

  const setLive = useCallback((updater: Updater<T>) => {
    setState((current) => {
      const next =
        typeof updater === "function"
          ? (updater as (previous: T) => T)(current.present)
          : updater;
      if (next === current.present) {
        return current;
      }
      return { ...current, present: next };
    });
  }, []);

  const commitSnapshot = useCallback(
    (snapshot: T) => {
      setState((current) => {
        if (current.present === snapshot) {
          return current;
        }
        return {
          past: [...current.past, snapshot].slice(-limit),
          present: current.present,
          future: [],
        };
      });
    },
    [limit],
  );

  const undo = useCallback(() => {
    setState((current) => {
      if (current.past.length === 0) return current;
      const previous = current.past[current.past.length - 1];
      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [current.present, ...current.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((current) => {
      if (current.future.length === 0) return current;
      const next = current.future[0];
      return {
        past: [...current.past, current.present],
        present: next,
        future: current.future.slice(1),
      };
    });
  }, []);

  const reset = useCallback((next: T) => {
    setState({ past: [], present: next, future: [] });
  }, []);

  return {
    present: state.present,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    set,
    setLive,
    commitSnapshot,
    undo,
    redo,
    reset,
  };
}
