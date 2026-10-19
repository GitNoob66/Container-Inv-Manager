import { useEffect, useState } from "react";

/**
 * Signed-in role for this window. Login is checked against the stored password,
 * and the session lasts until the user logs out or closes the program/tab.
 */
export type AppRole = { kind: "master" } | { kind: "centre"; centreId: string };

const KEY = "cim.auth";
const EVENT = "cim-role-change";

function readRole(): AppRole | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppRole;
    if (parsed.kind === "master") return parsed;
    if (parsed.kind === "centre" && typeof parsed.centreId === "string" && parsed.centreId) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function setRole(role: AppRole | null) {
  if (role) window.sessionStorage.setItem(KEY, JSON.stringify(role));
  else window.sessionStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
}

export function logout() {
  setRole(null);
}

/** Current session: `ready` is false until browser storage has been read. */
export function useAuth(): { role: AppRole | null; ready: boolean } {
  const [state, setState] = useState<{ role: AppRole | null; ready: boolean }>({
    role: null,
    ready: false,
  });
  useEffect(() => {
    const sync = () => setState({ role: readRole(), ready: true });
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  return state;
}

/** Signed-in role; screens only render after login, so a fallback is never shown. */
export function useRole(): AppRole {
  return useAuth().role ?? { kind: "master" };
}

/** Centre users may only work inside their own centre; the admin can open every centre. */
export function canAccessCentre(role: AppRole, centreId: string): boolean {
  return role.kind === "master" || role.centreId === centreId;
}

/** Vehicles are managed locally by the centre; the admin only views them. */
export function canEditVehicles(role: AppRole, centreId: string): boolean {
  return role.kind === "centre" && role.centreId === centreId;
}
