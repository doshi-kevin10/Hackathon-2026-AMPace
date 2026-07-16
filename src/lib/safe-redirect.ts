/**
 * Sanitize a post-login `next` target to a same-origin relative path.
 * Rejects protocol-relative (`//host`), backslash tricks (`/\host`), absolute
 * URLs, and control characters — all of which enable open redirects.
 * Pure & dependency-free so both server and client code can share it.
 */
export function safeNext(next: string | null | undefined): string {
  if (typeof next !== "string" || next.length === 0) return "/";
  if (next[0] !== "/") return "/"; // must be a relative path
  if (next[1] === "/" || next[1] === "\\") return "/"; // //host or /\host
  if (next.includes("\\")) return "/";
  if (/[\u0000-\u001f\u007f]/.test(next)) return "/";
  return next;
}
