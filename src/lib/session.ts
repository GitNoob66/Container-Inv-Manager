import { api } from "./api";

const SESSION_KEY = "cim.session.start";

export function sessionStart(): string {
  if (typeof window === "undefined") return new Date().toISOString();
  let v = window.sessionStorage.getItem(SESSION_KEY);
  if (!v) {
    v = new Date().toISOString();
    window.sessionStorage.setItem(SESSION_KEY, v);
  }
  return v;
}

/** Records an action in the master log (fire and forget). */
export function logAction(
  centreId: string | null,
  centreName: string | null,
  action: string,
  details?: string,
) {
  sessionStart();
  void api.log(centreId, centreName, action, details).catch(() => {});
}

export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
