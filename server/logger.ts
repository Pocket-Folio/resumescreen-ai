/**
 * Minimal logger. By design it only logs operational metadata (ids, counts, durations, error
 * codes) — never resume text, candidate names, contact details or request bodies.
 */
type Meta = Record<string, string | number | boolean | null | undefined>;

function line(level: string, msg: string, meta?: Meta): string {
  const m = meta ? " " + Object.entries(meta).map(([k, v]) => `${k}=${v}`).join(" ") : "";
  return `${new Date().toISOString()} ${level.padEnd(5)} ${msg}${m}`;
}

export const log = {
  info: (msg: string, meta?: Meta) => console.log(line("INFO", msg, meta)),
  warn: (msg: string, meta?: Meta) => console.warn(line("WARN", msg, meta)),
  error: (msg: string, meta?: Meta) => console.error(line("ERROR", msg, meta)),
};
