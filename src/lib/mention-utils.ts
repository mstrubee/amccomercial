/** Normalize a display name to a mention handle: lowercase, no spaces, no accents. */
export function nameToHandle(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

export const MENTION_REGEX = /@([A-Za-zÀ-ÿ0-9_]+)/g;

/** Split text into segments, marking which ones are mentions matching a known handle. */
export function splitTextWithMentions(
  text: string,
  knownHandles: Set<string>,
): Array<{ type: "text" | "mention"; value: string; handle?: string }> {
  if (!text) return [];
  const out: Array<{ type: "text" | "mention"; value: string; handle?: string }> = [];
  let last = 0;
  const re = new RegExp(MENTION_REGEX.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const handle = m[1].toLowerCase();
    if (!knownHandles.has(handle)) continue;
    if (m.index > last) out.push({ type: "text", value: text.slice(last, m.index) });
    out.push({ type: "mention", value: m[0], handle });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out;
}