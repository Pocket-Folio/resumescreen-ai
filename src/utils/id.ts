/** Client-side id (crypto.randomUUID is unavailable on plain-HTTP origins, so fall back). */
export const clientId = (prefix: string) =>
  `${prefix}_${typeof crypto !== "undefined" && "randomUUID" in crypto && window.isSecureContext
    ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
    : Math.random().toString(36).slice(2, 14)}`;
