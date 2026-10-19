import { useEffect, useState } from "react";

/**
 * Working role for this PC/browser. There is no login, so this is an operating
 * mode that shapes the screens, not a security boundary.
 */
export type AppRole = { kind: "master" } | { kind: "centre"; centreId: string };

const KEY = "cim.role";
const EVENT = "cim-role-change";
const DEFAULT_ROLE: AppRole = { kind: "master" };

function readRole(): AppRole {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_ROLE;
    const parsed = JSON.parse(raw) as AppRole;
    if (parsed.kind === "centre" && typeof parsed.centreId === "string" && parsed.centreId) return parsed;
    return DEFAULT_ROLE;
  } catch {
    return DEFAULT_ROLE;
  }
}

export function setRole(role: AppRole) {
  window.localStorage.setItem(KEY, JSON.stringify(role));
  window.dispatchEvent(new Event(EVENT));
}

export function useRole(): AppRole {
  const [role, setState] = useState<AppRole>(DEFAULT_ROLE);
  useEffect(() => {
    const sync = () => setState(readRole());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return role;
}

/** Centre users may only work inside their own centre. */
export function canAccessCentre(role: AppRole, centreId: string): boolean {
  return role.kind === "master" || role.centreId === centreId;
}

/** Vehicles are managed locally by the centre; the master user only views them. */
export function canEditVehicles(role: AppRole, centreId: string): boolean {
  return role.kind === "centre" && role.centreId === centreId;
}
