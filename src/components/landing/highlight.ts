const TOKEN = /("[^"]*"?|`[^`]*`?)|\b(const|export|async|await|return)\b|\b([A-Z][A-Za-z0-9]*)\b|([a-zA-Z_][\w]*)(?=\()|([{}()[\],:;=.])/g;
const TOKEN_CLASS = ["text-emerald-600", "text-violet-600", "text-blue-600", "text-indigo-500", "text-neutral-400"];

/** Minimal TypeScript colouring; unterminated strings (mid-typing) still colour correctly. */
export function highlight(line: string): Array<{ text: string; cls: string }> {
  const out: Array<{ text: string; cls: string }> = [];
  let last = 0;
  for (const m of line.matchAll(TOKEN)) {
    if (m.index > last) out.push({ text: line.slice(last, m.index), cls: "text-neutral-800" });
    const group = m.slice(1).findIndex((g) => g !== undefined);
    out.push({ text: m[0], cls: TOKEN_CLASS[group] });
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push({ text: line.slice(last), cls: "text-neutral-800" });
  return out;
}
