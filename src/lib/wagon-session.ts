import { useSyncExternalStore } from "react";
import type { Wagon, WagonLoad } from "./wagons";

/** Wagons uploaded for the current rake movement. Kept in memory for this session only. */
type State = { wagons: Wagon[]; doubleStack: boolean; loads: WagonLoad[]; fileName: string };

const EMPTY: State = { wagons: [], doubleStack: false, loads: [], fileName: "" };
const store = new Map<string, State>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function wagonSession(key: string) {
  const get = () => store.get(key) ?? EMPTY;
  const set = (patch: Partial<State>) => {
    store.set(key, { ...get(), ...patch });
    emit();
  };
  return {
    get,
    setWagons: (wagons: Wagon[], fileName: string) => set({ wagons, fileName, loads: [] }),
    setDoubleStack: (doubleStack: boolean) => set({ doubleStack }),
    addLoads: (loads: WagonLoad[]) => set({ loads: [...get().loads, ...loads] }),
    clear: () => set({ ...EMPTY }),
  };
}

export function useWagonSession(key: string) {
  const state = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => store.get(key) ?? EMPTY,
    () => EMPTY,
  );
  return { ...state, ...wagonSession(key) };
}
